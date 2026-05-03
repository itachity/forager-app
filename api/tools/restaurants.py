from __future__ import annotations

import math
import os
import re
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


def _safe_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _place_text(place: dict[str, Any]) -> str:
    return " ".join(
        [
            str(place.get("name") or ""),
            str(place.get("primaryType") or ""),
            " ".join(_safe_list(place.get("types"))),
            str(place.get("address") or ""),
        ]
    ).lower()


def _count_matches(terms: list[str], text: str) -> int:
    return sum(1 for term in terms if str(term).lower() in text)


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
    Returns 0 to 1. Prevents a 5-star restaurant with 2 reviews from
    automatically beating a 4.7-star restaurant with 800 reviews.
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


def hard_filter_by_distance(
    places: list[dict[str, Any]],
    radius_meters: float,
) -> list[dict[str, Any]]:
    """Google Text Search uses locationBias, not a hard radius."""
    radius_miles = radius_meters / 1609.344
    filtered = []

    for place in places:
        distance = place.get("distanceMiles")
        if distance is None or distance <= radius_miles:
            filtered.append(place)

    return filtered


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
    """
    Uses cuisine, craving, liked/disliked cuisines, liked/disliked foods, and
    user order terms. This remains a restaurant-level signal, not exact menu fit.
    """
    cuisine = (intent.get("cuisine") or "").lower()
    craving = (intent.get("craving") or "").lower()
    text = _place_text(place)

    liked_cuisines = [c.lower() for c in _safe_list(intent.get("liked_cuisines"))]
    disliked_cuisines = [c.lower() for c in _safe_list(intent.get("disliked_cuisines"))]
    liked_foods = [f.lower() for f in _safe_list(intent.get("liked_foods"))]
    disliked_foods = [f.lower() for f in _safe_list(intent.get("disliked_foods"))]
    preferred_terms = [t.lower() for t in _safe_list(intent.get("preferred_order_terms"))]
    avoid_terms = [t.lower() for t in _safe_list(intent.get("avoid_order_terms"))]

    score = 0.65

    if cuisine and cuisine in text:
        score += 0.25
    elif cuisine and any(word in text for word in cuisine.split()):
        score += 0.12

    # Craving can be a full sentence, so ignore common filler words.
    craving_words = [
        word for word in re_split_words(craving)
        if len(word) >= 4 and word not in {"food", "meal", "good", "right", "now", "find"}
    ]
    if craving_words:
        score += min(sum(1 for word in craving_words if word in text) * 0.03, 0.12)

    score += min(_count_matches(liked_cuisines, text) * 0.08, 0.18)
    score -= min(_count_matches(disliked_cuisines, text) * 0.12, 0.25)
    score += min(_count_matches(liked_foods, text) * 0.06, 0.15)
    score -= min(_count_matches(disliked_foods, text) * 0.10, 0.25)
    score += min(_count_matches(preferred_terms, text) * 0.06, 0.12)
    score -= min(_count_matches(avoid_terms, text) * 0.10, 0.20)

    return max(0.0, min(score, 1.0))


def re_split_words(text: str) -> list[str]:
    return [part for part in text.replace("/", " ").replace("-", " ").split() if part]


