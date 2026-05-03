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
        raw = usage.model_dump()
        return usage_to_dict(raw)
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
            "route": "/analyze-menu",
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
    max_tokens: int = 1400,
    temperature: float = 0.2,
    purpose: str = "menu.unknown",
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


def build_profile_context(user_profile: dict[str, Any]) -> dict[str, Any]:
    dietary = user_profile.get("dietary") if isinstance(user_profile.get("dietary"), dict) else {}
    preferences = user_profile.get("preferences") if isinstance(user_profile.get("preferences"), dict) else {}
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
            "spiceTolerance": "any" if ignore else dietary.get("spiceTolerance", "any"),
        },
        "preferences": {
            "budget": "any" if ignore else preferences.get("budget", "any"),
            "likedCuisines": [] if ignore else safe_list(preferences.get("likedCuisines")),
            "dislikedCuisines": [] if ignore else safe_list(preferences.get("dislikedCuisines")),
            "likedFoods": [] if ignore else safe_list(preferences.get("likedFoods")),
            "dislikedFoods": [] if ignore else safe_list(preferences.get("dislikedFoods")),
            "preferredOrderTerms": [] if ignore else safe_list(preferences.get("preferredOrderTerms")),
            "avoidOrderTerms": [] if ignore else safe_list(preferences.get("avoidOrderTerms")),
        },
        "nutritionGoals": {"goalType": "none"} if ignore else nutrition,
        "language": language,
    }


