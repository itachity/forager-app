from __future__ import annotations

import math
import os
from typing import Any

import httpx
from dotenv import load_dotenv

from cache import disk_cache


load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


SCORE_WEIGHTS = {
    "restaurant_rating": 0.20,
    "community_sentiment": 0.15,
    "distance": 0.10,
    "price": 0.10,
    "macro_fit": 0.10,
    "preference_match": 0.15,
    "availability": 0.20,
}


PRICE_LEVEL_TO_NUMBER = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}


def _require_google_key() -> str:
    if not GOOGLE_MAPS_API_KEY:
        raise RuntimeError("Missing GOOGLE_MAPS_API_KEY in api/.env")
    return GOOGLE_MAPS_API_KEY


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


def bayesian_rating_score(rating: float | None, review_count: int | None) -> float:
    """
    Returns 0 to 1.

    Prevents a 5-star restaurant with 2 reviews from automatically beating
    a 4.7-star restaurant with 800 reviews.
    """
    if rating is None:
        return 0.0

    review_count = review_count or 0
    global_average = 4.0
    minimum_reviews_weight = 100

    bayesian_rating = (
        (review_count / (review_count + minimum_reviews_weight)) * rating
        + (minimum_reviews_weight / (review_count + minimum_reviews_weight)) * global_average
    )

    return max(0.0, min(bayesian_rating / 5.0, 1.0))


def distance_score(distance_miles: float | None, radius_meters: float) -> float:
    if distance_miles is None:
        return 0.5

    radius_miles = radius_meters / 1609.344

    if radius_miles <= 0:
        return 0.5

    return max(0.0, min(1.0 - (distance_miles / radius_miles), 1.0))


def price_score(price_level: str | None, budget: str | None) -> float:
    if not budget:
        return 0.7

    budget = budget.lower()
    numeric_price = PRICE_LEVEL_TO_NUMBER.get(price_level or "")

    if numeric_price is None:
        return 0.5

    if budget in ["cheap", "low", "budget", "inexpensive", "$"]:
        target = 1
    elif budget in ["moderate", "medium", "$$"]:
        target = 2
    elif budget in ["expensive", "high", "premium", "$$$"]:
        target = 3
    else:
        return 0.7

    diff = abs(numeric_price - target)

    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.65
    if diff == 2:
        return 0.35

    return 0.15


def availability_score(open_now: bool | None) -> float:
    if open_now is True:
        return 1.0

    if open_now is False:
        return 0.05

    return 0.5


def preference_match_score(place: dict[str, Any], intent: dict[str, Any]) -> float:
    cuisine = (intent.get("cuisine") or "").lower()
    craving = (intent.get("craving") or "").lower()

    text = " ".join(
        [
            str(place.get("name") or ""),
            str(place.get("primaryType") or ""),
            " ".join(place.get("types") or []),
        ]
    ).lower()

    if cuisine and cuisine in text:
        return 1.0

    if craving and any(word in text for word in craving.split()):
        return 0.85

    # If Google already found this from text query, keep a decent baseline.
    return 0.75


def macro_fit_score(intent: dict[str, Any], place: dict[str, Any]) -> float:
    """
    Lightweight, non-authoritative heuristic.

    Uses user intent signals and place metadata only, without assuming specific cuisines
    or fixed food taxonomies. Final macro reasoning should be done by the agent model.
    """
    goal_text = " ".join(
        [
            str(intent.get("macro_goal") or ""),
            str(intent.get("goal") or ""),
            str(intent.get("message") or ""),
            str(intent.get("craving") or ""),
        ]
    ).lower()

    place_tokens = {
        str(place.get("name") or "").lower(),
        str(place.get("primaryType") or "").lower(),
        *[str(token).lower() for token in (place.get("types") or [])],
    }
    place_text = " ".join(token for token in place_tokens if token)

    score = 0.5

    positive_goal_terms = ["protein", "lean", "healthy", "low calorie", "light", "under"]
    negative_goal_terms = ["dessert", "sweet", "fried", "indulgent"]

    positive_matches = sum(1 for term in positive_goal_terms if term in goal_text)
    negative_matches = sum(1 for term in negative_goal_terms if term in goal_text)

    score += min(positive_matches * 0.05, 0.2)
    score -= min(negative_matches * 0.05, 0.15)

    preferred_terms = [str(term).lower() for term in intent.get("preferred_order_terms", []) if term]
    avoid_terms = [str(term).lower() for term in intent.get("avoid_order_terms", []) if term]

    if preferred_terms:
        preferred_hits = sum(1 for term in preferred_terms if term in place_text)
        score += min(preferred_hits * 0.08, 0.16)

    if avoid_terms:
        avoid_hits = sum(1 for term in avoid_terms if term in place_text)
        score -= min(avoid_hits * 0.1, 0.2)

    return max(0.0, min(score, 1.0))


