from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
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


def usage_to_dict(usage: Any) -> dict[str, int]:
    if usage is None:
        return {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    if isinstance(usage, dict):
        return {
            "prompt_tokens": int(usage.get("prompt_tokens") or 0),
            "completion_tokens": int(usage.get("completion_tokens") or 0),
            "total_tokens": int(usage.get("total_tokens") or 0),
        }
    if hasattr(usage, "model_dump"):
        return usage_to_dict(usage.model_dump())
    return {
        "prompt_tokens": int(getattr(usage, "prompt_tokens", 0) or 0),
        "completion_tokens": int(getattr(usage, "completion_tokens", 0) or 0),
        "total_tokens": int(getattr(usage, "total_tokens", 0) or 0),
    }


def record_token_usage(
    token_usage: list[dict[str, Any]] | None,
    *,
    response: Any,
    purpose: str,
    retry: bool = False,
) -> None:
    if token_usage is None:
        return
    token_usage.append(
        {
            "provider": "nvidia",
            "model": MODEL,
            "route": "/analyze-food",
            "purpose": purpose,
            "retry": retry,
            **usage_to_dict(getattr(response, "usage", None)),
        }
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
    max_tokens: int = 1600,
    temperature: float = 0.2,
    purpose: str = "food.unknown",
    token_usage: list[dict[str, Any]] | None = None,
) -> str:
    client = get_client()
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature,
        top_p=0.95,
        max_tokens=max_tokens,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
    )
    record_token_usage(token_usage, response=response, purpose=purpose, retry=False)
    text = get_message_text(response)

    if not text:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=temperature,
            top_p=0.95,
            max_tokens=max_tokens,
        )
        record_token_usage(token_usage, response=response, purpose=f"{purpose}.retry_without_extra_body", retry=True)
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


def safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def safe_string(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def build_profile_context(user_profile: dict[str, Any]) -> dict[str, Any]:
    dietary = user_profile.get("dietary") if isinstance(user_profile.get("dietary"), dict) else {}
    nutrition = user_profile.get("nutritionGoals") if isinstance(user_profile.get("nutritionGoals"), dict) else {}
    language = user_profile.get("language") if isinstance(user_profile.get("language"), dict) else {}
    privacy = user_profile.get("privacy") if isinstance(user_profile.get("privacy"), dict) else {}
    profile_mode = user_profile.get("profileMode", "guest")
    use_profile = privacy.get("useProfileForRecommendations", True)
    ignore = profile_mode == "cheat_day" or use_profile is False

    return {
        "profileMode": profile_mode,
        "useProfileForRecommendations": use_profile,
        "dietary": {
            "allergens": safe_list(dietary.get("allergens")),
            "avoidIngredients": [] if ignore else safe_list(dietary.get("avoidIngredients")),
            "dietRules": {} if ignore else dietary.get("dietRules", {}),
        },
        "nutritionGoals": {"goalType": "none"} if ignore else nutrition,
        "language": language,
    }


def fallback_food_response(error: str, filename: str = "meal.jpg") -> dict[str, Any]:
    return {
        "filename": filename,
        "dish": "Unknown dish",
        "confidence": 0.0,
        "cuisine": None,
        "ingredients": [],
        "followUpQuestions": [
            {
                "id": "portion",
                "question": "How much of the food did you eat?",
                "options": ["all of it", "half", "three quarters", "not sure"],
            },
            {
                "id": "sauce",
                "question": "Were there heavy sauces, cheese, cream, or oil?",
                "options": ["yes", "no", "a little", "not sure"],
            },
        ],
        "macros": {
            "caloriesMin": 0,
            "caloriesMax": 0,
            "proteinMinG": 0,
            "proteinMaxG": 0,
            "carbsMinG": 0,
            "carbsMaxG": 0,
            "fatMinG": 0,
            "fatMaxG": 0,
            "servingNote": error,
        },
        "logSuggestions": [],
        "nextOrderTips": [],
        "tools_used": ["fallback"],
    }


def normalize_final_food(parsed: dict[str, Any], filename: str) -> dict[str, Any]:
    macros = parsed.get("macros") if isinstance(parsed.get("macros"), dict) else {}
    return {
        "filename": filename,
        "dish": safe_string(parsed.get("dish"), "Unknown dish"),
        "confidence": max(0.0, min(safe_float(parsed.get("confidence"), 0.5), 1.0)),
        "cuisine": safe_string(parsed.get("cuisine")) or None,
        "ingredients": [safe_string(item) for item in safe_list(parsed.get("ingredients")) if safe_string(item)],
        "detectedLanguage": safe_string(parsed.get("detectedLanguage")) or None,
        "recordText": safe_string(parsed.get("recordText")) or None,
        "followUpQuestions": [q for q in safe_list(parsed.get("followUpQuestions")) if isinstance(q, dict)],
        "macros": {
            "caloriesMin": safe_int(macros.get("caloriesMin"), 0),
            "caloriesMax": safe_int(macros.get("caloriesMax"), 0),
            "proteinMinG": safe_int(macros.get("proteinMinG"), 0),
            "proteinMaxG": safe_int(macros.get("proteinMaxG"), 0),
            "carbsMinG": safe_int(macros.get("carbsMinG"), 0),
            "carbsMaxG": safe_int(macros.get("carbsMaxG"), 0),
            "fatMinG": safe_int(macros.get("fatMinG"), 0),
            "fatMaxG": safe_int(macros.get("fatMaxG"), 0),
            "servingNote": safe_string(macros.get("servingNote"), "Estimate based on image, user note, and USDA references."),
        },
        "logSuggestions": [safe_string(item) for item in safe_list(parsed.get("logSuggestions")) if safe_string(item)],
        "nextOrderTips": [safe_string(item) for item in safe_list(parsed.get("nextOrderTips")) if safe_string(item)],
    }


def analyze_food_image_bytes(
    image_bytes: bytes,
    filename: str,
    user_profile: dict[str, Any] | None = None,
    clarifications: dict[str, Any] | None = None,
    record_text: str = "",
    token_usage: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Multimodal food macro flow:
    1. Nemotron identifies food from image and optional multilingual text note.
    2. Nemotron returns structured dish/ingredient/portion/USDA-query JSON.
    3. Python calls USDA FoodData Central.
    4. Nemotron synthesizes realistic macro ranges in frontend-compatible shape.
    """
    profile_context = build_profile_context(user_profile or {})
    clarifications = clarifications or {}
    data_url = image_bytes_to_data_url(image_bytes=image_bytes, filename=filename)

    identification_messages = [
        {
            "role": "system",
            "content": (
                "You are Forager, a multimodal food identification engine. Identify visible food, likely cuisine, "
                "ingredients, portion uncertainty, and useful USDA search queries. The user note may be in any language. "
                "Return ONLY valid JSON. Do not invent exact nutrition yet."
            ),
        },
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_url}},
                {
                    "type": "text",
                    "text": (
                        f"User note in any language: {record_text or '(none)'}\n"
                        f"Clarifications: {json.dumps(clarifications, ensure_ascii=False)}\n"
                        f"Profile context: {json.dumps(profile_context, ensure_ascii=False)}\n\n"
                        "Return JSON with schema: {dish, cuisine, detectedLanguage, confidence, ingredients, portion_guess, "
                        "serving_count_guess, usda_queries, uncertainty, follow_up_questions}."
                    ),
                },
            ],
        },
    ]

    raw_identification = call_nemotron(
        messages=identification_messages,
        max_tokens=1800,
        temperature=0.1,
        purpose="food.identification",
        token_usage=token_usage,
    )

    try:
        structured = extract_json_from_text(raw_identification)
    except Exception as exc:
        structured = {
            "dish": "Unknown dish",
            "cuisine": None,
            "detectedLanguage": None,
            "confidence": 0.2,
            "ingredients": [],
            "portion_guess": None,
            "serving_count_guess": None,
            "usda_queries": [],
            "uncertainty": f"Could not parse food identification JSON: {exc}",
            "follow_up_questions": [],
            "raw_identification": raw_identification,
        }

    usda_queries = [safe_string(q) for q in safe_list(structured.get("usda_queries")) if safe_string(q)]
    if not usda_queries:
        dish = safe_string(structured.get("dish"))
        ingredients = [safe_string(item) for item in safe_list(structured.get("ingredients")) if safe_string(item)]
        if dish:
            usda_queries.append(dish)
        if ingredients:
            usda_queries.append(" ".join(ingredients[:3]))
    usda_queries = usda_queries[:3]

    usda_references = []
    for query in usda_queries:
        try:
            usda_references.append(search_usda_foods(query=query, page_size=3))
        except Exception as exc:
            usda_references.append({"query": query, "source": "USDA FoodData Central", "error": str(exc), "results": []})

    final_messages = [
        {
            "role": "system",
            "content": (
                "You are Forager. Convert food image identification plus USDA references into realistic macro ranges. "
                "USDA is reference data only and may not match restaurant portions. Use the image, note, clarifications, "
                "portion uncertainty, and profile context. Return ONLY valid JSON in the requested frontend shape. "
                "Do not give medical advice. If allergens are listed, remind user to verify ingredients."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Filename: {filename}\n"
                f"User note in any language: {record_text or '(none)'}\n"
                f"Clarifications: {json.dumps(clarifications, indent=2, ensure_ascii=False)}\n"
                f"Profile context: {json.dumps(profile_context, indent=2, ensure_ascii=False)}\n\n"
                f"Structured identification: {json.dumps(structured, indent=2, ensure_ascii=False)}\n\n"
                f"USDA references: {json.dumps(usda_references, indent=2, ensure_ascii=False)}\n\n"
                "Return JSON exactly shaped like:\n"
                "{\n"
                '  "dish": "string",\n'
                '  "confidence": 0.0,\n'
                '  "cuisine": "string or null",\n'
                '  "detectedLanguage": "string or null",\n'
                '  "recordText": "string or null",\n'
                '  "ingredients": ["string"],\n'
                '  "followUpQuestions": [{"id": "string", "question": "string", "options": ["string"]}],\n'
                '  "macros": {"caloriesMin": 0, "caloriesMax": 0, "proteinMinG": 0, "proteinMaxG": 0, "carbsMinG": 0, "carbsMaxG": 0, "fatMinG": 0, "fatMaxG": 0, "servingNote": "string"},\n'
                '  "logSuggestions": ["string"],\n'
                '  "nextOrderTips": ["string"]\n'
                "}"
            ),
        },
    ]

    final_text = call_nemotron(
        messages=final_messages,
        max_tokens=2400,
        temperature=0.2,
        purpose="food.macro_synthesis",
        token_usage=token_usage,
    )

    try:
        final = extract_json_from_text(final_text)
    except Exception as exc:
        return fallback_food_response(f"Food macro synthesis failed: {exc}", filename=filename)

    normalized = normalize_final_food(final, filename=filename)
    normalized.update(
        {
            "record_text": record_text,
            "structured_identification": structured,
            "usda_references": usda_references,
            "tools_used": [
                "nvidia_nemotron_food_vision",
                "usda_fooddata_central",
                "nvidia_nemotron_macro_synthesis",
            ],
        }
    )
    return normalized
