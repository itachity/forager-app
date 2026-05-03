"""
Forager API.

Two endpoints:
  POST /chat          - natural-language food request -> ranked recommendations
  POST /analyze-menu  - menu image -> per-dish recommendation with macros

Both are profile-aware: allergens, diet rules, language, budget, and nutrition
goal flow from the request into the prompts and ranking. No hardcoded defaults
substitute for missing inputs - if the request can't be served, the endpoint
returns a real error.
"""

import json
import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from api.models import (
    AnalyzeMenuResponse,
    ChatRequest,
    ChatResponse,
    Location,
    MenuRecommendation,
    Recommendation,
    UserProfile,
    guest_profile,
)
from api.services import nemotron, places, ranking, usda


# Load api/.env for local development. In production, set vars in the host.
load_dotenv(Path(__file__).resolve().parent / ".env")


logger = logging.getLogger("forager")
logging.basicConfig(level=logging.INFO)


def _cors_origins() -> list[str]:
    """
    Comma-separated list from CORS_ORIGINS. No production hostnames are
    hardcoded - if the env var is unset, only localhost dev is allowed.
    """
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(title="Forager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health")
def health():
    return {"status": "ok", "service": "forager-api"}


# ---------------------------------------------------------------------------
# /chat
# ---------------------------------------------------------------------------


def _resolve_profile(profile: Optional[UserProfile]) -> UserProfile:
    return profile if profile is not None else guest_profile()


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="message is required.")

    if req.location is None:
        # Per requirements US-006: location is normally implicit, but we never
        # invent one. Frontend should request browser geolocation or let the
        # user pick a city.
        raise HTTPException(
            status_code=400,
            detail=(
                "location is required for restaurant search. "
                "Send {latitude, longitude} or prompt the user for permission."
            ),
        )

    profile = _resolve_profile(req.user_profile)
    tools_used: list[str] = []

    # Step 1: Places search keyed off the user's actual message.
    try:
        raw_places = places.search_text(
            query=req.message,
            latitude=req.location.latitude,
            longitude=req.location.longitude,
            radius_miles=profile.preferences.maxDistanceMiles,
            open_now=False,  # let ranking handle availability so closed places can be flagged
            max_results=10,
        )
        tools_used.append("google_places.searchText")
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Places search failed")
        raise HTTPException(status_code=502, detail=f"Places search failed: {exc}") from exc

    if not raw_places:
        return ChatResponse(
            answer="I couldn't find any places that match within your distance preference. Try widening the search or relaxing the craving.",
            tools_used=tools_used,
            recommendations=[],
        )

    # Step 2: profile-aware weighted ranking.
    ranked = ranking.rank_places(raw_places, profile)
    top_places = ranked[:5]
    tools_used.append("forager.rank_places")

    # Step 3: Nemotron synthesizes structured recommendations from the top
    # places + profile constraints. (USDA is wired into /analyze-menu; we
    # keep /chat to a single LLM call so it stays under NFR-001's 10s budget.)
    try:
        synthesized = nemotron.synthesize_chat_recommendations(
            user_message=req.message,
            profile=profile,
            places=top_places,
        )
        tools_used.append("nemotron.synthesize_chat_recommendations")
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        # Unparseable model output - surface, don't fabricate.
        raise HTTPException(
            status_code=502,
            detail=f"Recommendation model returned invalid JSON: {exc}",
        ) from exc

    # Step 4: validate model output against our schema, then enrich each
    # recommendation with the Places metadata we already have.
    answer = synthesized.get("answer", "").strip() or "Here are options near you."
    raw_recs = synthesized.get("recommendations") or []

    place_lookup = {
        ((p.get("displayName") or {}).get("text") or "").lower(): p
        for p in top_places
    }

    recommendations: list[Recommendation] = []
    for raw_rec in raw_recs:
        try:
            rec = Recommendation.model_validate(raw_rec)
        except ValidationError as exc:
            logger.warning("Discarding malformed recommendation: %s", exc)
            continue

        match = place_lookup.get(rec.place.lower())
        if match is not None:
            rec.distance_miles = match.get("distanceMiles")
            rec.price_level = match.get("priceLevel")
            rec.rating = match.get("rating")
            rec.user_rating_count = match.get("userRatingCount")
            rec.open_now = (match.get("currentOpeningHours") or {}).get("openNow")
            rec.google_maps_uri = match.get("googleMapsUri")

        recommendations.append(rec)

    return ChatResponse(
        answer=answer,
        tools_used=tools_used,
        recommendations=recommendations,
    )


