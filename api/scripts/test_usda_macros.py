"""
Smoke test: USDA FoodData Central macro lookup.

Run from api/:
    python scripts/test_usda_macros.py

Optional:
    python scripts/test_usda_macros.py --query "chicken burrito bowl"
    python scripts/test_usda_macros.py --query "grilled chicken taco" --limit 5
"""

import argparse
import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv


API_DIR = Path(__file__).resolve().parents[1]
load_dotenv(API_DIR / ".env")

USDA_API_KEY = os.getenv("USDA_API_KEY")

if not USDA_API_KEY:
    raise RuntimeError("Missing USDA_API_KEY in api/.env")


def extract_macros(food: dict[str, Any]) -> dict[str, str | None]:
    macros = {
        "calories": None,
        "protein": None,
        "carbs": None,
        "fat": None,
    }

    for nutrient in food.get("foodNutrients", []):
        name = (nutrient.get("nutrientName") or "").lower()
        value = nutrient.get("value")
        unit = nutrient.get("unitName")

        if value is None:
            continue

        if "energy" in name and macros["calories"] is None:
            macros["calories"] = f"{value} {unit}"
        elif "protein" in name and macros["protein"] is None:
            macros["protein"] = f"{value} {unit}"
        elif "carbohydrate" in name and macros["carbs"] is None:
            macros["carbs"] = f"{value} {unit}"
        elif ("total lipid" in name or name.strip() == "fat") and macros["fat"] is None:
            macros["fat"] = f"{value} {unit}"

    return macros


def search_usda(query: str, limit: int) -> list[dict[str, Any]]:
    url = "https://api.nal.usda.gov/fdc/v1/foods/search"
    params = {"api_key": USDA_API_KEY}
    payload = {
        "query": query,
        "pageSize": min(max(limit, 1), 25),
    }

    with httpx.Client(timeout=20.0) as http:
        response = http.post(url, params=params, json=payload)
        response.raise_for_status()
        data = response.json()

    return data.get("foods", [])


def print_macro_results(query: str, foods: list[dict[str, Any]]) -> None:
    print("\n=== USDA MACRO LOOKUP ===")
    print(f"Query: {query}")
    print("Note: USDA results are nutrition references, not exact restaurant meal macros.")

    if not foods:
        print("No USDA results found.")
        return

    for index, food in enumerate(foods, start=1):
        macros = extract_macros(food)

        print(f"\n#{index}: {food.get('description', 'Unknown food')}")
        print(f"FDC ID: {food.get('fdcId')}")
        print(f"Data type: {food.get('dataType')}")
        print(f"Brand: {food.get('brandOwner', 'N/A')}")
        print(f"Calories: {macros['calories']}")
        print(f"Protein: {macros['protein']}")
        print(f"Carbs: {macros['carbs']}")
        print(f"Fat: {macros['fat']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--query",
        default="chicken burrito bowl",
        help="Meal or food to search in USDA FoodData Central.",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Number of USDA results to show.",
    )

    args = parser.parse_args()

    foods = search_usda(args.query, args.limit)
    print_macro_results(args.query, foods)