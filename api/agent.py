from __future__ import annotations
import asyncio
import ast
import json
import os
import re
import time
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

from tools.macros import get_macro_references
from tools.menus import analyze_menu_image_bytes
from tools.restaurants import enrich_top_candidates, search_and_score_restaurants


load_dotenv()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
MODEL = os.getenv(
    "NEMOTRON_MODEL",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
)

DEFAULT_LAT = os.getenv("DEFAULT_LAT")
DEFAULT_LNG = os.getenv("DEFAULT_LNG")
DEFAULT_CITY = os.getenv("DEFAULT_CITY")
DEFAULT_COUNTRY = os.getenv("DEFAULT_COUNTRY")


# ----------------------------- generic helpers -----------------------------

def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(item.strip())
    return out


def _safe_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _usage_to_dict(usage: Any) -> dict[str, Any]:
    """Normalize OpenAI-compatible usage objects into plain JSON."""
    if usage is None:
        return {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }

    if isinstance(usage, dict):
        raw = usage
    elif hasattr(usage, "model_dump"):
        raw = usage.model_dump()
    else:
        raw = {
            "prompt_tokens": getattr(usage, "prompt_tokens", 0) or 0,
            "completion_tokens": getattr(usage, "completion_tokens", 0) or 0,
            "total_tokens": getattr(usage, "total_tokens", 0) or 0,
        }
        prompt_details = getattr(usage, "prompt_tokens_details", None)
        completion_details = getattr(usage, "completion_tokens_details", None)
        if prompt_details is not None:
            raw["prompt_tokens_details"] = _usage_to_dict(prompt_details)
        if completion_details is not None:
            raw["completion_tokens_details"] = _usage_to_dict(completion_details)

    return {
        "prompt_tokens": int(raw.get("prompt_tokens") or 0),
        "completion_tokens": int(raw.get("completion_tokens") or 0),
        "total_tokens": int(raw.get("total_tokens") or 0),
        **({"prompt_tokens_details": raw.get("prompt_tokens_details")} if raw.get("prompt_tokens_details") else {}),
        **({"completion_tokens_details": raw.get("completion_tokens_details")} if raw.get("completion_tokens_details") else {}),
    }


def record_token_usage(
    token_usage: list[dict[str, Any]] | None,
    *,
    response: Any,
    purpose: str,
    model: str,
    route: str,
    retry: bool = False,
) -> None:
    if token_usage is None:
        return

    usage = _usage_to_dict(getattr(response, "usage", None))
    token_usage.append(
        {
            "provider": "nvidia",
            "model": model,
            "route": route,
            "purpose": purpose,
            "retry": retry,
            **usage,
        }
    )


def summarize_token_usage(calls: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "provider": "nvidia",
        "model": MODEL,
        "calls": calls,
        "totals": {
            "prompt_tokens": sum(int(c.get("prompt_tokens") or 0) for c in calls),
            "completion_tokens": sum(int(c.get("completion_tokens") or 0) for c in calls),
            "total_tokens": sum(int(c.get("total_tokens") or 0) for c in calls),
            "call_count": len(calls),
        },
    }


# -------------------------- profile/context helpers -------------------------

def build_recommendation_context(
    message: str,
    user_profile: dict[str, Any],
    location: dict[str, Any],
) -> dict[str, Any]:
    """
    Converts the frontend UserProfile into a stable backend contract.

    This avoids scattering frontend field names across scoring, prompts, and tools.
    """
    profile_mode = str(user_profile.get("profileMode") or "guest")
    privacy = _safe_dict(user_profile.get("privacy"))
    use_profile = bool(privacy.get("useProfileForRecommendations", True))

    dietary = _safe_dict(user_profile.get("dietary"))
    preferences = _safe_dict(user_profile.get("preferences"))
    nutrition = _safe_dict(user_profile.get("nutritionGoals"))
    language = _safe_dict(user_profile.get("language"))

    # Cheat day should bypass preference/nutrition restrictions, but allergens are
    # kept as warnings because the user may still need safety reminders.
    ignore_preference_profile = profile_mode == "cheat_day" or not use_profile

    max_distance_miles = _safe_float(preferences.get("maxDistanceMiles")) or 5.0

    diet_rules = _safe_dict(dietary.get("dietRules"))
    active_diet_rules = {
        str(key): bool(value)
        for key, value in diet_rules.items()
        if value is True and not ignore_preference_profile
    }

    return {
        "message": message,
        "raw_profile": user_profile,
        "profile_mode": profile_mode,
        "use_profile": use_profile,
        "location": location,
        "dietary": {
            "allergens": _safe_list(dietary.get("allergens")),
            "avoid_ingredients": [] if ignore_preference_profile else _safe_list(dietary.get("avoidIngredients")),
            "diet_rules": active_diet_rules,
            "spice_tolerance": "any" if ignore_preference_profile else str(dietary.get("spiceTolerance") or "any"),
        },
        "preferences": {
            "budget": "any" if ignore_preference_profile else str(preferences.get("budget") or "any"),
            "max_distance_miles": max_distance_miles,
            "liked_cuisines": [] if ignore_preference_profile else _safe_list(preferences.get("likedCuisines")),
            "disliked_cuisines": [] if ignore_preference_profile else _safe_list(preferences.get("dislikedCuisines")),
            "liked_foods": [] if ignore_preference_profile else _safe_list(preferences.get("likedFoods")),
            "disliked_foods": [] if ignore_preference_profile else _safe_list(preferences.get("dislikedFoods")),
            "preferred_order_terms": [] if ignore_preference_profile else _safe_list(preferences.get("preferredOrderTerms")),
            "avoid_order_terms": [] if ignore_preference_profile else _safe_list(preferences.get("avoidOrderTerms")),
        },
        "nutrition_goals": {
            "goal_type": "none" if ignore_preference_profile else str(nutrition.get("goalType") or "balanced"),
            "calories_max": None if ignore_preference_profile else _safe_int(nutrition.get("caloriesMax")),
            "calories_min": None if ignore_preference_profile else _safe_int(nutrition.get("caloriesMin")),
            "protein_min_grams": None if ignore_preference_profile else _safe_int(nutrition.get("proteinMinGrams")),
            "carbs_max_grams": None if ignore_preference_profile else _safe_int(nutrition.get("carbsMaxGrams")),
            "fat_max_grams": None if ignore_preference_profile else _safe_int(nutrition.get("fatMaxGrams")),
        },
        "language": {
            "preferred_language": str(language.get("preferredLanguage") or "en"),
            "explain_cultural_norms": bool(language.get("explainCulturalNorms", False)),
        },
    }


def profile_budget_from_context(context: dict[str, Any]) -> str | None:
    budget = str(_safe_dict(context.get("preferences")).get("budget") or "any").strip().lower()
    return None if budget in ["", "any", "none", "null"] else budget


def profile_radius_meters_from_context(context: dict[str, Any]) -> float:
    prefs = _safe_dict(context.get("preferences"))
    miles = _safe_float(prefs.get("max_distance_miles"))
    if miles and miles > 0:
        return miles * 1609.344
    return 5000.0


