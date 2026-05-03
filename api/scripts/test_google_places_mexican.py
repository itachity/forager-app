"""
Smoke test: Google Places API for best Mexican restaurants near current location.

Run from api/:
    python scripts/test_google_places_mexican.py

Optional:
    python scripts/test_google_places_mexican.py --lat 44.5646 --lng -123.2620 --radius 5000

Notes:
- Command-line Python cannot magically access browser GPS.
- This script uses CURRENT_LAT and CURRENT_LNG from api/.env.
- If not set, it defaults near OSU / Corvallis.
"""

import argparse
import math
import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv


API_DIR = Path(__file__).resolve().parents[1]
load_dotenv(API_DIR / ".env")

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

if not GOOGLE_MAPS_API_KEY:
    raise RuntimeError("Missing GOOGLE_MAPS_API_KEY in api/.env")


def safe_get_name(place: dict[str, Any]) -> str:
    return place.get("displayName", {}).get("text", "Unknown name")


def bayesian_score(rating: float | None, review_count: int | None) -> float:
    """
    Basic ranking so a 5.0-star place with 3 reviews does not automatically beat
    a 4.6-star place with 900 reviews.
    """
    if rating is None:
        rating = 0.0
    if review_count is None:
        review_count = 0

    global_average = 4.0
    minimum_reviews_weight = 100

    return (
        (review_count / (review_count + minimum_reviews_weight)) * rating
        + (minimum_reviews_weight / (review_count + minimum_reviews_weight)) * global_average
    )


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_miles = 3958.8

    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )

    return 2 * radius_miles * math.asin(math.sqrt(a))


def search_mexican_places(lat: float, lng: float, radius_meters: float, limit: int) -> list[dict[str, Any]]:
    url = "https://places.googleapis.com/v1/places:searchNearby"

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": (
            "places.displayName,"
            "places.formattedAddress,"
            "places.rating,"
            "places.userRatingCount,"
            "places.priceLevel,"
            "places.googleMapsUri,"
            "places.location,"
            "places.businessStatus,"
            "places.currentOpeningHours,"
            "places.primaryType"
        ),
    }

    payload = {
        "includedPrimaryTypes": ["mexican_restaurant"],
        "maxResultCount": min(max(limit, 1), 20),
        "rankPreference": "POPULARITY",
        "locationRestriction": {
            "circle": {
                "center": {
                    "latitude": lat,
                    "longitude": lng,
                },
                "radius": radius_meters,
            }
        },
    }

    with httpx.Client(timeout=20.0) as http:
        response = http.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    places = data.get("places", [])

    for place in places:
        rating = place.get("rating")
        review_count = place.get("userRatingCount", 0)
        place_location = place.get("location", {})
        place_lat = place_location.get("latitude")
        place_lng = place_location.get("longitude")

        place["foragerScore"] = bayesian_score(rating, review_count)

        if place_lat is not None and place_lng is not None:
            place["distanceMiles"] = haversine_miles(lat, lng, place_lat, place_lng)
        else:
            place["distanceMiles"] = None

    places.sort(
        key=lambda p: (
            p.get("foragerScore", 0),
            p.get("rating", 0),
            p.get("userRatingCount", 0),
        ),
        reverse=True,
    )

    return places


def print_results(places: list[dict[str, Any]], lat: float, lng: float) -> None:
    print("\n=== GOOGLE PLACES: BEST MEXICAN RESTAURANTS ===")
    print(f"Search center: lat={lat}, lng={lng}")

    if not places:
        print("No Mexican restaurants found. Try increasing --radius.")
        return

    for index, place in enumerate(places, start=1):
        name = safe_get_name(place)
        address = place.get("formattedAddress", "No address")
        rating = place.get("rating", "N/A")
        review_count = place.get("userRatingCount", "N/A")
        price = place.get("priceLevel", "N/A")
        maps_url = place.get("googleMapsUri", "N/A")
        open_now = place.get("currentOpeningHours", {}).get("openNow", "unknown")
        distance = place.get("distanceMiles")

        if distance is not None:
            distance_text = f"{distance:.2f} mi"
        else:
            distance_text = "N/A"

        print(f"\n#{index}: {name}")
        print(f"Address: {address}")
        print(f"Rating: {rating} stars ({review_count} reviews)")
        print(f"Price level: {price}")
        print(f"Open now: {open_now}")
        print(f"Distance: {distance_text}")
        print(f"Forager score: {place.get('foragerScore', 0):.3f}")
        print(f"Google Maps: {maps_url}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--lat",
        type=float,
        default=float(os.getenv("CURRENT_LAT", "44.5646")),
        help="Latitude. Defaults to CURRENT_LAT from api/.env or OSU/Corvallis.",
    )

    parser.add_argument(
        "--lng",
        type=float,
        default=float(os.getenv("CURRENT_LNG", "-123.2620")),
        help="Longitude. Defaults to CURRENT_LNG from api/.env or OSU/Corvallis.",
    )

    parser.add_argument(
        "--radius",
        type=float,
        default=5000,
        help="Search radius in meters. Default: 5000.",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Max results, 1 to 20. Default: 10.",
    )

    args = parser.parse_args()

    results = search_mexican_places(
        lat=args.lat,
        lng=args.lng,
        radius_meters=args.radius,
        limit=args.limit,
    )

    print_results(results, args.lat, args.lng)