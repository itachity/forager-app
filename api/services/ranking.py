"""
Restaurant ranking.

Implements a weighted score derived from the requirements doc §8 ranking
formula, normalized to drop factors we cannot compute at the restaurant level
(community sentiment, per-meal macro fit). Per-meal macro fit is handled later
by the Nemotron synthesis step.

All weights and tunables are explicit constants so nothing is magic.
"""

from typing import Any, Optional

from api.models import UserProfile
from api.services.places import display_name, is_open_now


# Bayesian prior for ratings: a 5.0/2-review place should not beat a 4.5/2000.
GLOBAL_AVG_RATING = 4.0
RATING_PRIOR_REVIEWS = 100

# Weights from requirements doc §8, with sentiment + macro-fit removed and the
# remaining factors renormalized. Update these here, not in callers.
WEIGHT_RATING = 26.67       # was 20% of full 100
WEIGHT_DISTANCE = 13.33     # was 10
WEIGHT_PRICE = 13.33        # was 10
WEIGHT_PREFERENCE = 20.00   # was 15
WEIGHT_AVAILABILITY = 26.67  # was 20

WEIGHT_TOTAL = (
    WEIGHT_RATING
    + WEIGHT_DISTANCE
    + WEIGHT_PRICE
    + WEIGHT_PREFERENCE
    + WEIGHT_AVAILABILITY
)


# Google Places priceLevel enum values.
PRICE_LEVEL_RANK = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}

BUDGET_TARGET_RANK = {
    "cheap": 1,
    "moderate": 2,
    "expensive": 3,
    "any": None,
}


def _bayesian_rating(rating: Optional[float], review_count: Optional[int]) -> float:
    r = rating if rating is not None else 0.0
    n = review_count if review_count is not None else 0
    return (
        (n / (n + RATING_PRIOR_REVIEWS)) * r
        + (RATING_PRIOR_REVIEWS / (n + RATING_PRIOR_REVIEWS)) * GLOBAL_AVG_RATING
    )


def _rating_score(place: dict[str, Any]) -> float:
    """Bayesian rating mapped to [0, 1]."""
    return _bayesian_rating(place.get("rating"), place.get("userRatingCount")) / 5.0


def _distance_score(place: dict[str, Any], max_distance_miles: float) -> float:
    """Closer is better. 1.0 at 0 miles, 0.0 at >= max."""
    distance = place.get("distanceMiles")
    if distance is None or max_distance_miles <= 0:
        return 0.0
    return max(0.0, 1.0 - (distance / max_distance_miles))


def _price_score(place: dict[str, Any], budget: str) -> float:
    """
    1.0 if the place's price level matches the user's budget; degrades by 0.25
    per step away. 'any' budget returns 0.5 (neutral).
    """
    target = BUDGET_TARGET_RANK.get(budget)
    if target is None:
        return 0.5

    place_level = place.get("priceLevel")
    if place_level is None:
        return 0.5

    place_rank = PRICE_LEVEL_RANK.get(place_level)
    if place_rank is None:
        return 0.5

    diff = abs(place_rank - target)
    return max(0.0, 1.0 - 0.25 * diff)


def _haystack(place: dict[str, Any]) -> str:
    parts = [
        display_name(place),
        place.get("primaryType") or "",
        " ".join(place.get("types") or []),
        place.get("formattedAddress") or "",
    ]
    return " ".join(parts).lower()


def _preference_score(place: dict[str, Any], profile: UserProfile) -> float:
    """
    +/- 0.25 per match against liked/disliked cuisines/foods, clipped to [0, 1],
    centered at 0.5. Guest profiles with empty lists land at 0.5 (neutral).
    """
    haystack = _haystack(place)
    score = 0.5

    for term in profile.preferences.likedCuisines + profile.preferences.likedFoods:
        if term and term.lower() in haystack:
            score += 0.25

    for term in (
        profile.preferences.dislikedCuisines + profile.preferences.dislikedFoods
    ):
        if term and term.lower() in haystack:
            score -= 0.25

    return max(0.0, min(1.0, score))


def _availability_score(place: dict[str, Any]) -> float:
    """1.0 open, 0.5 unknown, 0.0 closed/inactive."""
    business_status = place.get("businessStatus")
    if business_status and business_status != "OPERATIONAL":
        return 0.0

    open_now = is_open_now(place)
    if open_now is True:
        return 1.0
    if open_now is False:
        return 0.0
    return 0.5


def score_place(place: dict[str, Any], profile: UserProfile) -> dict[str, Any]:
    """
    Returns the place dict with ranking components attached so the API response
    and any debug logging can show why a place ranked where it did.
    """
    components = {
        "rating": _rating_score(place),
        "distance": _distance_score(place, profile.preferences.maxDistanceMiles),
        "price": _price_score(place, profile.preferences.budget),
        "preference": _preference_score(place, profile),
        "availability": _availability_score(place),
    }

    weighted_total = (
        WEIGHT_RATING * components["rating"]
        + WEIGHT_DISTANCE * components["distance"]
        + WEIGHT_PRICE * components["price"]
        + WEIGHT_PREFERENCE * components["preference"]
        + WEIGHT_AVAILABILITY * components["availability"]
    ) / WEIGHT_TOTAL

    place["foragerScore"] = weighted_total
    place["foragerScoreComponents"] = components
    return place


def rank_places(
    places: list[dict[str, Any]], profile: UserProfile
) -> list[dict[str, Any]]:
    scored = [score_place(p, profile) for p in places]
    scored.sort(key=lambda p: p.get("foragerScore", 0.0), reverse=True)
    return scored
