from __future__ import annotations

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


def _safe_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def profile_budget(user_profile: dict[str, Any]) -> str | None:
    preferences = user_profile.get("preferences")
    if isinstance(preferences, dict):
        budget = preferences.get("budget")
        if isinstance(budget, str) and budget.strip() and budget.strip().lower() != "any":
            return budget.strip().lower()

    budget = user_profile.get("budget")
    if isinstance(budget, str) and budget.strip() and budget.strip().lower() != "any":
        return budget.strip().lower()

    return None


def profile_radius_meters(user_profile: dict[str, Any]) -> float:
    preferences = user_profile.get("preferences")
    if isinstance(preferences, dict):
        max_distance = preferences.get("maxDistanceMiles")
        if isinstance(max_distance, (int, float)) and max_distance > 0:
            return float(max_distance) * 1609.344

    radius = user_profile.get("radius_meters")
    if isinstance(radius, (int, float)) and radius > 0:
        return float(radius)

    return 5000.0




def profile_order_terms(user_profile: dict[str, Any]) -> tuple[list[str], list[str]]:
    preferences = user_profile.get("preferences") if isinstance(user_profile.get("preferences"), dict) else {}
    preferred = _safe_list(preferences.get("preferredOrderTerms"))
    avoid = _safe_list(preferences.get("avoidOrderTerms"))
    return preferred, avoid