# ---------------------------------------------------------------------------
# /analyze-menu
# ---------------------------------------------------------------------------


ALLOWED_IMAGE_PREFIXES = ("image/",)
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MiB


def _parse_optional_json_form(field_name: str, raw: Optional[str]) -> Optional[dict]:
    if raw is None or not raw.strip():
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be valid JSON: {exc}",
        ) from exc


@app.post("/analyze-menu", response_model=AnalyzeMenuResponse)
async def analyze_menu(
    file: UploadFile = File(...),
    user_profile: Optional[str] = Form(default=None),
    location: Optional[str] = Form(default=None),
) -> AnalyzeMenuResponse:
    if file.content_type and not file.content_type.startswith(ALLOWED_IMAGE_PREFIXES):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type: {file.content_type}. Send an image.",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image is larger than {MAX_IMAGE_BYTES // (1024 * 1024)} MiB.",
        )

    profile_dict = _parse_optional_json_form("user_profile", user_profile)
    if profile_dict is None:
        profile = guest_profile()
    else:
        try:
            profile = UserProfile.model_validate(profile_dict)
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=exc.errors()) from exc

    # location is currently informational for the menu flow; we accept and
    # validate it so future cultural-context features have it.
    location_dict = _parse_optional_json_form("location", location)
    if location_dict is not None:
        try:
            Location.model_validate(location_dict)
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=exc.errors()) from exc

    tools_used: list[str] = []

    try:
        menu_description = nemotron.analyze_menu_image(
            image_bytes=image_bytes,
            filename=file.filename,
            profile=profile,
        )
        tools_used.append("nemotron.analyze_menu_image")
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        menu_analysis = nemotron.extract_menu_analysis_json(
            menu_description=menu_description,
            profile=profile,
        )
        tools_used.append("nemotron.extract_menu_analysis_json")
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Menu JSON extraction failed: {exc}",
        ) from exc

    usda_queries = menu_analysis.get("usda_queries") or []
    if not isinstance(usda_queries, list):
        raise HTTPException(
            status_code=502,
            detail="Menu analysis returned non-list usda_queries.",
        )

    usda_results = []
    if usda_queries:
        try:
            usda_results = usda.search_many(usda_queries[:5], page_size=3)
            tools_used.append("usda.search_many")
        except RuntimeError as exc:
            # Missing API key - fail loudly, don't silently skip USDA.
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        synthesized = nemotron.synthesize_menu_recommendation(
            profile=profile,
            menu_description=menu_description,
            menu_analysis=menu_analysis,
            usda_results=usda_results,
        )
        tools_used.append("nemotron.synthesize_menu_recommendation")
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Menu recommendation synthesis failed: {exc}",
        ) from exc

    detected_language = synthesized.get(
        "detected_language",
        menu_analysis.get("detected_language", "unknown"),
    )
    summary = (synthesized.get("summary") or "").strip() or "Menu analyzed."
    raw_recs = synthesized.get("recommendations") or []

    recommendations: list[MenuRecommendation] = []
    for raw_rec in raw_recs:
        try:
            recommendations.append(MenuRecommendation.model_validate(raw_rec))
        except ValidationError as exc:
            logger.warning("Discarding malformed menu recommendation: %s", exc)
            continue

    return AnalyzeMenuResponse(
        detected_language=detected_language,
        summary=summary,
        tools_used=tools_used,
        recommendations=recommendations,
    )
