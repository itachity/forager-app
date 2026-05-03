"""
Google Places API (v1) integration.

Uses `places:searchText` so the natural-language craving from the user message
drives the search ('cheap high-protein bowl', 'ramen near me', etc.).
Cuisine is never hardcoded.
"""

import math
import os
from typing import Any, Optional

import httpx


PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

FIELD_MASK = (
    "places.id,"
    "places.displayName,"
    "places.formattedAddress,"
    "places.rating,"
    "places.userRatingCount,"
    "places.priceLevel,"
    "places.googleMapsUri,"
    "places.location,"
    "places.businessStatus,"
    "places.currentOpeningHours,"
    "places.primaryType,"
    "places.types"
)

EARTH_RADIUS_MILES = 3958.8
MILES_TO_METERS = 1609.344


def _api_key() -> str:
    key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not key:
        raise RuntimeError(
            "GOOGLE_MAPS_API_KEY is not set. Add it to api/.env."
        )
    return key


def haversine_miles(
    lat1: float, lng1: float, lat2: float, lng2: float
) -> float:
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(a))


def search_text(
    query: str,
    latitude: float,
    longitude: float,
    radius_miles: float,
    *,
    open_now: bool = False,
    min_rating: Optional[float] = None,
    max_results: int = 10,
    timeout_seconds: float = 20.0,
) -> list[dict[str, Any]]:
    """
    Free-text Places search biased to a circle around (lat, lng).

    Returns the raw `places` array from the API plus a computed
    `distanceMiles` for each result. Ranking is left to ranking.py so this
    function stays a thin transport layer.
    """
    if not query or not query.strip():
        raise ValueError("query is empty; cannot search Places without a craving/keyword.")

    radius_meters = max(50.0, radius_miles * MILES_TO_METERS)

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": _api_key(),
        "X-Goog-FieldMask": FIELD_MASK,
    }

    payload: dict[str, Any] = {
        "textQuery": query,
        "maxResultCount": min(max(max_results, 1), 20),
        "locationBias": {
            "circle": {
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": radius_meters,
            }
        },
    }

    if open_now:
        payload["openNow"] = True

    if min_rating is not None:
        payload["minRating"] = min_rating

    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(PLACES_TEXT_SEARCH_URL, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    places = data.get("places", []) or []

    for place in places:
        loc = place.get("location") or {}
        place_lat = loc.get("latitude")
        place_lng = loc.get("longitude")
        if place_lat is not None and place_lng is not None:
            place["distanceMiles"] = haversine_miles(
                latitude, longitude, place_lat, place_lng
            )
        else:
            place["distanceMiles"] = None

    return places


def display_name(place: dict[str, Any]) -> str:
    return (place.get("displayName") or {}).get("text") or "Unknown"


def is_open_now(place: dict[str, Any]) -> Optional[bool]:
    hours = place.get("currentOpeningHours")
    if not hours:
        return None
    return hours.get("openNow")