def macro_fit_score(intent: dict[str, Any], place: dict[str, Any]) -> float:
    """
    Profile-aware restaurant-level macro heuristic.

    It does not claim exact macros. It estimates whether the place is likely to
    support the user's nutrition goal and order preferences.
    """
    goal_text = " ".join(
        [
            str(intent.get("macro_goal") or ""),
            str(intent.get("nutrition_goal_type") or ""),
            str(intent.get("message") or ""),
            str(intent.get("craving") or ""),
        ]
    ).lower()

    text = _place_text(place)
    score = 0.5

    # User goal signals.
    if any(term in goal_text for term in ["high protein", "protein", "bulking"]):
        score += 0.12
    if any(term in goal_text for term in ["low calorie", "cutting", "healthy", "light", "under"]):
        score += 0.10
    if any(term in goal_text for term in ["low carb", "keto"]):
        score += 0.07
    if any(term in goal_text for term in ["balanced", "maintenance"]):
        score += 0.04

    # Restaurant/type signals.
    protein_friendly_terms = [
        "grill", "grilled", "bbq", "steak", "chicken", "fish", "seafood",
        "poke", "mediterranean", "mexican", "japanese", "korean", "thai",
        "vietnamese", "salad", "bowl", "sushi", "teriyaki", "kebab",
        "taco", "burrito", "protein",
    ]
    calorie_risk_terms = [
        "dessert", "bakery", "donut", "ice cream", "pizza", "burger", "fried",
        "wings", "fast food", "cake", "cookie", "waffle", "pancake", "boba",
    ]
    carb_heavy_terms = ["ramen", "noodle", "pasta", "rice", "bakery", "pizza", "bagel"]
    fat_heavy_terms = ["fried", "cream", "cheese", "burger", "wings", "bbq"]

    score += min(_count_matches(protein_friendly_terms, text) * 0.025, 0.16)

    if intent.get("calories_max") or "low calorie" in goal_text or "cutting" in goal_text:
        score -= min(_count_matches(calorie_risk_terms, text) * 0.04, 0.16)

    if intent.get("carbs_max_grams") or "low carb" in goal_text:
        score -= min(_count_matches(carb_heavy_terms, text) * 0.05, 0.18)

    if intent.get("fat_max_grams"):
        score -= min(_count_matches(fat_heavy_terms, text) * 0.04, 0.16)

    # User-specific foods/order terms.
    liked_foods = [f.lower() for f in _safe_list(intent.get("liked_foods"))]
    disliked_foods = [f.lower() for f in _safe_list(intent.get("disliked_foods"))]
    preferred_terms = [t.lower() for t in _safe_list(intent.get("preferred_order_terms"))]
    avoid_terms = [t.lower() for t in _safe_list(intent.get("avoid_order_terms"))]
    restrictions = [t.lower() for t in _safe_list(intent.get("dietary_restrictions"))]
    allergies = [t.lower() for t in _safe_list(intent.get("allergies"))]

    score += min(_count_matches(liked_foods, text) * 0.05, 0.12)
    score -= min(_count_matches(disliked_foods, text) * 0.08, 0.18)
    score += min(_count_matches(preferred_terms, text) * 0.05, 0.12)
    score -= min(_count_matches(avoid_terms, text) * 0.08, 0.18)

    # Restrictions/allergens are weak at restaurant-name level. Penalize obvious
    # conflicts, but do not hard-delete because menus may have alternatives.
    score -= min(_count_matches(restrictions, text) * 0.07, 0.18)
    score -= min(_count_matches(allergies, text) * 0.10, 0.25)

    # Numeric goals mean the user cares more about macro controllability.
    if intent.get("protein_min_grams"):
        score += 0.05
    if intent.get("calories_max"):
        score += 0.03
    if intent.get("carbs_max_grams"):
        score += 0.03
    if intent.get("fat_max_grams"):
        score += 0.03

    return max(0.0, min(score, 1.0))


def community_score_for_place(place: dict[str, Any], community_by_name: dict[str, Any]) -> float:
    """
    Real community sentiment should come from Reddit/local sources.
    If no community signal exists, return neutral 0.5.
    """
    if not community_by_name:
        return 0.5

    place_name = str(place.get("name") or "").lower()
    for known_name, signal in community_by_name.items():
        known_name_lower = str(known_name).lower()
        if known_name_lower in place_name or place_name in known_name_lower:
            try:
                return max(0.0, min(float(signal.get("score", 0.5)), 1.0))
            except (TypeError, ValueError):
                return 0.5
    return 0.5


