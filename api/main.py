from typing import Any

import os

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
    goal: str = Form(...),
) -> dict[str, Any]:
    image_bytes = await file.read()

    return await agent.analyze_menu_upload(
        image_bytes=image_bytes,
        filename=file.filename or "menu.jpg",
        goal=goal,
    )