def profile_dietary_lists(user_profile: dict[str, Any]) -> tuple[list[str], list[str]]:
    dietary = user_profile.get("dietary") if isinstance(user_profile.get("dietary"), dict) else {}
    restrictions = _safe_list(user_profile.get("dietary_restrictions"))
    restrictions.extend(_safe_list(dietary.get("avoidIngredients")))

    diet_rules = dietary.get("dietRules") if isinstance(dietary.get("dietRules"), dict) else {}
    for key, enabled in diet_rules.items():
        if enabled is True:
            restrictions.append(str(key))

    restrictions = list(dict.fromkeys([r for r in restrictions if r]))
    allergies = _safe_list(user_profile.get("allergies"))
    allergies.extend(_safe_list(dietary.get("allergens")))
    allergies = list(dict.fromkeys([a for a in allergies if a]))
    return restrictions, allergies


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

        tool_trace: list[dict[str, Any]] = []

        intent = self.extract_intent(
            message=message,
            user_profile=user_profile,
            location=location,
        )

        tool_trace.append(
            {
                "tool": "nvidia_nemotron_intent_extraction",
                "status": "ok",
                "output": intent,
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

        restaurants: list[dict[str, Any]] = []
        community_by_name: dict[str, Any] = {}

        if resolved_location.get("lat") is not None and resolved_location.get("lng") is not None:
            lat = float(resolved_location["lat"])
            lng = float(resolved_location["lng"])

            # First pass: Google restaurants with neutral community signal.
            restaurants = search_and_score_restaurants(
                intent=intent,
                lat=lat,
                lng=lng,
                community_by_name={},
                radius_meters=float(intent.get("radius_meters") or 5000),
                max_results=20,
            )

            tool_trace.append(
                {
                    "tool": "google_places_restaurant_search",
                    "status": "ok",
                    "count": len(restaurants),
                }
            )

            # Second pass: scoring with neutral community signal (Reddit removed).
            restaurants = search_and_score_restaurants(
                intent=intent,
                lat=lat,
                lng=lng,
                community_by_name=community_by_name,
                radius_meters=float(intent.get("radius_meters") or 5000),
                max_results=20,
            )

            tool_trace.append(
                {
                    "tool": "forager_weighted_ranking",
                    "status": "ok",
                    "weights": {
                        "restaurant_rating": "20%",
                        "community_sentiment": "15%",
                        "distance": "10%",
                        "price": "10%",
                        "macro_fit": "10%",
                        "preference_match": "15%",
                        "availability": "20%",
                    },
                }
            )

        else:
            tool_trace.append(
                {
                    "tool": "google_places_restaurant_search",
                    "status": "skipped",
                    "reason": "No lat/lng provided and no DEFAULT_LAT/DEFAULT_LNG set in api/.env.",
                }
            )

        macro_references = get_macro_references(intent=intent, page_size=3)

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
            location=resolved_location,
            intent=intent,
            restaurants=restaurants[:20],
            macro_references=macro_references,
            tool_trace=tool_trace,
        )

        return final

    async def analyze_menu_upload(
        self,
        image_bytes: bytes,
        filename: str,
        goal: str,
    ) -> dict[str, Any]:
        try:
            result = analyze_menu_image_bytes(
                image_bytes=image_bytes,
                filename=filename,
                goal=goal,
            )

            return {
                "status": "ok",
                **result,
            }

        except Exception as exc:
            return {
                "status": "error",
                "filename": filename,
                "error": str(exc),
                "tools_used": [
                    "nvidia_nemotron_vision",
                    "usda_fooddata_central",
                ],
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
        lat = request_location.get("lat")
        lng = request_location.get("lng")

        if lat is None:
            lat = intent.get("lat")

        if lng is None:
            lng = intent.get("lng")

        if lat is None and DEFAULT_LAT:
            lat = DEFAULT_LAT

        if lng is None and DEFAULT_LNG:
            lng = DEFAULT_LNG

        city = (
            request_location.get("city")
            or intent.get("city")
            or DEFAULT_CITY
        )

        country = (
            request_location.get("country")
            or intent.get("country")
            or DEFAULT_COUNTRY
        )

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
    ) -> dict[str, Any]:
        """
        Nemotron extracts intent. Fallback parser keeps app alive if model/API fails.
        """
        fallback = self.fallback_intent_parser(
            message=message,
            user_profile=user_profile,
            location=location,
        )

        if not self.client:
            return fallback

        messages = [
            {
                "role": "system",
                "content": (
                    "You extract food recommendation intent for Forager. "
                    "Return ONLY valid JSON. No markdown.\n\n"
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
                    "}\n\n"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"User message:\n{message}\n\n"
                    f"User profile:\n{json.dumps(user_profile, indent=2)}\n\n"
                    f"Location:\n{json.dumps(location, indent=2)}"
                ),
            },
        ]

        try:
            text = self.call_nemotron_text(messages=messages, max_tokens=1000, temperature=0.1)
            parsed = self.extract_json_from_text(text)

            return {
                **fallback,
                **parsed,
                "message": message,
            }

        except Exception:
            return fallback

    def fallback_intent_parser(
        self,
        message: str,
        user_profile: dict[str, Any],
        location: dict[str, Any],
    ) -> dict[str, Any]:
        text = message.lower()

        cuisine = None

        for candidate in [
            "mexican",
            "japanese",
            "korean",
            "thai",
            "chinese",
            "indian",
            "mediterranean",
            "vietnamese",
            "italian",
            "american",
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

        macro_goal = None

        if "high protein" in text or "protein" in text:
            macro_goal = "high protein"

        if "low calorie" in text or "under" in text or "healthy" in text:
            macro_goal = f"{macro_goal or ''} low calorie healthy".strip()

        max_calories = None
        calorie_match = re.search(r"under\s+(\d+)\s*(?:cal|calories|kcal)?", text)

        if calorie_match:
            max_calories = int(calorie_match.group(1))

        city = location.get("city") or user_profile.get("city")
        country = location.get("country") or user_profile.get("country")
        budget_from_profile = profile_budget(user_profile)
        dietary_restrictions, allergies = profile_dietary_lists(user_profile)
        preferred_order_terms, avoid_order_terms = profile_order_terms(user_profile)

        fallback_intent = {
            "message": message,
            "cuisine": cuisine,
            "craving": message,
            "budget": budget or budget_from_profile,
            "macro_goal": macro_goal,
            "max_calories": max_calories,
            "dietary_restrictions": dietary_restrictions,
            "allergies": allergies,
            "city": city,
            "country": country,
            "lat": location.get("lat"),
            "lng": location.get("lng"),
            "radius_meters": profile_radius_meters(user_profile),
            "preferred_order_terms": preferred_order_terms,
            "avoid_order_terms": avoid_order_terms,
            "needs_restaurant_search": True,
            "needs_macro_estimate": True,
        }

        return fallback_intent

    def synthesize_final_answer(
        self,
        message: str,
        user_profile: dict[str, Any],
        location: dict[str, Any],
        intent: dict[str, Any],
        restaurants: list[dict[str, Any]],
        macro_references: list[dict[str, Any]],
        tool_trace: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Nemotron decides how relevant USDA macros are, estimates realistic portions
        based on city/country/restaurant context, and creates final recommendation.
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
                "score": r.get("score"),
            }
            for r in restaurants[:20]
        ]

        messages = [
            {
                "role": "system",
                "content": (
                    "You are Forager, an AI food decision assistant. "
                    "You compare restaurant options, price, distance, availability, "
                    "user preferences, and USDA macro references.\n\n"
                    "Critical rules:\n"
                    "1. USDA data is only reference data. It may lack portion size or not match restaurant food.\n"
                    "2. You must decide whether USDA data is relevant or weak.\n"
                    "3. Estimate realistic restaurant portion size using cuisine, city/country, price level, and dish type.\n"
                    "4. Give macro ranges, not exact values.\n"
                    "5. Clearly label confidence: high, medium, medium-low, or low.\n"
                    "6. Do not give medical advice.\n"
                    "7. If allergies are present, warn the user to verify with the restaurant.\n"
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
                    '      "order": "string",\n'
                    '      "estimated_macros": {\n'
                    '        "calories": "string",\n'
                    '        "protein": "string",\n'
                    '        "carbs": "string",\n'
                    '        "fat": "string",\n'
                    '        "confidence": "string"\n'
                    "      },\n"
                    '      "why": "string",\n'
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
                    f"User profile:\n{json.dumps(user_profile, indent=2)}\n\n"
                    f"Resolved location:\n{json.dumps(location, indent=2)}\n\n"
                    f"Extracted intent:\n{json.dumps(intent, indent=2)}\n\n"
                    f"Scored restaurants:\n{json.dumps(compact_restaurants, indent=2)}\n\n"
                    f"USDA macro references:\n{json.dumps(macro_references, indent=2)}\n\n"
                    f"Tool trace:\n{json.dumps(tool_trace, indent=2)}\n\n"
                    "Generate the final restaurant/order recommendations. "
                    "Usually return the top 3 recommendations."
                ),
            },
        ]

        try:
            text = self.call_nemotron_text(messages=messages, max_tokens=2500, temperature=0.2)
            parsed = self.extract_json_from_text(text)
            parsed["tool_trace"] = tool_trace
            return parsed

        except Exception as exc:
            fallback = self.fallback_final_answer(
                intent=intent,
                restaurants=restaurants,
                macro_references=macro_references,
                tool_trace=tool_trace,
            )
            fallback["limitations"].append(f"Nemotron synthesis failed: {exc}")
            return fallback

    def fallback_final_answer(
        self,
        intent: dict[str, Any],
        restaurants: list[dict[str, Any]],
        macro_references: list[dict[str, Any]],
        tool_trace: list[dict[str, Any]],
    ) -> dict[str, Any]:
        recommendations = []

        for index, restaurant in enumerate(restaurants[:3], start=1):
            recommendations.append(
                {
                    "rank": index,
                    "place": restaurant.get("name"),
                    "address": restaurant.get("address"),
                    "score": restaurant.get("score", {}).get("total"),
                    "order": self.generic_order_suggestion(intent),
                    "estimated_macros": {
                        "calories": "Estimate unavailable until Nemotron synthesis runs",
                        "protein": "Estimate unavailable until Nemotron synthesis runs",
                        "carbs": "Estimate unavailable until Nemotron synthesis runs",
                        "fat": "Estimate unavailable until Nemotron synthesis runs",
                        "confidence": "low",
                    },
                    "why": (
                        "This restaurant ranked well based on Google rating, distance, price, "
                        "availability, preference match, and macro-fit heuristic."
                    ),
                    "tradeoffs": "Macro estimate needs model synthesis and/or menu confirmation.",
                    "sources_used": [
                        "Google Places",
                        "Forager weighted scoring",
                        "USDA FoodData Central references",
                    ],
                    "google_maps_url": restaurant.get("googleMapsUri"),
                }
            )

        if not recommendations:
            recommendations.append(
                {
                    "rank": 1,
                    "place": None,
                    "address": None,
                    "score": None,
                    "order": self.generic_order_suggestion(intent),
                    "estimated_macros": {
                        "calories": "unknown",
                        "protein": "unknown",
                        "carbs": "unknown",
                        "fat": "unknown",
                        "confidence": "low",
                    },
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

    def generic_order_suggestion(self, intent: dict[str, Any]) -> str:
        cuisine = (intent.get("cuisine") or "").lower()
        goal = (intent.get("macro_goal") or "").lower()

        if "mexican" in cuisine:
            if "protein" in goal:
                return "Chicken or steak bowl/tacos with extra protein, beans, salsa, and sauce on the side"
            return "Tacos or bowl with grilled protein and vegetables"

        if "japanese" in cuisine:
            return "Grilled fish, sashimi, tofu, or lean meat dish with rice portion controlled"

        if "thai" in cuisine:
            return "Grilled chicken or tofu stir-fry with light sauce and rice portion controlled"

        return "Grilled lean protein with vegetables and sauce on the side"

    def call_nemotron_text(
        self,
        messages: list[dict[str, Any]],
        max_tokens: int = 1200,
        temperature: float = 0.2,
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

        text = self.get_message_text(response)

        if not text:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                top_p=0.95,
                max_tokens=max_tokens,
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