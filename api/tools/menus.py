from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

from tools.macros import search_usda_foods


load_dotenv()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
MODEL = os.getenv(
    "NEMOTRON_MODEL",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
)


def _require_nvidia_key() -> str:
    if not NVIDIA_API_KEY:
        raise RuntimeError("Missing NVIDIA_API_KEY in api/.env")
    return NVIDIA_API_KEY


def get_client() -> OpenAI:
    return OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=_require_nvidia_key(),
    )


def image_bytes_to_data_url(image_bytes: bytes, filename: str) -> str:
    mime_type, _ = mimetypes.guess_type(filename)

    if mime_type is None:
        mime_type = "image/jpeg"

    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def get_message_text(response: Any) -> str:
    message = response.choices[0].message
    content = message.content

    if content is None:
        return ""

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(item.get("text", ""))
                elif "text" in item:
                    parts.append(str(item["text"]))
            else:
                parts.append(str(item))
        return "\n".join(parts).strip()

    return str(content).strip()


def call_nemotron(
    messages: list[dict[str, Any]],
    max_tokens: int = 1400,
    temperature: float = 0.2,
) -> str:
    client = get_client()

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature,
        top_p=0.95,
        max_tokens=max_tokens,
        extra_body={
            "chat_template_kwargs": {
                "enable_thinking": False,
            }
        },
    )

    text = get_message_text(response)

    if not text:
        # Retry without extra_body. Some endpoints are picky.
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=temperature,
            top_p=0.95,
            max_tokens=max_tokens,
        )

        text = get_message_text(response)

    return text


def extract_json_from_text(text: str) -> dict[str, Any]:
    cleaned = text.strip()

    fenced_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)

    if fenced_match:
        cleaned = fenced_match.group(1).strip()

    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        end = cleaned.rfind("}")

        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start:end + 1]

    return json.loads(cleaned)


def analyze_menu_image_bytes(
    image_bytes: bytes,
    filename: str,
    goal: str = "healthy low-calorie high-protein meal",
) -> dict[str, Any]:
    """
    Robust menu-image flow:
    1. Nemotron describes/translates the image.
    2. Nemotron converts description to JSON.
    3. Python calls USDA.
    4. Nemotron creates final recommendation.
    """
    data_url = image_bytes_to_data_url(image_bytes=image_bytes, filename=filename)

    menu_description_messages = [
        {
            "role": "system",
            "content": (
                "You are Forager, an AI food decision assistant. "
                "You analyze restaurant menu images in any language. "
                "Translate visible dish names when possible. "
                "Identify options that fit the user's goal. "
                "Do not give exact nutrition yet."
            ),
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": data_url},
                },
                {
                    "type": "text",
                    "text": (
                        f"Analyze this menu image for this goal: {goal}. "
                        "Identify the best dish, likely ingredients, cooking method, and uncertainty."
                    ),
                },
            ],
        },
    ]

    menu_description = call_nemotron(
        messages=menu_description_messages,
        max_tokens=1800,
        temperature=0.2,
    )

    if not menu_description:
        raise RuntimeError("Nemotron returned empty menu image analysis.")

    json_messages = [
        {
            "role": "system",
            "content": (
                "Convert menu analysis into JSON. Return ONLY valid JSON.\n\n"
                "Schema:\n"
                "{\n"
                '  "detected_language": "string",\n'
                '  "best_dish_original": "string",\n'
                '  "best_dish_english": "string",\n'
                '  "likely_ingredients": ["string"],\n'
                '  "cooking_method": "string",\n'
                '  "usda_queries": ["string", "string", "string"],\n'
                '  "reason_for_choice": "string",\n'
                '  "uncertainty": "string"\n'
                "}\n"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Goal: {goal}\n\n"
                f"Menu analysis:\n{menu_description}"
            ),
        },
    ]

    json_text = call_nemotron(
        messages=json_messages,
        max_tokens=1200,
        temperature=0.1,
    )

    try:
        structured = extract_json_from_text(json_text)
    except Exception:
        structured = {
            "detected_language": "unknown",
            "best_dish_original": "unknown",
            "best_dish_english": "lean protein dish from menu",
            "likely_ingredients": ["lean protein", "vegetables"],
            "cooking_method": "unknown",
            "usda_queries": ["grilled chicken", "lean beef vegetables", "tofu vegetables"],
            "reason_for_choice": "Fallback used because structured JSON extraction failed.",
            "uncertainty": "High uncertainty because JSON extraction failed.",
        }

    usda_references = []

    for query in structured.get("usda_queries", [])[:3]:
        try:
            usda_references.append(search_usda_foods(query=query, page_size=3))
        except Exception as exc:
            usda_references.append(
                {
                    "query": query,
                    "error": str(exc),
                    "results": [],
                }
            )

    final_messages = [
        {
            "role": "system",
            "content": (
                "You are Forager. Create a realistic meal recommendation. "
                "USDA is only reference data, not exact restaurant nutrition. "
                "Use realistic portion-size reasoning based on country/city/cuisine/price when available. "
                "Account for oil, sauce, rice, noodles, frying, and serving size. "
                "Always output macro ranges and confidence levels. "
                "Do not give medical advice."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Goal: {goal}\n\n"
                f"Menu description:\n{menu_description}\n\n"
                f"Structured analysis:\n{json.dumps(structured, indent=2, ensure_ascii=False)}\n\n"
                f"USDA references:\n{json.dumps(usda_references, indent=2, ensure_ascii=False)}\n\n"
                "Give the final recommendation with translation, why it fits, macro ranges, "
                "confidence, uncertainty, cultural norms to consider if applicable, and what to ask the waiter."
            ),
        },
    ]

    final_recommendation = call_nemotron(
        messages=final_messages,
        max_tokens=2000,
        temperature=0.2,
    )

    return {
        "filename": filename,
        "goal": goal,
        "menu_description": menu_description,
        "structured_analysis": structured,
        "usda_references": usda_references,
        "final_recommendation": final_recommendation,
        "tools_used": [
            "nvidia_nemotron_vision",
            "nvidia_nemotron_structuring",
            "usda_fooddata_central",
            "nvidia_nemotron_synthesis",
        ],
    }