def compute_total_score(
    place: dict[str, Any],
    intent: dict[str, Any],
    community_by_name: dict[str, Any] | None = None,
    radius_meters: float = 5000,
) -> dict[str, Any]:
    community_by_name = community_by_name or {}
    components = {
        "restaurant_rating": bayesian_rating_score(place.get("rating"), place.get("reviewCount")),
        "community_sentiment": community_score_for_place(place, community_by_name),
        "distance": distance_score(place.get("distanceMiles"), radius_meters),
        "price": price_score(place.get("priceLevel"), intent.get("budget")),
        "macro_fit": macro_fit_score(intent, place),
        "preference_match": preference_match_score(place, intent),
        "availability": availability_score(place.get("openNow")),
    }

    active_weights = dict(SCORE_WEIGHTS)
    total_weight = sum(active_weights.values()) or 1.0
    weighted_score = sum(components[name] * active_weights[name] for name in active_weights) / total_weight

    return {
        "total": round(weighted_score * 100, 2),
        "components": {name: round(value * 100, 2) for name, value in components.items()},
        "weights": {name: round(value, 4) for name, value in active_weights.items()},
    }


def _tokenize_for_review_matching(value: Any) -> set[str]:
    """Small dependency-free tokenizer for review relevance scoring."""
    text = str(value or "").lower()
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9'-]{2,}", text)
    stop_words = {
        "the", "and", "for", "with", "this", "that", "was", "were", "are",
        "you", "your", "they", "them", "have", "has", "had", "but", "not",
        "very", "really", "place", "food", "good", "great", "nice", "best",
        "order", "ordered", "restaurant", "time", "also", "always",
    }
    return {word for word in words if word not in stop_words}


def review_relevance_score(
    review_text: str,
    intent: dict[str, Any] | None = None,
    order_names: list[str] | None = None,
) -> float:
    """
    Score whether a Google review is useful for the food recommendation.

    Google reviews are restaurant-level, not guaranteed menu-item evidence. This
    keeps service-only or unrelated reviews from appearing as if they support a
    macro recommendation.
    """
    intent = intent or {}
    order_names = order_names or []

    text = review_text.lower()
    review_tokens = _tokenize_for_review_matching(text)
    score = 0.0

    cuisine = str(intent.get("cuisine") or "").lower()
    craving = str(intent.get("craving") or "").lower()
    macro_goal = str(intent.get("macro_goal") or "").lower()

    liked_foods = [item.lower() for item in _safe_list(intent.get("liked_foods"))]
    liked_cuisines = [item.lower() for item in _safe_list(intent.get("liked_cuisines"))]
    preferred_terms = [item.lower() for item in _safe_list(intent.get("preferred_order_terms"))]

    # Directly matching the eventual order suggestion is strongest when available.
    for order_name in order_names:
        order_lower = str(order_name or "").lower().strip()
        order_tokens = _tokenize_for_review_matching(order_lower)
        if order_lower and order_lower in text:
            score += 5.0
        score += 0.8 * len(order_tokens & review_tokens)

    # Match the user's search/craving and profile food preferences.
    craving_tokens = _tokenize_for_review_matching(craving)
    score += 0.45 * len(craving_tokens & review_tokens)

    if cuisine and cuisine in text:
        score += 1.25

    for item in liked_cuisines:
        if item and item in text:
            score += 0.75

    for item in liked_foods:
        if item and item in text:
            score += 1.0

    for item in preferred_terms:
        if item and item in text:
            score += 0.75

    # Food-quality and macro-relevant signals.
    food_quality_terms = [
        "fresh", "ripe", "flavor", "flavorful", "tasty", "delicious", "portion",
        "protein", "healthy", "light", "grilled", "lean", "bowl", "salad",
        "chicken", "steak", "fish", "veggie", "vegetable", "salsa", "beans",
        "rice", "fruit", "smoothie", "acai", "açaí", "poke", "sushi", "taco",
        "burrito", "burritos", "tacos", "soup", "noodles", "ramen",
    ]
    food_hits = sum(1 for term in food_quality_terms if term in text)
    score += 0.35 * food_hits

    if "protein" in macro_goal and "protein" in text:
        score += 1.5
    if "low calorie" in macro_goal and any(term in text for term in ["light", "healthy", "low calorie"]):
        score += 1.0

    # Service-only reviews are less useful beside a food/macro card.
    service_terms = [
        "staff", "service", "cashier", "employee", "worker", "manager", "polite",
        "friendly", "professional", "customer service",
    ]
    service_hits = sum(1 for term in service_terms if term in text)
    if service_hits and food_hits == 0:
        score -= 2.0

    # Do not highlight complaint quotes as supporting evidence.
    negative_terms = [
        "bad", "terrible", "cold", "stale", "bland", "slow", "rude", "overpriced",
        "soggy", "dry", "gross", "awful",
    ]
    score -= 0.75 * sum(1 for term in negative_terms if term in text)

    return score