def dietary_lists_from_context(context: dict[str, Any]) -> tuple[list[str], list[str]]:
    dietary = _safe_dict(context.get("dietary"))
    restrictions = _safe_list(dietary.get("avoid_ingredients"))
    diet_rules = _safe_dict(dietary.get("diet_rules"))
    restrictions.extend([str(key) for key, enabled in diet_rules.items() if enabled is True])
    allergies = _safe_list(dietary.get("allergens"))
    return _dedupe(restrictions), _dedupe(allergies)


def enrich_intent_with_profile(
    intent: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    nutrition = _safe_dict(context.get("nutrition_goals"))
    prefs = _safe_dict(context.get("preferences"))
    dietary = _safe_dict(context.get("dietary"))

    goal_type = str(nutrition.get("goal_type") or "balanced")
    macro_goal_parts = [str(intent.get("macro_goal") or "").strip()]

    if goal_type and goal_type not in ["none", "balanced"]:
        macro_goal_parts.append(goal_type.replace("_", " "))
    if nutrition.get("protein_min_grams"):
        macro_goal_parts.append(f"at least {nutrition['protein_min_grams']}g protein")
    if nutrition.get("calories_max"):
        macro_goal_parts.append(f"under {nutrition['calories_max']} calories")
    if nutrition.get("calories_min"):
        macro_goal_parts.append(f"at least {nutrition['calories_min']} calories")
    if nutrition.get("carbs_max_grams"):
        macro_goal_parts.append(f"under {nutrition['carbs_max_grams']}g carbs")
    if nutrition.get("fat_max_grams"):
        macro_goal_parts.append(f"under {nutrition['fat_max_grams']}g fat")

    restrictions, allergies = dietary_lists_from_context(context)

    parsed_restrictions = _safe_list(intent.get("dietary_restrictions"))
    parsed_allergies = _safe_list(intent.get("allergies"))

    max_calories = intent.get("max_calories")
    if max_calories is None:
        max_calories = nutrition.get("calories_max")

    return {
        **intent,
        "profile_mode": context.get("profile_mode"),
        "use_profile": context.get("use_profile"),
        "macro_goal": " ".join(part for part in macro_goal_parts if part).strip() or None,
        "nutrition_goal_type": goal_type,
        "max_calories": _safe_int(max_calories),
        "calories_max": nutrition.get("calories_max"),
        "calories_min": nutrition.get("calories_min"),
        "protein_min_grams": nutrition.get("protein_min_grams"),
        "carbs_max_grams": nutrition.get("carbs_max_grams"),
        "fat_max_grams": nutrition.get("fat_max_grams"),
        "budget": intent.get("budget") or profile_budget_from_context(context),
        "liked_cuisines": _safe_list(prefs.get("liked_cuisines")),
        "disliked_cuisines": _safe_list(prefs.get("disliked_cuisines")),
        "liked_foods": _safe_list(prefs.get("liked_foods")),
        "disliked_foods": _safe_list(prefs.get("disliked_foods")),
        "preferred_order_terms": _safe_list(prefs.get("preferred_order_terms")),
        "avoid_order_terms": _safe_list(prefs.get("avoid_order_terms")),
        "spice_tolerance": dietary.get("spice_tolerance"),
        "dietary_restrictions": _dedupe([*parsed_restrictions, *restrictions]),
        "allergies": _dedupe([*parsed_allergies, *allergies]),
        "radius_meters": profile_radius_meters_from_context(context),
        "preferred_language": _safe_dict(context.get("language")).get("preferred_language", "en"),
        "explain_cultural_norms": _safe_dict(context.get("language")).get("explain_cultural_norms", False),
    }


# ------------------------------- main agent --------------------------------

class ForagerAgent:
    def __init__(self) -> None:
        self.nvidia_api_key = NVIDIA_API_KEY
        self.model = MODEL
        self.client = None

        if self.nvidia_api_key:
            self.client = OpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=self.nvidia_api_key,
            )

    async def run_chat(
        self,
        message: str,
        user_profile: dict[str, Any] | None = None,
        location: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        user_profile = user_profile or {}
        location = location or {}
        token_usage: list[dict[str, Any]] = []
        tool_trace: list[dict[str, Any]] = []

        context = build_recommendation_context(
            message=message,
            user_profile=user_profile,
            location=location,
        )

        intent = self.extract_intent(
            message=message,
            user_profile=user_profile,
            location=location,
            context=context,
            token_usage=token_usage,
        )

        tool_trace.append(
            {
                "tool": "nvidia_nemotron_intent_extraction",
                "status": "ok" if self.client else "skipped",
                "output": intent,
                "reason": None if self.client else "NVIDIA_API_KEY is missing; fallback parser used.",
            }
        )

        resolved_location = self.resolve_location(
            request_location=location,
            intent=intent,
        )

        tool_trace.append(
            {
                "tool": "location_resolution",
                "status": "ok",
                "output": resolved_location,
            }
        )

        # Reddit/local community is not approved yet, so keep this honest and neutral.
        community_signal: dict[str, Any] = {
            "status": "unavailable",
            "source": None,
            "community_by_name": {},
            "note": "Community sentiment is neutral because Reddit/API community search is not enabled yet.",
        }

        tool_trace.append(
            {
                "tool": "community_sentiment",
                "status": "skipped",
                "reason": "Reddit API approval is pending; using neutral community score.",
            }
        )

        radius_meters = float(intent.get("radius_meters") or 5000)

        async def fetch_restaurants() -> list[dict[str, Any]]:
            if resolved_location.get("lat") is None or resolved_location.get("lng") is None:
                return []

            lat = float(resolved_location["lat"])
            lng = float(resolved_location["lng"])

            return await asyncio.to_thread(
                search_and_score_restaurants,
                intent=intent,
                lat=lat,
                lng=lng,
                community_by_name=community_signal.get("community_by_name", {}),
                radius_meters=radius_meters,
                max_results=20,
            )

        async def fetch_macro_references() -> list[dict[str, Any]]:
            # Keep page_size low for /chat speed. Food/menu image analysis can use deeper USDA search.
            return await asyncio.to_thread(
                get_macro_references,
                intent=intent,
                page_size=2,
            )

        stage_started = time.perf_counter()
        restaurant_result, macro_result = await asyncio.gather(
            fetch_restaurants(),
            fetch_macro_references(),
            return_exceptions=True,
        )
        text_search_seconds = round(time.perf_counter() - stage_started, 3)

        restaurants: list[dict[str, Any]] = []
        macro_references: list[dict[str, Any]] = []

        if resolved_location.get("lat") is None or resolved_location.get("lng") is None:
            tool_trace.append(
                {
                    "tool": "google_places_restaurant_search",
                    "status": "skipped",
                    "reason": "No lat/lng provided and no DEFAULT_LAT/DEFAULT_LNG set in api/.env.",
                }
            )
        elif isinstance(restaurant_result, Exception):
            tool_trace.append(
                {
                    "tool": "google_places_restaurant_search",
                    "status": "error",
                    "error": str(restaurant_result),
                }
            )
        else:
            restaurants = restaurant_result
            tool_trace.append(
                {
                    "tool": "google_places_restaurant_search",
                    "status": "ok",
                    "count": len(restaurants),
                    "radius_meters": radius_meters,
                    "seconds": text_search_seconds,
                }
            )

            tool_trace.append(
                {
                    "tool": "forager_weighted_ranking",
                    "status": "ok",
                    "weights": {
                        "restaurant_rating": "18%",
                        "community_sentiment": "7% neutral until Reddit/community data is enabled",
                        "distance": "10%",
                        "price": "10%",
                        "macro_fit": "22%",
                        "preference_match": "18%",
                        "availability": "15%",
                    },
                }
            )

        if isinstance(macro_result, Exception):
            tool_trace.append(
                {
                    "tool": "usda_fooddata_central",
                    "status": "error",
                    "error": str(macro_result),
                }
            )
        else:
            macro_references = macro_result
            tool_trace.append(
                {
                    "tool": "usda_fooddata_central",
                    "status": "ok",
                    "queries": [item.get("query") for item in macro_references],
                }
            )

        if restaurants:
            enrich_started = time.perf_counter()
            try:
                enriched = await enrich_top_candidates(
                    places=restaurants,
                    top_n=6,
                    intent=intent,
                )
            except Exception as exc:
                enriched = restaurants
                tool_trace.append(
                    {
                        "tool": "google_place_details_enrichment",
                        "status": "error",
                        "error": str(exc),
                    }
                )
            else:
                enrich_seconds = round(time.perf_counter() - enrich_started, 3)
                head = enriched[:6]
                tool_trace.append(
                    {
                        "tool": "google_place_details_enrichment",
                        "status": "ok",
                        "count": len(head),
                        "with_hours": sum(1 for p in head if p.get("openingHoursToday")),
                        "with_website": sum(1 for p in head if p.get("websiteUri")),
                        "seconds": enrich_seconds,
                    }
                )
                restaurants = enriched

        synth_started = time.perf_counter()
        final = self.synthesize_final_answer(
            message=message,
            user_profile=user_profile,
            context=context,
            location=resolved_location,
            intent=intent,
            restaurants=restaurants[:6],
            community_signal=community_signal,
            macro_references=macro_references,
            tool_trace=tool_trace,
            token_usage=token_usage,
        )
        tool_trace.append(
            {
                "tool": "nemotron_final_synthesis",
                "status": "ok",
                "seconds": round(time.perf_counter() - synth_started, 3),
            }
        )

        summary = summarize_token_usage(token_usage)
        tool_trace.append(
            {
                "tool": "nvidia_token_usage",
                "status": "ok",
                "output": summary["totals"],
            }
        )

        final["tool_trace"] = tool_trace
        final["token_usage"] = summary
        return final

    async def analyze_menu_upload(
        self,
        image_bytes: bytes,
        filename: str,
        goal: str,
        user_profile: dict[str, Any] | None = None,
        record_text: str = "",
    ) -> dict[str, Any]:
        token_usage: list[dict[str, Any]] = []
        try:
            result = analyze_menu_image_bytes(
                image_bytes=image_bytes,
                filename=filename,
                goal=goal,
                user_profile=user_profile or {},
                record_text=record_text,
                token_usage=token_usage,
            )

            return {
                "status": "ok",
                **result,
                "token_usage": summarize_token_usage(token_usage),
            }
        except Exception as exc:
            return {
                "status": "error",
                "filename": filename,
                "error": str(exc),
                "token_usage": summarize_token_usage(token_usage),
                "tools_used": [
                    "nvidia_nemotron_vision",
                    "usda_fooddata_central",
                ],
            }

    async def analyze_food_upload(
        self,
        image_bytes: bytes,
        filename: str,
        user_profile: dict[str, Any] | None = None,
        clarifications: dict[str, Any] | None = None,
        record_text: str = "",
    ) -> dict[str, Any]:
        token_usage: list[dict[str, Any]] = []
        try:
            from tools.food import analyze_food_image_bytes

            result = analyze_food_image_bytes(
                image_bytes=image_bytes,
                filename=filename,
                user_profile=user_profile or {},
                clarifications=clarifications or {},
                record_text=record_text,
                token_usage=token_usage,
            )

            return {
                "status": "ok",
                **result,
                "token_usage": summarize_token_usage(token_usage),
            }
        except Exception as exc:
            return {
                "status": "error",
                "dish": "Unknown dish",
                "confidence": 0.0,
                "cuisine": None,
                "ingredients": [],
                "followUpQuestions": [
                    {
                        "id": "portion",
                        "question": "What portion did you eat?",
                        "options": ["all of it", "half", "a few bites", "not sure"],
                    }
                ],
                "macros": {
                    "caloriesMin": 0,
                    "caloriesMax": 0,
                    "proteinMinG": 0,
                    "proteinMaxG": 0,
                    "carbsMinG": 0,
                    "carbsMaxG": 0,
                    "fatMinG": 0,
                    "fatMaxG": 0,
                    "servingNote": f"Food analysis failed: {exc}",
                },
                "logSuggestions": [],
                "nextOrderTips": [],
                "token_usage": summarize_token_usage(token_usage),
            }

    def resolve_location(
        self,
        request_location: dict[str, Any],
        intent: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Priority:
        1. Browser/frontend lat/lng.
        2. Intent lat/lng if extracted.
        3. DEFAULT_LAT / DEFAULT_LNG from .env.
        4. City-only fallback.
        """
        lat = request_location.get("lat") or intent.get("lat") or DEFAULT_LAT
        lng = request_location.get("lng") or intent.get("lng") or DEFAULT_LNG
        city = request_location.get("city") or intent.get("city") or DEFAULT_CITY
        country = request_location.get("country") or intent.get("country") or DEFAULT_COUNTRY

        return {
            "lat": float(lat) if lat is not None else None,
            "lng": float(lng) if lng is not None else None,
            "city": city,
            "country": country,
        }

    def extract_intent(
        self,
        message: str,
        user_profile: dict[str, Any],
        location: dict[str, Any],
        context: dict[str, Any],
        token_usage: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Nemotron extracts intent. Fallback parser keeps app alive if model/API fails."""
        fallback = self.fallback_intent_parser(
            message=message,
            context=context,
            location=location,
        )

        if not self.client:
            return fallback

        messages = [
            {
                "role": "system",
                "content": (
                    "You extract food recommendation intent for Forager. Return ONLY valid JSON. No markdown.\n\n"
                    "Use the user profile, but respect profile_mode and use_profile. If profile_mode is cheat_day, "
                    "ignore normal preferences/nutrition goals but keep allergens as safety warnings.\n\n"
                    "Schema:\n"
                    "{\n"
                    '  "message": "string",\n'
                    '  "cuisine": "string or null",\n'
                    '  "craving": "string or null",\n'
                    '  "budget": "cheap|moderate|expensive|null",\n'
                    '  "macro_goal": "string or null",\n'
                    '  "max_calories": "number or null",\n'
                    '  "dietary_restrictions": ["string"],\n'
                    '  "allergies": ["string"],\n'
                    '  "city": "string or null",\n'
                    '  "country": "string or null",\n'
                    '  "lat": "number or null",\n'
                    '  "lng": "number or null",\n'
                    '  "radius_meters": "number",\n'
                    '  "needs_restaurant_search": true,\n'
                    '  "needs_macro_estimate": true\n'
                    "}\n"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"User message:\n{message}\n\n"
                    f"Raw user profile:\n{json.dumps(user_profile, indent=2)}\n\n"
                    f"Normalized recommendation context:\n{json.dumps(context, indent=2)}\n\n"
                    f"Location:\n{json.dumps(location, indent=2)}"
                ),
            },
        ]

        try:
            text = self.call_nemotron_text(
                messages=messages,
                max_tokens=1500,
                temperature=0.1,
                purpose="chat.intent_extraction",
                route="/chat",
                token_usage=token_usage,
            )
            parsed = self.extract_json_from_text(text)
            return enrich_intent_with_profile({**fallback, **parsed, "message": message}, context)
        except Exception:
            return fallback

    def fallback_intent_parser(
        self,
        message: str,
        context: dict[str, Any],
        location: dict[str, Any],
    ) -> dict[str, Any]:
        text = message.lower()
        cuisine = None
        for candidate in [
            "mexican", "japanese", "korean", "thai", "chinese", "indian",
            "mediterranean", "vietnamese", "italian", "american", "filipino",
            "greek", "poke", "sushi", "ramen", "bbq",
        ]:
            if candidate in text:
                cuisine = candidate
                break

        budget = None
        if any(word in text for word in ["cheap", "budget", "affordable", "inexpensive"]):
            budget = "cheap"
        elif any(word in text for word in ["fancy", "expensive", "premium"]):
            budget = "expensive"
        elif any(word in text for word in ["moderate", "mid"]):
            budget = "moderate"

        macro_goal_parts = []
        if "high protein" in text or "protein" in text:
            macro_goal_parts.append("high protein")
        if "low calorie" in text or "under" in text or "healthy" in text:
            macro_goal_parts.append("low calorie healthy")
        if "low carb" in text or "keto" in text:
            macro_goal_parts.append("low carb")
        if "bulk" in text or "bulking" in text:
            macro_goal_parts.append("bulking")
        if "cut" in text or "cutting" in text:
            macro_goal_parts.append("cutting")

        max_calories = None
        calorie_match = re.search(r"under\s+(\d+)\s*(?:cal|calories|kcal)?", text)
        if calorie_match:
            max_calories = int(calorie_match.group(1))

        prefs = _safe_dict(context.get("preferences"))
        nutrition = _safe_dict(context.get("nutrition_goals"))
        restrictions, allergies = dietary_lists_from_context(context)

        fallback_intent = {
            "message": message,
            "cuisine": cuisine,
            "craving": message,
            "budget": budget or profile_budget_from_context(context),
            "macro_goal": " ".join(macro_goal_parts).strip() or None,
            "max_calories": max_calories,
            "dietary_restrictions": restrictions,
            "allergies": allergies,
            "city": location.get("city"),
            "country": location.get("country"),
            "lat": location.get("lat"),
            "lng": location.get("lng"),
            "radius_meters": profile_radius_meters_from_context(context),
            "preferred_order_terms": _safe_list(prefs.get("preferred_order_terms")),
            "avoid_order_terms": _safe_list(prefs.get("avoid_order_terms")),
            "liked_cuisines": _safe_list(prefs.get("liked_cuisines")),
            "disliked_cuisines": _safe_list(prefs.get("disliked_cuisines")),
            "liked_foods": _safe_list(prefs.get("liked_foods")),
            "disliked_foods": _safe_list(prefs.get("disliked_foods")),
            "spice_tolerance": _safe_dict(context.get("dietary")).get("spice_tolerance"),
            "nutrition_goal_type": nutrition.get("goal_type"),
            "needs_restaurant_search": True,
            "needs_macro_estimate": True,
        }

        return enrich_intent_with_profile(fallback_intent, context)

    def synthesize_final_answer(
        self,
        message: str,
        user_profile: dict[str, Any],
        context: dict[str, Any],
        location: dict[str, Any],
        intent: dict[str, Any],
        restaurants: list[dict[str, Any]],
        community_signal: dict[str, Any],
        macro_references: list[dict[str, Any]],
        tool_trace: list[dict[str, Any]],
        token_usage: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Nemotron decides whether USDA references are useful, creates 3 order
        suggestions per restaurant, and estimates macro ranges.
        """
        if not self.client:
            return self.fallback_final_answer(
                intent=intent,
                restaurants=restaurants,
                macro_references=macro_references,
                tool_trace=tool_trace,
            )

        compact_restaurants = [
            {
                "place_id": r.get("id"),
                "name": r.get("name"),
                "address": r.get("address"),
                "rating": r.get("rating"),
                "reviewCount": r.get("reviewCount"),
                "priceLevel": r.get("priceLevel"),
                "priceLevelLabel": r.get("priceLevelLabel"),
                "openNow": r.get("openNow"),
                "distanceMiles": r.get("distanceMiles"),
                "googleMapsUri": r.get("googleMapsUri"),
                "websiteUri": r.get("websiteUri"),
                "editorialSummary": r.get("editorialSummary"),
                "openingHoursToday": r.get("openingHoursToday"),
                "primaryType": r.get("primaryType"),
                "types": r.get("types", []),
                "score": r.get("score"),
            }
            for r in restaurants[:20]
        ]

        messages = [
            {
                "role": "system",
                "content": (
                    "You are Forager, an AI food decision assistant. You compare restaurant options, price, "
                    "distance, availability, user preferences, dietary constraints, nutrition targets, and USDA macro references.\n\n"
                    "Critical rules:\n"
                    "1. USDA data is only reference data. It may lack portion size or not match restaurant food.\n"
                    "2. Give macro ranges, not exact values.\n"
                    "3. Return at least 3 order_suggestions for each restaurant unless the restaurant data is unusable.\n"
                    "4. Each order_suggestion must include practical modifications and estimated_macros.\n"
                    "5. Clearly label macro confidence: high, medium, medium-low, or low.\n"
                    "6. Do not give medical advice. If allergies exist, warn the user to verify with the restaurant.\n"
                    "7. Do not claim Reddit/community sentiment unless community_signal.status is 'ok'.\n"
                    "8. sources_used must list real sources such as Google Places, USDA FoodData Central, Nemotron, and Forager scoring.\n"
                    "9. Respect profile_mode and use_profile from recommendation_context.\n\n"
                    "GROUNDING RULES (HARD REQUIREMENTS):\n"
                    "G1. Every recommendation's `why` MUST be anchored to either a specific user-profile field "
                    "(`dietary.allergens`, `dietary.avoidIngredients`, `dietary.dietRules.*`, `dietary.spiceTolerance`, "
                    "`nutritionGoals.goalType`, `nutritionGoals.proteinMinGrams`, `nutritionGoals.caloriesMax`, "
                    "`preferences.budget`, `preferences.likedCuisines`, `preferences.likedFoods`, "
                    "`preferences.preferredOrderTerms`, `preferences.maxDistanceMiles`) OR a verbatim phrase from the user's "
                    "original message. Generic restaurant blurb without a real anchor is NOT acceptable.\n"
                    "G2. Every recommendation's `tradeoffs` MUST acknowledge a real profile constraint or prompt phrase "
                    "this restaurant only partially satisfies (e.g. distance, missing diet rule, lower protein than goal, "
                    "limited hours). Do not invent a tradeoff that doesn't actually conflict with the user's profile.\n"
                    "G3. List the anchors in the structured `evidence` object: `profile_fields_cited` (use the exact dotted "
                    "field names from the list above) and `prompt_phrases_cited` (verbatim phrases from the user's message). "
                    "This is the ONLY place where dotted field names are allowed.\n\n"
                    "COPY STYLE (HARD REQUIREMENTS) — read these carefully:\n"
                    "S1. `why` and `tradeoffs` must read like a friendly waiter giving a quick recommendation. Plain English. "
                    "1-2 short sentences each. No bullet lists, no headings, no markdown.\n"
                    "S2. NEVER include profile field names like `nutritionGoals.goalType`, `preferences.maxDistanceMiles`, "
                    "or `dietary.allergens` in the prose. NEVER add a parenthetical `(cited: …)` or any technical reference. "
                    "The `evidence` object is the ONLY place that names fields.\n"
                    "S3. Translate field VALUES into natural language: `goalType: \"high_protein\"` → \"high protein\"; "
                    "`budget: \"cheap\"` → \"cheap\" or \"easy on the wallet\"; `maxDistanceMiles: 5` → \"close by (0.4 mi)\"; "
                    "`allergens: [\"peanut\"]` → \"peanut-free\". When citing a number, use the natural unit (mi, g, kcal).\n"
                    "S4. SKIP no-op profile values. If `budget == \"any\"`, `goalType == \"none\"`, `allergens == []`, or any "
                    "field is empty/default, do not mention it at all. Only call out preferences that actually shaped the pick.\n"
                    "S5. Do not quote raw values like `'any'` or `'none'` in the prose; if you'd be quoting a default, "
                    "drop the clause entirely.\n\n"
                    "PRICE-RANGE RULES:\n"
                    "P1. Every order_suggestion MUST include `price_range_usd: {min, max}` and `price_confidence` "
                    "(high|medium|low). Anchor the range on the restaurant's `priceLevel` / `priceLevelLabel`, the cuisine, "
                    "and the city in `address`. Always return a range, never a single point — widen the range and lower "
                    "confidence when uncertain. If `priceLevel` is missing, use `low` confidence.\n\n"
                    "EXAMPLES (illustrative, not literal):\n"
                    "Setup: user said \"something high protein near me, ideally cheap\". "
                    "Profile has goalType=high_protein, budget=cheap, maxDistanceMiles=5, allergens=[].\n"
                    "GOOD `why`: \"Hits your high-protein target — the bowl runs about 35-40g — and stays cheap. "
                    "It's only 0.4 mi away, easy walk.\"\n"
                    "GOOD `tradeoffs`: \"Limited vegetarian options if that ever matters to you.\"\n"
                    "BAD `why` (do NOT do this): \"Matches nutritionGoals.goalType (high_protein, 35-40g) and "
                    "preferences.budget ('cheap'); 0.4 mi is within preferences.maxDistanceMiles (cited: …).\"\n"
                    "BAD `tradeoffs` (do NOT do this): \"Price slightly higher than budget 'any' but within moderate range.\" "
                    "(`any` is the no-op default — drop that clause entirely.)\n"
                    'evidence: {"profile_fields_cited": ["nutritionGoals.goalType","preferences.budget","preferences.maxDistanceMiles"], '
                    '"prompt_phrases_cited": ["high protein","cheap","near me"]}\n\n'
                    "Return JSON only. No markdown.\n\n"
                    "Schema:\n"
                    "{\n"
                    '  "answer": "string",\n'
                    '  "recommendations": [\n'
                    "    {\n"
                    '      "rank": 1,\n'
                    '      "place_id": "string (echo the place_id from Scored restaurants verbatim)",\n'
                    '      "place": "string",\n'
                    '      "address": "string",\n'
                    '      "score": 0,\n'
                    '      "why": "string",\n'
                    '      "order_suggestions": [\n'
                    "        {\n"
                    '          "name": "string",\n'
                    '          "modifications": ["string"],\n'
                    '          "estimated_macros": {\n'
                    '            "calories": "string",\n'
                    '            "protein": "string",\n'
                    '            "carbs": "string",\n'
                    '            "fat": "string",\n'
                    '            "confidence": "high|medium|medium-low|low"\n'
                    "          },\n"
                    '          "price_range_usd": { "min": 0, "max": 0 },\n'
                    '          "price_confidence": "high|medium|low",\n'
                    '          "why": "string"\n'
                    "        }\n"
                    "      ],\n"
                    '      "tradeoffs": "string",\n'
                    '      "evidence": {\n'
                    '        "profile_fields_cited": ["string"],\n'
                    '        "prompt_phrases_cited": ["string"]\n'
                    "      },\n"
                    '      "sources_used": ["string"],\n'
                    '      "google_maps_url": "string or null"\n'
                    "    }\n"
                    "  ],\n"
                    '  "tool_trace": [],\n'
                    '  "limitations": ["string"]\n'
                    "}"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Original user message:\n{message}\n\n"
                    f"Raw user profile:\n{json.dumps(user_profile, indent=2)}\n\n"
                    f"Recommendation context:\n{json.dumps(context, indent=2)}\n\n"
                    f"Resolved location:\n{json.dumps(location, indent=2)}\n\n"
                    f"Extracted intent:\n{json.dumps(intent, indent=2)}\n\n"
                    f"Scored restaurants:\n{json.dumps(compact_restaurants, indent=2)}\n\n"
                    f"Community signal:\n{json.dumps(community_signal, indent=2)}\n\n"
                    f"USDA macro references:\n{json.dumps(macro_references, indent=2)}\n\n"
                    f"Tool trace:\n{json.dumps(tool_trace, indent=2)}\n\n"
                    "Generate the final recommendations. Usually return the top 3 restaurants. "
                    "For each restaurant, return at least 3 distinct order_suggestions. "
                    "Do not collapse the restaurant into one order unless there is truly no reasonable alternative. "
                    "CRITICAL: copy `place_id` for each recommendation EXACTLY from the matching entry in "
                    "`Scored restaurants` (this is how the backend joins your output to Google Places metadata "
                    "like opening hours, lat/lng, and website). Do not invent, modify, or omit place_id."
                ),
            },
        ]

        try:
            text = self.call_nemotron_text(
                messages=messages,
                max_tokens=3000,
                temperature=0.2,
                purpose="chat.final_synthesis",
                route="/chat",
                token_usage=token_usage,
            )
            parsed = self.extract_json_from_text(text)

            unjustified_ranks = self.find_unjustified_recommendations(
                parsed=parsed,
                user_profile=user_profile,
                message=message,
            )
            if unjustified_ranks:
                parsed = self.retry_synthesis_for_unjustified(
                    parsed=parsed,
                    unjustified_ranks=unjustified_ranks,
                    base_messages=messages,
                    token_usage=token_usage,
                    tool_trace=tool_trace,
                )

            parsed["tool_trace"] = tool_trace
            return self.normalize_chat_response(parsed, restaurants, intent, tool_trace=tool_trace)
        except Exception as exc:
            fallback = self.fallback_final_answer(
                intent=intent,
                restaurants=restaurants,
                macro_references=macro_references,
                tool_trace=tool_trace,
            )
            fallback["limitations"].append(f"Nemotron synthesis failed: {exc}")
            return fallback

    # ----------------------- evidence validator + retry -----------------------

    _ALLOWED_EVIDENCE_FIELDS = {
        "dietary.allergens",
        "dietary.avoidIngredients",
        "dietary.dietRules.halal",
        "dietary.dietRules.kosher",
        "dietary.dietRules.vegetarian",
        "dietary.dietRules.vegan",
        "dietary.dietRules.pescatarian",
        "dietary.dietRules.glutenFree",
        "dietary.dietRules.dairyFree",
        "dietary.dietRules.nutFree",
        "dietary.spiceTolerance",
        "nutritionGoals.goalType",
        "nutritionGoals.proteinMinGrams",
        "nutritionGoals.caloriesMax",
        "nutritionGoals.caloriesMin",
        "nutritionGoals.carbsMaxGrams",
        "nutritionGoals.fatMaxGrams",
        "preferences.budget",
        "preferences.likedCuisines",
        "preferences.likedFoods",
        "preferences.dislikedCuisines",
        "preferences.dislikedFoods",
        "preferences.preferredOrderTerms",
        "preferences.avoidOrderTerms",
        "preferences.maxDistanceMiles",
    }

    # Profile values that are no-ops and should NOT count as anchors.
    _NO_OP_PROFILE_VALUES = {"any", "none", "balanced", "guest", "normal"}

    def _profile_field_value(self, user_profile: dict[str, Any], path: str) -> Any:
        cursor: Any = user_profile
        for part in path.split("."):
            if not isinstance(cursor, dict):
                return None
            cursor = cursor.get(part)
        return cursor

    def _value_anchors(self, value: Any) -> list[str]:
        """Plain-English forms a model would actually write for a profile value.

        Examples:
          "high_protein" -> ["high protein", "high-protein", "high_protein"]
          ["peanut", "shellfish"] -> ["peanut", "shellfish"]
          True -> []
          5 -> ["5"]
        """
        if value is None or value == "" or value == [] or value == {}:
            return []
        if isinstance(value, bool):
            return []
        if isinstance(value, (int, float)):
            return [str(value)]
        if isinstance(value, list):
            anchors: list[str] = []
            for item in value:
                anchors.extend(self._value_anchors(item))
            return anchors
        if isinstance(value, str):
            text = value.strip().lower()
            if not text or text in self._NO_OP_PROFILE_VALUES:
                return []
            forms = {text}
            if "_" in text:
                forms.add(text.replace("_", " "))
                forms.add(text.replace("_", "-"))
            if " " in text:
                forms.add(text.replace(" ", "-"))
            return list(forms)
        return []

    def _evidence_is_valid(
        self,
        rec: dict[str, Any],
        user_profile: dict[str, Any],
        message: str,
    ) -> bool:
        """Plain-English-friendly grounding check.

        A rec passes if its `why` mentions either:
          - a verbatim phrase from the user's prompt that the model claims to have cited, OR
          - the human-readable VALUE of a cited profile field (e.g. "high protein"
            for goalType=high_protein, "peanut" for allergens=["peanut"]).
        Field NAMES (e.g. "goalType") are no longer required in the prose — the
        new prompt forbids them.
        """
        evidence = rec.get("evidence")
        if not isinstance(evidence, dict):
            return False

        why_text = str(rec.get("why") or "").lower()
        if not why_text:
            return False

        message_lower = (message or "").lower()
        cited_fields = [
            str(f) for f in (evidence.get("profile_fields_cited") or [])
            if isinstance(f, str)
        ]
        cited_phrases = [
            str(p) for p in (evidence.get("prompt_phrases_cited") or [])
            if isinstance(p, str) and str(p).strip()
        ]

        anchors: list[str] = []
        for field in cited_fields:
            if field not in self._ALLOWED_EVIDENCE_FIELDS:
                continue
            value = self._profile_field_value(user_profile, field)
            anchors.extend(self._value_anchors(value))

        for phrase in cited_phrases:
            phrase_lower = phrase.lower().strip()
            if phrase_lower and phrase_lower in message_lower:
                anchors.append(phrase_lower)

        if not anchors:
            return False

        return any(anchor and anchor in why_text for anchor in anchors)

    def find_unjustified_recommendations(
        self,
        parsed: dict[str, Any],
        user_profile: dict[str, Any],
        message: str,
    ) -> list[int]:
        recs = parsed.get("recommendations") or []
        unjustified: list[int] = []
        for index, rec in enumerate(recs):
            if not isinstance(rec, dict):
                continue
            if not self._evidence_is_valid(rec, user_profile, message):
                unjustified.append(index)
        return unjustified

    def retry_synthesis_for_unjustified(
        self,
        parsed: dict[str, Any],
        unjustified_ranks: list[int],
        base_messages: list[dict[str, Any]],
        token_usage: list[dict[str, Any]],
        tool_trace: list[dict[str, Any]],
    ) -> dict[str, Any]:
        recs = parsed.get("recommendations") or []
        targets = [recs[i] for i in unjustified_ranks if 0 <= i < len(recs)]
        if not targets:
            return parsed

        retry_started = time.perf_counter()
        target_summary = [
            {
                "rank": rec.get("rank"),
                "place": rec.get("place"),
                "current_why": rec.get("why"),
                "current_tradeoffs": rec.get("tradeoffs"),
                "current_evidence": rec.get("evidence"),
            }
            for rec in targets
        ]

        retry_messages = list(base_messages) + [
            {
                "role": "assistant",
                "content": json.dumps(parsed)[:4000],
            },
            {
                "role": "user",
                "content": (
                    "Your previous response did not cite required user-profile fields or verbatim prompt "
                    "phrases for these recommendations. Rewrite ONLY their `why`, `tradeoffs`, and `evidence` "
                    "to satisfy the GROUNDING RULES. Keep everything else (place, address, score, "
                    "order_suggestions, sources_used, google_maps_url) identical to your previous response. "
                    "Return the full updated JSON in the same schema.\n\n"
                    f"Recommendations to fix:\n{json.dumps(target_summary, indent=2)}"
                ),
            },
        ]

        try:
            text = self.call_nemotron_text(
                messages=retry_messages,
                max_tokens=2000,
                temperature=0.2,
                purpose="chat.final_synthesis.retry",
                route="/chat",
                token_usage=token_usage,
                retry=True,
            )
            updated = self.extract_json_from_text(text)
        except Exception as exc:
            tool_trace.append(
                {
                    "tool": "nemotron_grounding_retry",
                    "status": "skipped",
                    "reason": "Retry response could not be parsed; keeping original recommendations.",
                    "error": str(exc),
                    "ranks": unjustified_ranks,
                }
            )
            return parsed

        updated_recs = updated.get("recommendations") if isinstance(updated, dict) else None
        if not isinstance(updated_recs, list):
            tool_trace.append(
                {
                    "tool": "nemotron_grounding_retry",
                    "status": "error",
                    "error": "retry response missing recommendations",
                    "ranks": unjustified_ranks,
                }
            )
            return parsed

        updated_by_place = {
            str((r.get("place") or "")).lower(): r
            for r in updated_recs
            if isinstance(r, dict)
        }

        replaced = 0
        for index in unjustified_ranks:
            if 0 <= index < len(recs):
                key = str(recs[index].get("place") or "").lower()
                replacement = updated_by_place.get(key)
                if isinstance(replacement, dict):
                    for field in ("why", "tradeoffs", "evidence"):
                        if replacement.get(field) is not None:
                            recs[index][field] = replacement[field]
                    replaced += 1

        tool_trace.append(
            {
                "tool": "nemotron_grounding_retry",
                "status": "ok",
                "ranks": unjustified_ranks,
                "replaced": replaced,
                "seconds": round(time.perf_counter() - retry_started, 3),
            }
        )
        parsed["recommendations"] = recs
        return parsed

    @staticmethod
    def _normalize_place_name(value: Any) -> str:
        """Collapse punctuation/whitespace so 'Foo -- Downtown' matches 'Foo – Downtown'."""
        text = str(value or "").lower()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return " ".join(text.split())

    def normalize_chat_response(
        self,
        parsed: dict[str, Any],
        restaurants: list[dict[str, Any]],
        intent: dict[str, Any],
        tool_trace: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Keep response backward-compatible while adding order_suggestions."""
        recs = parsed.get("recommendations")
        if not isinstance(recs, list):
            parsed["recommendations"] = []
            return parsed

        restaurant_by_id: dict[str, dict[str, Any]] = {}
        restaurant_by_norm_name: dict[str, dict[str, Any]] = {}
        for r in restaurants:
            rid = str(r.get("id") or "").strip()
            if rid:
                restaurant_by_id[rid] = r
            norm = self._normalize_place_name(r.get("name"))
            if norm:
                restaurant_by_norm_name[norm] = r

        match_outcomes = {"id": 0, "name": 0, "miss": 0}

        for rec in recs:
            if not isinstance(rec, dict):
                continue

            source_restaurant: dict[str, Any] = {}
            rec_place_id = str(rec.get("place_id") or "").strip()
            if rec_place_id and rec_place_id in restaurant_by_id:
                source_restaurant = restaurant_by_id[rec_place_id]
                match_outcomes["id"] += 1
            else:
                norm_rec = self._normalize_place_name(rec.get("place"))
                if norm_rec and norm_rec in restaurant_by_norm_name:
                    source_restaurant = restaurant_by_norm_name[norm_rec]
                    match_outcomes["name"] += 1
                else:
                    # Substring fallback: many models truncate or extend names.
                    if norm_rec:
                        for key, candidate in restaurant_by_norm_name.items():
                            if norm_rec in key or key in norm_rec:
                                source_restaurant = candidate
                                match_outcomes["name"] += 1
                                break
                    if not source_restaurant:
                        match_outcomes["miss"] += 1

            # Promote enrichment fields from the underlying restaurant onto
            # the user-facing recommendation (Nemotron doesn't echo them back).
            if source_restaurant:
                if rec.get("lat") is None:
                    rec["lat"] = source_restaurant.get("latitude")
                if rec.get("lng") is None:
                    rec["lng"] = source_restaurant.get("longitude")
                if not rec.get("website"):
                    rec["website"] = source_restaurant.get("websiteUri")
                if not rec.get("price"):
                    rec["price"] = source_restaurant.get("priceLevelLabel")
                if not rec.get("opening_hours_today"):
                    rec["opening_hours_today"] = source_restaurant.get("openingHoursToday")
                if not rec.get("google_maps_url"):
                    rec["google_maps_url"] = source_restaurant.get("googleMapsUri")

            suggestions = rec.get("order_suggestions")
            fallback_suggestions = self.generic_order_suggestions(intent)

            if not isinstance(suggestions, list):
                suggestions = []

            # Enforce the new contract: each restaurant should have at least
            # three order suggestions whenever possible.
            cleaned_suggestions: list[dict[str, Any]] = []
            for item in suggestions:
                if isinstance(item, dict) and (item.get("name") or item.get("order")):
                    cleaned_suggestions.append(item)

            existing_names = {
                str(item.get("name") or item.get("order") or "").strip().lower()
                for item in cleaned_suggestions
            }
            for item in fallback_suggestions:
                name = str(item.get("name") or "").strip().lower()
                if name and name not in existing_names:
                    cleaned_suggestions.append(item)
                    existing_names.add(name)
                if len(cleaned_suggestions) >= 3:
                    break

            rec["order_suggestions"] = cleaned_suggestions[:3]
            suggestions = rec["order_suggestions"]

            # Backward compatibility for the current frontend card.
            if suggestions:
                first = suggestions[0]
                if isinstance(first, dict):
                    if not rec.get("order"):
                        rec["order"] = first.get("name") or ""
                    macros = _safe_dict(first.get("estimated_macros"))
                    rec["estimated_macros"] = macros
                    # Promote price range so the card can show it next to the order.
                    price_range = first.get("price_range_usd")
                    if isinstance(price_range, dict) and not rec.get("price_range_usd"):
                        try:
                            rec["price_range_usd"] = {
                                "min": float(price_range.get("min")),
                                "max": float(price_range.get("max")),
                            }
                        except (TypeError, ValueError):
                            pass
                    if first.get("price_confidence") and not rec.get("price_confidence"):
                        rec["price_confidence"] = first.get("price_confidence")

        if tool_trace is not None:
            tool_trace.append(
                {
                    "tool": "rec_to_restaurant_match",
                    "status": "ok",
                    "matched_by_id": match_outcomes["id"],
                    "matched_by_name": match_outcomes["name"],
                    "missed": match_outcomes["miss"],
                    "with_lat_lng": sum(
                        1 for r in recs if isinstance(r, dict) and r.get("lat") is not None
                    ),
                    "with_hours_today": sum(
                        1 for r in recs if isinstance(r, dict) and r.get("opening_hours_today")
                    ),
                    "with_website": sum(
                        1 for r in recs if isinstance(r, dict) and r.get("website")
                    ),
                }
            )

        return parsed

    def fallback_final_answer(
        self,
        intent: dict[str, Any],
        restaurants: list[dict[str, Any]],
        macro_references: list[dict[str, Any]],
        tool_trace: list[dict[str, Any]],
    ) -> dict[str, Any]:
        recommendations = []

        for index, restaurant in enumerate(restaurants[:3], start=1):
            order_suggestions = self.generic_order_suggestions(intent)
            first = order_suggestions[0]
            recommendations.append(
                {
                    "rank": index,
                    "place": restaurant.get("name"),
                    "address": restaurant.get("address"),
                    "score": restaurant.get("score", {}).get("total"),
                    "order": first.get("name"),
                    "estimated_macros": first.get("estimated_macros"),
                    "order_suggestions": order_suggestions,
                    "why": (
                        "This restaurant ranked well based on Google rating, distance, price, "
                        "availability, preference match, and the macro-fit heuristic."
                    ),
                    "tradeoffs": "Macro estimate needs Nemotron synthesis and/or menu confirmation.",
                    "sources_used": [
                        "Google Places",
                        "Forager weighted scoring",
                        "USDA FoodData Central references",
                    ],
                    "google_maps_url": restaurant.get("googleMapsUri"),
                }
            )

        if not recommendations:
            order_suggestions = self.generic_order_suggestions(intent)
            recommendations.append(
                {
                    "rank": 1,
                    "place": None,
                    "address": None,
                    "score": None,
                    "order": order_suggestions[0].get("name"),
                    "estimated_macros": order_suggestions[0].get("estimated_macros"),
                    "order_suggestions": order_suggestions,
                    "why": "No restaurant data was available. Check location/API keys.",
                    "tradeoffs": "No Google Places results available.",
                    "sources_used": ["fallback"],
                    "google_maps_url": None,
                }
            )

        return {
            "answer": "Here are the best available options based on the current data.",
            "recommendations": recommendations,
            "tool_trace": tool_trace,
            "macro_references": macro_references,
            "limitations": [
                "USDA values are approximate references, not exact restaurant macros.",
                "The user should verify allergens, ingredients, and portion sizes with the restaurant.",
            ],
        }

    def generic_order_suggestions(self, intent: dict[str, Any]) -> list[dict[str, Any]]:
        cuisine = (intent.get("cuisine") or "").lower()
        goal = " ".join(
            [
                str(intent.get("macro_goal") or ""),
                str(intent.get("nutrition_goal_type") or ""),
            ]
        ).lower()

        def macros(confidence: str = "low") -> dict[str, str]:
            return {
                "calories": "Estimate unavailable until Nemotron synthesis runs",
                "protein": "Estimate unavailable until Nemotron synthesis runs",
                "carbs": "Estimate unavailable until Nemotron synthesis runs",
                "fat": "Estimate unavailable until Nemotron synthesis runs",
                "confidence": confidence,
            }

        if "mexican" in cuisine:
            return [
                {
                    "name": "Chicken or steak burrito bowl",
                    "modifications": ["extra protein", "light rice", "extra fajita vegetables", "salsa on the side"],
                    "estimated_macros": macros(),
                    "why": "Most controllable high-protein Mexican option.",
                },
                {
                    "name": "Grilled protein tacos",
                    "modifications": ["corn tortillas", "skip sour cream", "extra pico", "side salad instead of chips"],
                    "estimated_macros": macros(),
                    "why": "Good protein without the calorie load of a large burrito.",
                },
                {
                    "name": "Chicken salad bowl",
                    "modifications": ["no fried shell", "light dressing", "beans optional", "extra vegetables"],
                    "estimated_macros": macros(),
                    "why": "Best fallback for lower calories if available.",
                },
            ]

        if "japanese" in cuisine or "sushi" in cuisine:
            return [
                {
                    "name": "Sashimi or grilled fish plate",
                    "modifications": ["rice on the side", "extra vegetables", "sauce on the side"],
                    "estimated_macros": macros(),
                    "why": "Protein-forward and easier to keep lower calorie.",
                },
                {
                    "name": "Chicken teriyaki plate",
                    "modifications": ["light sauce", "half rice", "extra salad"],
                    "estimated_macros": macros(),
                    "why": "Good protein, but sauce and rice need portion control.",
                },
                {
                    "name": "Poke-style bowl",
                    "modifications": ["extra protein", "light rice", "more greens", "sauce on the side"],
                    "estimated_macros": macros(),
                    "why": "Flexible macros if the restaurant offers bowls.",
                },
            ]

        if "protein" in goal or "cutting" in goal or "low calorie" in goal:
            return [
                {
                    "name": "Grilled lean protein plate",
                    "modifications": ["sauce on the side", "extra vegetables", "half starch portion"],
                    "estimated_macros": macros(),
                    "why": "Most reliable macro-friendly default.",
                },
                {
                    "name": "Protein bowl",
                    "modifications": ["extra protein", "light rice or noodles", "avoid creamy sauces"],
                    "estimated_macros": macros(),
                    "why": "Usually customizable enough for high protein and lower calories.",
                },
                {
                    "name": "Salad with grilled protein",
                    "modifications": ["dressing on the side", "add beans or egg if available", "skip fried toppings"],
                    "estimated_macros": macros(),
                    "why": "Lower-calorie fallback with decent protein.",
                },
            ]

        return [
            {
                "name": "Grilled protein with vegetables",
                "modifications": ["sauce on the side", "balanced starch portion", "extra vegetables"],
                "estimated_macros": macros(),
                "why": "Balanced and generally available across many cuisines.",
            },
            {
                "name": "Bowl with lean protein",
                "modifications": ["choose grilled protein", "light sauce", "add vegetables"],
                "estimated_macros": macros(),
                "why": "Flexible option for different goals.",
            },
            {
                "name": "Soup or salad plus protein side",
                "modifications": ["avoid creamy base", "add protein", "skip fried toppings"],
                "estimated_macros": macros(),
                "why": "Useful lower-calorie backup.",
            },
        ]

    def call_nemotron_text(
        self,
        messages: list[dict[str, Any]],
        max_tokens: int = 1200,
        temperature: float = 0.2,
        purpose: str = "unknown",
        route: str = "unknown",
        token_usage: list[dict[str, Any]] | None = None,
        retry: bool = False,
    ) -> str:
        if not self.client:
            raise RuntimeError("NVIDIA_API_KEY is missing.")

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            top_p=0.95,
            max_tokens=max_tokens,
            extra_body={
                "chat_template_kwargs": {
                    "enable_thinking": False,
                }
            },
        )
        record_token_usage(
            token_usage,
            response=response,
            purpose=purpose,
            model=self.model,
            route=route,
            retry=retry,
        )

        text = self.get_message_text(response)

        if not text:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                top_p=0.95,
                max_tokens=max_tokens,
            )
            record_token_usage(
                token_usage,
                response=response,
                purpose=f"{purpose}.retry_without_extra_body",
                model=self.model,
                route=route,
                retry=True,
            )
            text = self.get_message_text(response)

        if not text:
            raise RuntimeError("Nemotron returned empty content.")

        return text

    @staticmethod
    def get_message_text(response: Any) -> str:
        message = response.choices[0].message
        content = message.content

        if content is None:
            return ""
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        parts.append(item.get("text", ""))
                    elif "text" in item:
                        parts.append(str(item["text"]))
                else:
                    parts.append(str(item))
            return "\n".join(parts).strip()

        return str(content).strip()

    @staticmethod
    def extract_json_from_text(text: str) -> dict[str, Any]:
        cleaned = text.strip()
        fenced_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)

        if fenced_match:
            cleaned = fenced_match.group(1).strip()

        if not cleaned.startswith("{"):
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                cleaned = cleaned[start:end + 1]

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Nemotron occasionally returns Python-style dict literals on retries.
        # Try ast.literal_eval, then a more aggressive JSON-compat cleanup.
        try:
            parsed = ast.literal_eval(cleaned)
            if isinstance(parsed, dict):
                return json.loads(json.dumps(parsed))
        except (ValueError, SyntaxError):
            pass

        # Final cleanup: drop trailing commas, replace JS-only literals.
        cleaned2 = re.sub(r",\s*([\]}])", r"\1", cleaned)
        cleaned2 = re.sub(r"\b(Infinity|-Infinity|NaN|undefined)\b", "null", cleaned2)
        try:
            return json.loads(cleaned2)
        except json.JSONDecodeError as exc:
            raise json.JSONDecodeError(
                f"Model returned malformed JSON: {exc.msg}", cleaned, 0
            ) from exc
