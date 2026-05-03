"""
USDA FoodData Central macro lookup.

Returns nutrition reference data only. Per requirements doc NFR-002, callers
must label these values as approximate. Energy is normalized to kcal so a kJ
value never silently shows up as 'calories'.
"""

import os
from typing import Any, Optional

import httpx


USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"
KJ_PER_KCAL = 4.184


def _api_key() -> str:
    key = os.getenv("USDA_API_KEY")
    if not key:
        raise RuntimeError(
            "USDA_API_KEY is not set. Add it to api/.env."
        )
    return key


def _format_kcal(value: float) -> str:
    return f"{value:.0f} kcal"


def normalize_energy_to_kcal(value: float, unit: Optional[str]) -> str:
    if unit is None:
        return _format_kcal(value)

    normalized = unit.strip().lower()

    if normalized in {"kcal", "calorie", "calories"}:
        return _format_kcal(value)

    if normalized in {"kj", "kilojoule", "kilojoules"}:
        return _format_kcal(value / KJ_PER_KCAL)

    return f"{value} {unit}"


def extract_macros(food: dict[str, Any]) -> dict[str, Optional[str]]:
    """
    Pulls calories/protein/carbs/fat from a USDA food. Prefers kcal over kJ
    when both are present.
    """
    macros: dict[str, Optional[str]] = {
        "calories": None,
        "protein": None,
        "carbs": None,
        "fat": None,
    }
    energy_kj_backup: Optional[str] = None

    for nutrient in food.get("foodNutrients", []) or []:
        name = (nutrient.get("nutrientName") or "").lower()
        value = nutrient.get("value")
        unit = nutrient.get("unitName")

        if value is None:
            continue

        if "energy" in name:
            unit_lc = (unit or "").strip().lower()
            if unit_lc in {"kcal", "calorie", "calories"}:
                macros["calories"] = normalize_energy_to_kcal(float(value), unit)
            elif unit_lc in {"kj", "kilojoule", "kilojoules"}:
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


def search_foods(
    query: str,
    page_size: int = 3,
    *,
    timeout_seconds: float = 20.0,
) -> dict[str, Any]:
    """
    USDA FoodData Central search. Caller is responsible for treating the
    output as a reference, not an exact match for restaurant portions.
    """
    if not query or not query.strip():
        raise ValueError("USDA query is empty.")

    page_size = max(1, min(page_size, 25))

    params = {"api_key": _api_key()}
    payload = {"query": query, "pageSize": page_size}

    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(USDA_SEARCH_URL, params=params, json=payload)
        response.raise_for_status()
        data = response.json()

    foods: list[dict[str, Any]] = []
    for food in (data.get("foods") or [])[:page_size]:
        foods.append(
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
            "USDA values are nutrition references only. They may be per 100 g, "
            "per serving, or for a branded/survey item. They are not exact "
            "restaurant meal macros."
        ),
        "results": foods,
    }


def search_many(
    queries: list[str],
    page_size: int = 3,
) -> list[dict[str, Any]]:
    """
    Run several USDA searches and collect results. Per-query failures are
    surfaced inside the result entry rather than swallowed silently, so the
    caller can see which lookups succeeded.
    """
    results: list[dict[str, Any]] = []
    for query in queries:
        try:
            results.append(search_foods(query=query, page_size=page_size))
        except Exception as exc:
            results.append({"query": query, "error": str(exc)})
    return results