def community_score_for_place(place: dict[str, Any], community_by_name: dict[str, Any]) -> float:
    _ = community_by_name
    rating_signal = bayesian_rating_score(
        place.get("rating"),
        place.get("reviewCount"),
    )
    default_community_floor = 0.55
    return max(default_community_floor, rating_signal)


def compute_total_score(
    place: dict[str, Any],
    intent: dict[str, Any],
    community_by_name: dict[str, Any] | None = None,
    radius_meters: float = 5000,
) -> dict[str, Any]:
    community_by_name = community_by_name or {}

    components = {
        "restaurant_rating": bayesian_rating_score(
            place.get("rating"),
            place.get("reviewCount"),
        ),
        "community_sentiment": community_score_for_place(place, community_by_name),
        "distance": distance_score(place.get("distanceMiles"), radius_meters),
        "price": price_score(place.get("priceLevel"), intent.get("budget")),
        "macro_fit": macro_fit_score(intent, place),
        "preference_match": preference_match_score(place, intent),
        "availability": availability_score(place.get("openNow")),
    }

    active_weights = dict(SCORE_WEIGHTS)
    total_weight = sum(active_weights.values()) or 1.0
    weighted_score = sum(
        components[name] * active_weights[name]
        for name in active_weights
    ) / total_weight

    return {
        "total": round(weighted_score * 100, 2),
        "components": {
            name: round(value * 100, 2)
            for name, value in components.items()
        },
        "weights": {
            name: round(value, 4)
            for name, value in active_weights.items()
        },
    }


def normalize_place(raw_place: dict[str, Any], lat: float, lng: float) -> dict[str, Any]:
    location = raw_place.get("location") or {}
    place_lat = location.get("latitude")
    place_lng = location.get("longitude")

    distance_miles = None

    if place_lat is not None and place_lng is not None:
        distance_miles = haversine_miles(lat, lng, place_lat, place_lng)

    current_opening_hours = raw_place.get("currentOpeningHours") or {}

    return {
        "id": raw_place.get("id"),
        "name": (raw_place.get("displayName") or {}).get("text", "Unknown restaurant"),
        "address": raw_place.get("formattedAddress"),
        "rating": raw_place.get("rating"),
        "reviewCount": raw_place.get("userRatingCount"),
        "priceLevel": raw_place.get("priceLevel"),
        "openNow": current_opening_hours.get("openNow"),
        "businessStatus": raw_place.get("businessStatus"),
        "googleMapsUri": raw_place.get("googleMapsUri"),
        "primaryType": raw_place.get("primaryType"),
        "types": raw_place.get("types", []),
        "distanceMiles": round(distance_miles, 2) if distance_miles is not None else None,
        "raw": raw_place,
    }


@disk_cache(ttl_seconds=60 * 60)
def search_google_restaurants(
    query: str,
    lat: float,
    lng: float,
    radius_meters: float = 5000,
    max_results: int = 20,
) -> list[dict[str, Any]]:
    """
    Uses Google Places Text Search because it handles:
    - "best mexican"
    - "cheap high protein near me"
    - "ramen"
    better than strict Nearby Search types.
    """
    api_key = _require_google_key()
    max_results = max(1, min(max_results, 20))

    url = "https://places.googleapis.com/v1/places:searchText"

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
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
        ),
    }

    payload = {
        "textQuery": query,
        "maxResultCount": max_results,
        "locationBias": {
            "circle": {
                "center": {
                    "latitude": lat,
                    "longitude": lng,
                },
                "radius": radius_meters,
            }
        },
    }

    with httpx.Client(timeout=20.0) as client:
        response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    return [
        normalize_place(place, lat=lat, lng=lng)
        for place in data.get("places", [])
    ]


def build_restaurant_query(intent: dict[str, Any]) -> str:
    cuisine = intent.get("cuisine")
    craving = intent.get("craving")
    budget = intent.get("budget")
    macro_goal = intent.get("macro_goal")

    pieces = []

    if budget:
        pieces.append(str(budget))

    if macro_goal:
        pieces.append(str(macro_goal))

    if craving:
        pieces.append(str(craving))

    if cuisine:
        pieces.append(str(cuisine))

    pieces.append("restaurants")

    return " ".join(pieces)


def search_and_score_restaurants(
    intent: dict[str, Any],
    lat: float,
    lng: float,
    community_by_name: dict[str, Any] | None = None,
    radius_meters: float = 5000,
    max_results: int = 20,
) -> list[dict[str, Any]]:
    query = build_restaurant_query(intent)

    places = search_google_restaurants(
        query=query,
        lat=lat,
        lng=lng,
        radius_meters=radius_meters,
        max_results=max_results,
    )

    scored_places = []

    for place in places:
        place["score"] = compute_total_score(
            place=place,
            intent=intent,
            community_by_name=community_by_name or {},
            radius_meters=radius_meters,
        )
        scored_places.append(place)

    scored_places.sort(key=lambda item: item["score"]["total"], reverse=True)

    return scored_places
