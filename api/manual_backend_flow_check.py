"""
Manual backend flow checker for Forager API.

Usage:
  python api/manual_backend_flow_check.py --base-url http://localhost:8000 --message "cheap high protein near me"

Optional for /analyze-menu:
  python api/manual_backend_flow_check.py --menu-image api/sample_menu.jpg --goal "high protein under 800 calories"
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import httpx


DEFAULT_PROFILE: dict[str, Any] = {
    "id": "guest-demo-user",
    "authUserId": None,
    "displayName": "Demo Guest",
    "email": None,
    "profileMode": "guest",
    "dietary": {
        "allergens": ["peanut"],
        "avoidIngredients": ["shellfish"],
        "dietRules": {
            "halal": False,
            "kosher": False,
            "vegetarian": False,
            "vegan": False,
            "pescatarian": False,
            "glutenFree": False,
            "dairyFree": False,
            "nutFree": True,
        },
        "spiceTolerance": "mild",
    },
    "preferences": {
        "budget": "cheap",
        "maxDistanceMiles": 3,
        "likedCuisines": ["japanese", "mexican"],
        "dislikedCuisines": ["french"],
        "likedFoods": ["bowl", "ramen"],
        "dislikedFoods": ["donut"],
        "preferredOrderTerms": ["grilled", "high protein"],
        "avoidOrderTerms": ["fried"],
    },
    "nutritionGoals": {
        "goalType": "high_protein",
        "caloriesMax": 800,
        "caloriesMin": None,
        "proteinMinGrams": 40,
        "carbsMaxGrams": None,
        "fatMaxGrams": None,
    },
    "language": {
        "preferredLanguage": "en",
        "explainCulturalNorms": True,
    },
    "privacy": {
        "saveLocationHistory": False,
        "saveMealHistory": False,
        "useProfileForRecommendations": True,
    },
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a manual API backend flow check.")
    parser.add_argument("--base-url", default="http://localhost:8000", help="FastAPI base URL")
    parser.add_argument("--message", default="cheap high protein near me", help="Chat message")
    parser.add_argument("--city", default="Corvallis")
    parser.add_argument("--country", default="US")
    parser.add_argument("--lat", type=float, default=None)
    parser.add_argument("--lng", type=float, default=None)
    parser.add_argument("--goal", default="high protein under 800 calories")
    parser.add_argument("--menu-image", default=None, help="Optional path to menu image file")
    return parser.parse_args()


def run_chat(client: httpx.Client, args: argparse.Namespace) -> dict[str, Any]:
    payload = {
        "message": args.message,
        "user_profile": DEFAULT_PROFILE,
        "location": {
            "lat": args.lat,
            "lng": args.lng,
            "city": args.city,
            "country": args.country,
        },
    }

    response = client.post("/chat", json=payload)
    response.raise_for_status()
    return response.json()


def run_analyze_menu(client: httpx.Client, args: argparse.Namespace) -> dict[str, Any] | None:
    if not args.menu_image:
        return None

    menu_path = Path(args.menu_image)
    if not menu_path.exists():
        raise FileNotFoundError(f"Menu image not found: {menu_path}")

    with menu_path.open("rb") as f:
        files = {"file": (menu_path.name, f, "image/jpeg")}
        data = {"goal": args.goal}
        response = client.post("/analyze-menu", files=files, data=data)

    response.raise_for_status()
    return response.json()


def main() -> None:
    args = parse_args()

    with httpx.Client(base_url=args.base_url, timeout=120.0) as client:
        print("=== Checking /health ===")
        health = client.get("/health")
        health.raise_for_status()
        print(json.dumps(health.json(), indent=2))

        print("\n=== Checking /chat ===")
        chat_result = run_chat(client, args)
        print(json.dumps(chat_result, indent=2, ensure_ascii=False))

        if args.menu_image:
            print("\n=== Checking /analyze-menu ===")
            menu_result = run_analyze_menu(client, args)
            print(json.dumps(menu_result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
