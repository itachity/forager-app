from __future__ import annotations

import os
from typing import Any

import httpx
from dotenv import load_dotenv

from cache import disk_cache


load_dotenv()

USDA_API_KEY = os.getenv("USDA_API_KEY")


def _require_usda_key() -> str:
    if not USDA_API_KEY:
        raise RuntimeError("Missing USDA_API_KEY in api/.env")
    return USDA_API_KEY


def normalize_energy_to_kcal(value: float, unit: str | None) -> str:
    if unit is None:
        return f"{value:.0f} kcal"

    normalized_unit = unit.strip().lower()

    if normalized_unit in ["kcal", "calorie", "calories"]:
        return f"{value:.0f} kcal"

    if normalized_unit in ["kj", "kilojoule", "kilojoules"]:
        kcal = value / 4.184
        return f"{kcal:.0f} kcal"

    return f"{value} {unit}"


def extract_macros(food: dict[str, Any]) -> dict[str, Any]:
    """
    Extract calories/protein/carbs/fat from USDA foodNutrients.

    USDA is reference data only. Do not treat this as exact restaurant nutrition.
    """
    macros = {
        "calories": None,
        "protein": None,
        "carbs": None,
        "fat": None,
    }

    energy_kj_backup = None

    for nutrient in food.get("foodNutrients", []):
        name = (nutrient.get("nutrientName") or "").lower()
        value = nutrient.get("value")
        unit = nutrient.get("unitName")

        if value is None:
            continue

        if "energy" in name:
            normalized_unit = (unit or "").strip().lower()

            if normalized_unit in ["kcal", "calorie", "calories"]:
                macros["calories"] = normalize_energy_to_kcal(float(value), unit)
            elif normalized_unit in ["kj", "kilojoule", "kilojoules"]:
                energy_kj_backup = normalize_energy_to_kcal(float(value), unit)
            elif macros["calories"] is None:
                macros["calories"] = normalize_energy_to_kcal(float(value), unit)

        elif "protein" in name and macros["protein"] is None:
            macros["protein"] = f"{float(value):.1f} {unit}"

        elif "carbohydrate" in name and macros["carbs"] is None:
            macros["carbs"] = f"{float(value):.1f} {unit}"

        elif ("total lipid" in name or name.strip() == "fat") and macros["fat"] is None:
            macros["fat"] = f"{float(value):.1f} {unit}"

    if macros["calories"] is None and energy_kj_backup is not None:
        macros["calories"] = energy_kj_backup

    return macros


@disk_cache(ttl_seconds=60 * 60 * 24)
def search_usda_foods(query: str, page_size: int = 5) -> dict[str, Any]:
    """
    Search USDA FoodData Central.

    Returns simplified macro references. The agent decides whether these are useful
    and how wide the final macro range should be.
    """
    api_key = _require_usda_key()
    page_size = max(1, min(page_size, 10))

    url = "https://api.nal.usda.gov/fdc/v1/foods/search"
    params = {"api_key": api_key}
    payload = {
        "query": query,
        "pageSize": page_size,
    }

    with httpx.Client(timeout=20.0) as client:
        response = client.post(url, params=params, json=payload)
        response.raise_for_status()
        data = response.json()

    results = []

    for food in data.get("foods", [])[:page_size]:
        results.append(
            {
                "fdcId": food.get("fdcId"),
                "description": food.get("description"),
                "dataType": food.get("dataType"),
                "brandOwner": food.get("brandOwner"),
                "servingSize": food.get("servingSize"),
                "servingSizeUnit": food.get("servingSizeUnit"),
                "householdServingFullText": food.get("householdServingFullText"),
                "macros": extract_macros(food),
            }
        )

    return {
        "query": query,
        "source": "USDA FoodData Central",
        "important_warning": (
            "USDA values are references only. They may be per 100 g, per serving, "
            "or from a branded/survey item. Do not treat them as exact restaurant meal macros."
        ),
        "results": results,
    }


def build_macro_queries(intent: dict[str, Any]) -> list[str]:
    """
    Builds USDA queries from the user's goal/craving/cuisine.

    The agent/Nemotron still decides final macro relevance and portion-size uncertainty.
    """
    cuisine = intent.get("cuisine") or ""
    craving = intent.get("craving") or ""
    macro_goal = intent.get("macro_goal") or ""

    raw_candidates = [
        craving,
        f"{cuisine} high protein meal",
        f"{cuisine} grilled chicken",
        f"{cuisine} bowl",
        macro_goal,
    ]

    queries = []

    for candidate in raw_candidates:
        candidate = " ".join(str(candidate).strip().split())

        if candidate and candidate.lower() not in [q.lower() for q in queries]:
            queries.append(candidate)

    if not queries:
        queries = [
            "grilled chicken",
            "chicken rice bowl",
            "lean beef vegetables",
        ]

    return queries[:3]


def get_macro_references(
    intent: dict[str, Any],
    page_size: int = 3,
    max_queries: int = 3,
) -> list[dict[str, Any]]:
    references = []

    queries = build_macro_queries(intent)[:max(1, max_queries)]

    for query in queries:
        try:
            references.append(search_usda_foods(query=query, page_size=page_size))
        except Exception as exc:
            references.append(
                {
                    "query": query,
                    "source": "USDA FoodData Central",
                    "error": str(exc),
                    "results": [],
                }
            )

    return references