def extract_review_quotes(
    raw_place: dict[str, Any],
    intent: dict[str, Any] | None = None,
    order_names: list[str] | None = None,
    max_quotes: int = 2,
    min_score: float = 1.25,
) -> list[str]:
    """
    Extract the most food-relevant Google review snippets.

    Returns an empty list when reviews are not relevant enough. No quote is
    better than a misleading service-only quote.
    """
    scored_quotes: list[tuple[float, str]] = []

    for review in raw_place.get("reviews", []) or []:
        text_obj = review.get("text") or review.get("originalText") or {}
        text = text_obj.get("text") if isinstance(text_obj, dict) else None

        if not text:
            continue

        cleaned = " ".join(str(text).split())
        if not cleaned:
            continue

        score = review_relevance_score(
            review_text=cleaned,
            intent=intent,
            order_names=order_names,
        )
        if score < min_score:
            continue

        if len(cleaned) > 180:
            cleaned = cleaned[:177].rstrip() + "..."

        scored_quotes.append((score, cleaned))

    scored_quotes.sort(key=lambda item: item[0], reverse=True)
    return [quote for _, quote in scored_quotes[:max_quotes]]


def normalize_place(
    raw_place: dict[str, Any],
    lat: float,
    lng: float,
    intent: dict[str, Any] | None = None,
) -> dict[str, Any]:
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
        "reviewQuotes": extract_review_quotes(raw_place, intent=intent),
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
    intent: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Uses Google Places Text Search because it handles open-ended queries better
    than strict Nearby Search types.
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
            "places.types,"
            "places.reviews"
        ),
    }

    payload = {
        "textQuery": query,
        "maxResultCount": max_results,
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius_meters,
            }
        },
    }

    with httpx.Client(timeout=20.0) as client:
        response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    return [normalize_place(place, lat=lat, lng=lng, intent=intent) for place in data.get("places", [])]


def build_restaurant_query(intent: dict[str, Any]) -> str:
    cuisine = intent.get("cuisine")
    craving = intent.get("craving")
    budget = intent.get("budget")
    macro_goal = intent.get("macro_goal")
    liked_cuisines = _safe_list(intent.get("liked_cuisines"))
    liked_foods = _safe_list(intent.get("liked_foods"))
    preferred_order_terms = _safe_list(intent.get("preferred_order_terms"))

    pieces = []
    if budget:
        pieces.append(str(budget))
    if macro_goal:
        pieces.append(str(macro_goal))
    if craving:
        pieces.append(str(craving))
    if cuisine:
        pieces.append(str(cuisine))
    elif liked_cuisines:
        pieces.append(" or ".join(liked_cuisines[:3]))
    if liked_foods:
        pieces.append(" ".join(liked_foods[:3]))
    if preferred_order_terms:
        pieces.append(" ".join(preferred_order_terms[:3]))

    pieces.append("restaurants")
    return " ".join(str(piece) for piece in pieces if str(piece).strip())


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
        intent=intent,
    )

    return score_existing_restaurants(
        places=places,
        intent=intent,
        community_by_name=community_by_name or {},
        radius_meters=radius_meters,
    )


def score_existing_restaurants(
    places: list[dict[str, Any]],
    intent: dict[str, Any],
    community_by_name: dict[str, Any] | None = None,
    radius_meters: float = 5000,
) -> list[dict[str, Any]]:
    """Re-score already fetched Google Places results without calling Google again."""
    filtered_places = hard_filter_by_distance(places=places, radius_meters=radius_meters)
    scored_places = []

    for place in filtered_places:
        place["score"] = compute_total_score(
            place=place,
            intent=intent,
            community_by_name=community_by_name or {},
            radius_meters=radius_meters,
        )
        scored_places.append(place)

    scored_places.sort(key=lambda item: item["score"]["total"], reverse=True)
    return scored_places
