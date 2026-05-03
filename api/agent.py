from __future__ import annotations
import asyncio
import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

from tools.macros import get_macro_references
from tools.menus import analyze_menu_image_bytes
from tools.restaurants import search_and_score_restaurants


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

        restaurant_result, macro_result = await asyncio.gather(
            fetch_restaurants(),
            fetch_macro_references(),
            return_exceptions=True,
        )

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
                "name": r.get("name"),
                "address": r.get("address"),
                "rating": r.get("rating"),
                "reviewCount": r.get("reviewCount"),
                "priceLevel": r.get("priceLevel"),
                "openNow": r.get("openNow"),
                "distanceMiles": r.get("distanceMiles"),
                "googleMapsUri": r.get("googleMapsUri"),
                "primaryType": r.get("primaryType"),
                "types": r.get("types", []),
                "reviewQuotes": r.get("reviewQuotes", []),
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
                    "8. If reviewQuotes are present, you may use at most one short quote in why. Do not fabricate quotes.\n"
                    "9. Review quotes only support restaurant vibe/quality, not macro accuracy.\n"
                    "10. sources_used must list real sources such as Google Places, USDA FoodData Central, Nemotron, and Forager scoring.\n"
                    "11. Respect profile_mode and use_profile from recommendation_context.\n\n"
                    "Return JSON only. No markdown.\n\n"
                    "Schema:\n"
                    "{\n"
                    '  "answer": "string",\n'
                    '  "recommendations": [\n'
                    "    {\n"
                    '      "rank": 1,\n'
                    '      "place": "string",\n'
                    '      "address": "string",\n'
                    '      "score": 0,\n'
                    '      "why": "string",\n'
                    '      "review_quotes": ["string"],\n'
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
                    '          "why": "string"\n'
                    "        }\n"
                    "      ],\n"
                    '      "tradeoffs": "string",\n'
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
                    "Do not collapse the restaurant into one order unless there is truly no reasonable alternative."
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
            parsed["tool_trace"] = tool_trace
            return self.normalize_chat_response(parsed, restaurants, intent)
        except Exception as exc:
            fallback = self.fallback_final_answer(
                intent=intent,
                restaurants=restaurants,
                macro_references=macro_references,
                tool_trace=tool_trace,
            )
            fallback["limitations"].append(f"Nemotron synthesis failed: {exc}")
            return fallback

    def normalize_chat_response(
        self,
        parsed: dict[str, Any],
        restaurants: list[dict[str, Any]],
        intent: dict[str, Any],
    ) -> dict[str, Any]:
        """Keep response backward-compatible while adding order_suggestions."""
        recs = parsed.get("recommendations")
        if not isinstance(recs, list):
            parsed["recommendations"] = []
            return parsed

        restaurant_by_name = {
            str(r.get("name") or "").lower(): r for r in restaurants
        }

        for rec in recs:
            if not isinstance(rec, dict):
                continue

            place_name = str(rec.get("place") or "").lower()
            source_restaurant = restaurant_by_name.get(place_name, {})
            if not rec.get("review_quotes"):
                rec["review_quotes"] = source_restaurant.get("reviewQuotes", [])[:2]

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
            if not rec.get("order") and suggestions:
                first = suggestions[0]
                if isinstance(first, dict):
                    rec["order"] = first.get("name") or ""
                    macros = _safe_dict(first.get("estimated_macros"))
                    rec["estimated_macros"] = macros

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
                    "review_quotes": restaurant.get("reviewQuotes", [])[:2],
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
                    "review_quotes": [],
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
            retry=False,
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

        return json.loads(cleaned)