def repair_structured_menu_json(
    raw_text: str,
    goal: str,
    token_usage: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    repair_messages = [
        {
            "role": "system",
            "content": (
                "You repair malformed menu-analysis output into valid JSON. Return ONLY valid JSON. "
                "Do not invent language, ingredients, or dishes. If uncertain, use null fields and low confidence."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Goal: {goal}\n\n"
                "Required schema:\n"
                "{\n"
                '  "detected_language": {"name": "string or null", "iso_code": "string or null", "script": "string or null", "confidence": "high|medium|low"},\n'
                '  "menu_context": {"restaurant_type": "string or null", "country_or_region_guess": "string or null", "currency": "string or null"},\n'
                '  "ranked_candidates": [{"dish_original": "string", "dish_english": "string", "category": "main|side|drink|dessert|unknown", "likely_ingredients": ["string"], "cooking_method": "string or null", "protein_likelihood": "high|medium|low", "calorie_risk": "high|medium|low", "carb_risk": "high|medium|low", "fat_risk": "high|medium|low", "goal_fit_score": 0, "reason": "string"}],\n'
                '  "best_dish_original": "string or null",\n'
                '  "best_dish_english": "string or null",\n'
                '  "usda_queries": ["string"],\n'
                '  "uncertainty": "string"\n'
                "}\n\n"
                f"Raw menu analysis:\n{raw_text}"
            ),
        },
    ]
    repaired_text = call_nemotron(
        messages=repair_messages,
        max_tokens=1800,
        temperature=0.0,
        purpose="menu.repair_json",
        token_usage=token_usage,
    )
    if not repaired_text:
        return None
    try:
        return extract_json_from_text(repaired_text)
    except Exception:
        return None


def validate_structured_menu(structured: dict[str, Any], menu_description: str) -> dict[str, Any]:
    detected_language = structured.get("detected_language")
    if not isinstance(detected_language, dict):
        detected_language = {"name": safe_string(detected_language) or None, "iso_code": None, "script": None, "confidence": "low"}

    menu_context = structured.get("menu_context")
    if not isinstance(menu_context, dict):
        menu_context = {"restaurant_type": None, "country_or_region_guess": None, "currency": None}

    cleaned_candidates = []
    for candidate in safe_list(structured.get("ranked_candidates")):
        if not isinstance(candidate, dict):
            continue
        cleaned_candidates.append(
            {
                "dish_original": safe_string(candidate.get("dish_original")),
                "dish_english": safe_string(candidate.get("dish_english")),
                "category": safe_string(candidate.get("category"), "unknown"),
                "likely_ingredients": [safe_string(item) for item in safe_list(candidate.get("likely_ingredients")) if safe_string(item)],
                "cooking_method": safe_string(candidate.get("cooking_method")) or None,
                "protein_likelihood": safe_string(candidate.get("protein_likelihood"), "low"),
                "calorie_risk": safe_string(candidate.get("calorie_risk"), "medium"),
                "carb_risk": safe_string(candidate.get("carb_risk"), "medium"),
                "fat_risk": safe_string(candidate.get("fat_risk"), "medium"),
                "goal_fit_score": float(candidate.get("goal_fit_score") or 0),
                "reason": safe_string(candidate.get("reason")),
            }
        )

    cleaned_candidates.sort(key=lambda item: item.get("goal_fit_score", 0), reverse=True)

    usda_queries = [safe_string(q) for q in safe_list(structured.get("usda_queries")) if safe_string(q)]
    if not usda_queries and cleaned_candidates:
        for candidate in cleaned_candidates[:3]:
            parts = [
                candidate.get("dish_english"),
                candidate.get("cooking_method"),
                *candidate.get("likely_ingredients", [])[:2],
            ]
            query = " ".join(str(part) for part in parts if part).strip()
            if query and query.lower() not in [item.lower() for item in usda_queries]:
                usda_queries.append(query)

    best_dish_original = safe_string(structured.get("best_dish_original"))
    best_dish_english = safe_string(structured.get("best_dish_english"))
    if not best_dish_original and cleaned_candidates:
        best_dish_original = cleaned_candidates[0].get("dish_original") or ""
    if not best_dish_english and cleaned_candidates:
        best_dish_english = cleaned_candidates[0].get("dish_english") or ""

    return {
        "detected_language": detected_language,
        "menu_context": menu_context,
        "ranked_candidates": cleaned_candidates,
        "best_dish_original": best_dish_original or None,
        "best_dish_english": best_dish_english or None,
        "usda_queries": usda_queries[:3],
        "uncertainty": safe_string(structured.get("uncertainty"), "Menu structure or language detection was uncertain."),
        "raw_menu_description": menu_description,
    }


def build_structured_menu_messages(
    menu_description: str,
    goal: str,
    profile_context: dict[str, Any],
    record_text: str,
) -> list[dict[str, Any]]:
    return [
        {
            "role": "system",
            "content": (
                "You are a multilingual restaurant-menu analysis engine for Forager. Detect the menu language and script "
                "from the provided menu analysis and user note. Do not assume language from location. Return ONLY valid JSON.\n\n"
                "Nutrition and ranking rules:\n"
                "- Rank items according to the user's goal and profile context.\n"
                "- For high-protein or low-calorie goals, prefer protein-forward items over carb-heavy items.\n"
                "- Penalize rice, noodles, bread, dessert, sugary drinks, deep-fried food, cream, cheese, and heavy sauces when relevant.\n"
                "- Respect allergens and diet rules as risk flags.\n"
                "- USDA queries must be in English.\n\n"
                "Required JSON schema:\n"
                "{\n"
                '  "detected_language": {"name": "string or null", "iso_code": "string or null", "script": "string or null", "confidence": "high|medium|low"},\n'
                '  "menu_context": {"restaurant_type": "string or null", "country_or_region_guess": "string or null", "currency": "string or null"},\n'
                '  "ranked_candidates": [{"dish_original": "string", "dish_english": "string", "category": "main|side|drink|dessert|unknown", "likely_ingredients": ["string"], "cooking_method": "string or null", "protein_likelihood": "high|medium|low", "calorie_risk": "high|medium|low", "carb_risk": "high|medium|low", "fat_risk": "high|medium|low", "goal_fit_score": 0, "reason": "string"}],\n'
                '  "best_dish_original": "string or null",\n'
                '  "best_dish_english": "string or null",\n'
                '  "usda_queries": ["string"],\n'
                '  "uncertainty": "string"\n'
                "}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Goal: {goal}\n\n"
                f"User note in any language:\n{record_text or '(none)'}\n\n"
                f"Profile context:\n{json.dumps(profile_context, indent=2, ensure_ascii=False)}\n\n"
                f"Menu analysis:\n{menu_description}\n\n"
                "Detect the language from the menu text/image itself. Rank the best dishes and generate English USDA queries."
            ),
        },
    ]


def analyze_menu_image_bytes(
    image_bytes: bytes,
    filename: str,
    goal: str = "healthy low-calorie high-protein meal",
    user_profile: dict[str, Any] | None = None,
    record_text: str = "",
    token_usage: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Multilingual menu-image flow:
    1. Nemotron reads the image and any multilingual user note.
    2. Nemotron structures language, dish candidates, and USDA queries.
    3. Python calls USDA.
    4. Nemotron creates final recommendation with macro ranges and confidence.
    """
    profile_context = build_profile_context(user_profile or {})
    data_url = image_bytes_to_data_url(image_bytes=image_bytes, filename=filename)

    menu_description_messages = [
        {
            "role": "system",
            "content": (
                "You are Forager, a multilingual AI food decision assistant. Analyze restaurant menu images in any language. "
                "Read visible menu text, infer dish meanings when possible, detect language/script, and identify dishes for the user's goal. "
                "Use the user note if present, but do not assume it is the same language as the menu. Do not give exact nutrition yet."
            ),
        },
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_url}},
                {
                    "type": "text",
                    "text": (
                        f"Goal: {goal}\n"
                        f"User note in any language: {record_text or '(none)'}\n"
                        f"Profile context: {json.dumps(profile_context, ensure_ascii=False)}\n"
                        "Analyze this menu image, detect the language/script, translate or explain dish names, and identify candidates."
                    ),
                },
            ],
        },
    ]

    menu_description = call_nemotron(
        messages=menu_description_messages,
        max_tokens=2200,
        temperature=0.2,
        purpose="menu.image_description",
        token_usage=token_usage,
    )
    if not menu_description:
        raise RuntimeError("Nemotron returned empty menu image analysis.")

    json_messages = build_structured_menu_messages(
        menu_description=menu_description,
        goal=goal,
        profile_context=profile_context,
        record_text=record_text,
    )
    json_text = call_nemotron(
        messages=json_messages,
        max_tokens=2200,
        temperature=0.1,
        purpose="menu.structured_candidates",
        token_usage=token_usage,
    )

    structured_raw: dict[str, Any] | None = None
    json_parse_error: str | None = None
    try:
        structured_raw = extract_json_from_text(json_text)
    except Exception as exc:
        json_parse_error = str(exc)
        structured_raw = repair_structured_menu_json(
            raw_text=json_text or menu_description,
            goal=goal,
            token_usage=token_usage,
        )

    if structured_raw is None:
        structured = {
            "detected_language": {"name": None, "iso_code": None, "script": None, "confidence": "low"},
            "menu_context": {"restaurant_type": None, "country_or_region_guess": None, "currency": None},
            "ranked_candidates": [],
            "best_dish_original": None,
            "best_dish_english": None,
            "usda_queries": [],
            "uncertainty": "Structured menu extraction failed. Language and dish ranking could not be reliably parsed.",
            "raw_menu_description": menu_description,
            "json_parse_error": json_parse_error,
        }
    else:
        structured = validate_structured_menu(structured=structured_raw, menu_description=menu_description)
        if json_parse_error:
            structured["json_parse_warning"] = json_parse_error

    usda_references = []
    for query in structured.get("usda_queries", [])[:3]:
        try:
            usda_references.append(search_usda_foods(query=query, page_size=3))
        except Exception as exc:
            usda_references.append({"query": query, "error": str(exc), "results": []})

    final_messages = [
        {
            "role": "system",
            "content": (
                "You are Forager. Create a realistic meal recommendation from multilingual menu analysis. "
                "Use detected_language from structured analysis; do not guess a new language. USDA is reference data, not exact nutrition. "
                "Use realistic portion-size reasoning and profile context. Always output macro ranges and confidence. Do not give medical advice."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Goal: {goal}\n\n"
                f"User note in any language:\n{record_text or '(none)'}\n\n"
                f"Profile context:\n{json.dumps(profile_context, indent=2, ensure_ascii=False)}\n\n"
                f"Menu description:\n{menu_description}\n\n"
                f"Structured analysis:\n{json.dumps(structured, indent=2, ensure_ascii=False)}\n\n"
                f"USDA references:\n{json.dumps(usda_references, indent=2, ensure_ascii=False)}\n\n"
                "Give final recommendation with detected language, best dish, macro ranges, confidence, uncertainty, modifications, and what to ask the server."
            ),
        },
    ]

    final_recommendation = call_nemotron(
        messages=final_messages,
        max_tokens=2400,
        temperature=0.2,
        purpose="menu.final_recommendation",
        token_usage=token_usage,
    )

    return {
        "filename": filename,
        "goal": goal,
        "record_text": record_text,
        "profile_context": profile_context,
        "menu_description": menu_description,
        "structured_analysis": structured,
        "usda_references": usda_references,
        "final_recommendation": final_recommendation,
        "tools_used": [
            "nvidia_nemotron_vision_language_detection",
            "nvidia_nemotron_structuring",
            "usda_fooddata_central",
            "nvidia_nemotron_synthesis",
        ],
    }
