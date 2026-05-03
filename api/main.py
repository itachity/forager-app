from __future__ import annotations

import json
import os
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agent import ForagerAgent


app = FastAPI(title="Forager API")

origins_env = os.getenv("CORS_ALLOW_ORIGINS", "")
origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = ForagerAgent()


class Location(BaseModel):
    lat: float | None = None
    lng: float | None = None
    city: str | None = None
    country: str | None = None


class ChatRequest(BaseModel):
    message: str
    user_profile: dict[str, Any] = Field(default_factory=dict)
    location: Location | None = None


def parse_json_form(raw: str | None, fallback: Any) -> Any:
    """Safely parse JSON passed inside multipart/form-data fields."""
    if raw is None or raw == "":
        return fallback

    try:
        return json.loads(raw)
    except Exception:
        return fallback


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "forager-api",
    }


@app.post("/chat")
async def chat(req: ChatRequest) -> dict[str, Any]:
    return await agent.run_chat(
        message=req.message,
        user_profile=req.user_profile,
        location=req.location.model_dump() if req.location else {},
    )


@app.post("/analyze-menu")
async def analyze_menu(
    file: UploadFile = File(...),
    goal: str = Form("healthy low-calorie high-protein meal"),
    profile: str = Form("{}"),
    record_text: str = Form(""),
) -> dict[str, Any]:
    """
    Analyze a menu image with optional user profile and multilingual user note.

    `record_text` can be any free-form note such as:
    - "I want high protein but low calorie"
    - "これはラーメン屋のメニューです"
    - "Sin queso, por favor"
    """
    image_bytes = await file.read()
    user_profile = parse_json_form(profile, {})

    return await agent.analyze_menu_upload(
        image_bytes=image_bytes,
        filename=file.filename or "menu.jpg",
        goal=goal,
        user_profile=user_profile,
        record_text=record_text,
    )


@app.post("/analyze-food")
async def analyze_food(
    file: UploadFile = File(...),
    profile: str = Form("{}"),
    clarifications: str = Form("{}"),
    record_text: str = Form(""),
) -> dict[str, Any]:
    """
    Analyze a food/meal image and return macro ranges.

    `record_text` lets the user add portion notes or context in any language.
    `clarifications` is a JSON string from follow-up answers, when available.
    """
    image_bytes = await file.read()
    user_profile = parse_json_form(profile, {})
    clarification_data = parse_json_form(clarifications, {})

    return await agent.analyze_food_upload(
        image_bytes=image_bytes,
        filename=file.filename or "meal.jpg",
        user_profile=user_profile,
        clarifications=clarification_data,
        record_text=record_text,
    )
