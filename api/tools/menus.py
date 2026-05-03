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


def safe_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def safe_string(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def repair_structured_menu_json(
    raw_text: str,
    goal: str,
) -> dict[str, Any] | None:
    """
    If the first structured JSON extraction fails, ask Nemotron to repair it.

    This is still model-driven. We are not hard-coding a language or dish.
    """
    repair_messages = [
        {
            "role": "system",
            "content": (
                "You repair malformed menu-analysis output into valid JSON. "
                "Return ONLY valid JSON. No markdown. No explanation. "
                "Do not invent a language if you cannot infer it from the text. "
                "If language is uncertain, use null for language fields and low confidence."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Goal: {goal}\n\n"
                "Convert the following menu analysis into the required JSON schema.\n\n"
                "Required schema:\n"
                "{\n"
                '  "detected_language": {\n'
                '    "name": "string or null",\n'
                '    "iso_code": "string or null",\n'
                '    "script": "string or null",\n'
                '    "confidence": "high|medium|low"\n'
                "  },\n"
                '  "menu_context": {\n'
                '    "restaurant_type": "string or null",\n'
                '    "country_or_region_guess": "string or null",\n'
                '    "currency": "string or null"\n'
                "  },\n"
                '  "ranked_candidates": [\n'
                "    {\n"
                '      "dish_original": "string",\n'
                '      "dish_english": "string",\n'
                '      "category": "main|side|drink|dessert|unknown",\n'
                '      "likely_ingredients": ["string"],\n'
                '      "cooking_method": "string or null",\n'
                '      "protein_likelihood": "high|medium|low",\n'
                '      "calorie_risk": "high|medium|low",\n'
                '      "carb_risk": "high|medium|low",\n'
                '      "fat_risk": "high|medium|low",\n'
                '      "goal_fit_score": 0,\n'
                '      "reason": "string"\n'
                "    }\n"
                "  ],\n"
                '  "best_dish_original": "string or null",\n'
                '  "best_dish_english": "string or null",\n'
                '  "usda_queries": ["string", "string", "string"],\n'
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
    )

    if not repaired_text:
        return None

    try:
        return extract_json_from_text(repaired_text)
    except Exception:
        return None


def validate_structured_menu(
    structured: dict[str, Any],
    menu_description: str,
) -> dict[str, Any]:
    """
    Normalizes the model output without hard-coding a specific language.

    This keeps the pipeline alive while making uncertainty explicit.
    """
    detected_language = structured.get("detected_language")

    if not isinstance(detected_language, dict):
        detected_language = {
            "name": safe_string(detected_language) or None,
            "iso_code": None,
            "script": None,
            "confidence": "low",
        }

    menu_context = structured.get("menu_context")
    if not isinstance(menu_context, dict):
        menu_context = {
            "restaurant_type": None,
            "country_or_region_guess": None,
            "currency": None,
        }

    ranked_candidates = safe_list(structured.get("ranked_candidates"))

    cleaned_candidates = []

    for candidate in ranked_candidates:
        if not isinstance(candidate, dict):
            continue

        cleaned_candidates.append(
            {
                "dish_original": safe_string(candidate.get("dish_original")),
                "dish_english": safe_string(candidate.get("dish_english")),
                "category": safe_string(candidate.get("category"), "unknown"),
                "likely_ingredients": [
                    safe_string(item)
                    for item in safe_list(candidate.get("likely_ingredients"))
                    if safe_string(item)
                ],
                "cooking_method": safe_string(candidate.get("cooking_method")) or None,
                "protein_likelihood": safe_string(candidate.get("protein_likelihood"), "low"),
                "calorie_risk": safe_string(candidate.get("calorie_risk"), "medium"),
                "carb_risk": safe_string(candidate.get("carb_risk"), "medium"),
                "fat_risk": safe_string(candidate.get("fat_risk"), "medium"),
                "goal_fit_score": float(candidate.get("goal_fit_score") or 0),
                "reason": safe_string(candidate.get("reason")),
            }
        )

    cleaned_candidates.sort(
        key=lambda item: item.get("goal_fit_score", 0),
        reverse=True,
    )

    usda_queries = [
        safe_string(query)
        for query in safe_list(structured.get("usda_queries"))
        if safe_string(query)
    ]

    best_dish_original = safe_string(structured.get("best_dish_original"))
    best_dish_english = safe_string(structured.get("best_dish_english"))

    if not best_dish_original and cleaned_candidates:
        best_dish_original = cleaned_candidates[0].get("dish_original") or ""

    if not best_dish_english and cleaned_candidates:
        best_dish_english = cleaned_candidates[0].get("dish_english") or ""

    if not usda_queries and cleaned_candidates:
        for candidate in cleaned_candidates[:3]:
            english_name = candidate.get("dish_english")
            ingredients = candidate.get("likely_ingredients", [])
            cooking_method = candidate.get("cooking_method")

            query_parts = []

            if english_name:
                query_parts.append(english_name)

            if cooking_method:
                query_parts.append(cooking_method)

            if ingredients:
                query_parts.extend(ingredients[:2])

            query = " ".join(str(part) for part in query_parts if str(part)).strip()

            if query and query.lower() not in [item.lower() for item in usda_queries]:
                usda_queries.append(query)

    if not usda_queries:
        usda_queries = []

    return {
        "detected_language": detected_language,
        "menu_context": menu_context,
        "ranked_candidates": cleaned_candidates,
        "best_dish_original": best_dish_original or None,
        "best_dish_english": best_dish_english or None,
        "usda_queries": usda_queries[:3],
        "uncertainty": safe_string(
            structured.get("uncertainty"),
            "Menu structure or language detection was uncertain.",
        ),
        "raw_menu_description": menu_description,
    }


def build_structured_menu_messages(
    menu_description: str,
    goal: str,
) -> list[dict[str, Any]]:
    return [
        {
            "role": "system",
            "content": (
                "You are a multilingual restaurant-menu analysis engine for Forager. "
                "You must detect the menu language and script from the provided menu analysis. "
                "Do not assume the language from the user's location. "
                "Do not hard-code a country or cuisine. "
                "If multiple languages are present, identify the primary language and mention mixed-language uncertainty. "
                "Return ONLY valid JSON. No markdown. No explanation outside JSON.\n\n"

                "Nutrition and ranking rules:\n"
                "- Rank menu items according to the user's goal, not according to menu order or highlighted text.\n"
                "- For high-protein or low-calorie goals, prefer protein-forward items over carb-heavy items.\n"
                "- Penalize dishes that are mostly rice, noodles, bread, dessert, sugary drinks, or deep-fried unless the user's goal allows them.\n"
                "- Be skeptical of oil, sauce, cream, cheese, frying, and large portions.\n"
                "- Do not invent exact macros. This step only prepares candidates and USDA queries.\n"
                "- USDA queries must be in English because USDA FoodData Central works best with English food names.\n\n"

                "Required JSON schema:\n"
                "{\n"
                '  "detected_language": {\n'
                '    "name": "string or null",\n'
                '    "iso_code": "string or null",\n'
                '    "script": "string or null",\n'
                '    "confidence": "high|medium|low"\n'
                "  },\n"
                '  "menu_context": {\n'
                '    "restaurant_type": "string or null",\n'
                '    "country_or_region_guess": "string or null",\n'
                '    "currency": "string or null"\n'
                "  },\n"
                '  "ranked_candidates": [\n'
                "    {\n"
                '      "dish_original": "string",\n'
                '      "dish_english": "string",\n'
                '      "category": "main|side|drink|dessert|unknown",\n'
                '      "likely_ingredients": ["string"],\n'
                '      "cooking_method": "string or null",\n'
                '      "protein_likelihood": "high|medium|low",\n'
                '      "calorie_risk": "high|medium|low",\n'
                '      "carb_risk": "high|medium|low",\n'
                '      "fat_risk": "high|medium|low",\n'
                '      "goal_fit_score": 0,\n'
                '      "reason": "string"\n'
                "    }\n"
                "  ],\n"
                '  "best_dish_original": "string or null",\n'
                '  "best_dish_english": "string or null",\n'
                '  "usda_queries": ["string", "string", "string"],\n'
                '  "uncertainty": "string"\n'
                "}\n"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Goal: {goal}\n\n"
                f"Menu analysis:\n{menu_description}\n\n"
                "Detect the language from the menu text itself. "
                "Rank the best candidate dishes for the goal and produce English USDA search queries."
            ),
        },
    ]


def analyze_menu_image_bytes(
    image_bytes: bytes,
    filename: str,
    goal: str = "healthy low-calorie high-protein meal",
) -> dict[str, Any]:
    """
    Multilingual menu-image flow:
    1. Nemotron reads the image and describes/translates visible menu content.
    2. Nemotron detects language/script and returns structured candidates.
    3. Python calls USDA using model-generated English queries.
    4. Nemotron creates final recommendation with ranges and confidence.
    """
    data_url = image_bytes_to_data_url(image_bytes=image_bytes, filename=filename)

    menu_description_messages = [
        {
            "role": "system",
            "content": (
                "You are Forager, a multilingual AI food decision assistant. "
                "You analyze restaurant menu images in any language or script. "
                "Your job is to read visible menu text, infer dish meanings when possible, "
                "detect the language/script from the image, and identify dishes that may fit the user's goal. "
                "Do not assume the language. Do not give exact nutrition yet. "
                "Mention uncertainty if text is blurry, partially hidden, mixed-language, or ambiguous."
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
                        "Detect the language or languages from the image. "
                        "Translate or explain visible dish names when possible. "
                        "Identify candidate dishes that fit the goal and explain uncertainty."
                    ),
                },
            ],
        },
    ]

    menu_description = call_nemotron(
        messages=menu_description_messages,
        max_tokens=2200,
        temperature=0.2,
    )

    if not menu_description:
        raise RuntimeError("Nemotron returned empty menu image analysis.")

    json_messages = build_structured_menu_messages(
        menu_description=menu_description,
        goal=goal,
    )

    json_text = call_nemotron(
        messages=json_messages,
        max_tokens=2200,
        temperature=0.1,
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
        )

    if structured_raw is None:
        structured = {
            "detected_language": {
                "name": None,
                "iso_code": None,
                "script": None,
                "confidence": "low",
            },
            "menu_context": {
                "restaurant_type": None,
                "country_or_region_guess": None,
                "currency": None,
            },
            "ranked_candidates": [],
            "best_dish_original": None,
            "best_dish_english": None,
            "usda_queries": [],
            "uncertainty": (
                "Structured menu extraction failed. "
                "Language and dish ranking could not be reliably parsed."
            ),
            "raw_menu_description": menu_description,
            "json_parse_error": json_parse_error,
        }
    else:
        structured = validate_structured_menu(
            structured=structured_raw,
            menu_description=menu_description,
        )

        if json_parse_error:
            structured["json_parse_warning"] = json_parse_error

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
                "You are Forager. Create a realistic meal recommendation from multilingual menu analysis. "
                "Use the detected_language field from the structured analysis; do not guess a new language. "
                "USDA is only reference data, not exact restaurant nutrition. "
                "Use realistic portion-size reasoning based on the detected menu context, cuisine clues, prices, and dish type. "
                "Account for oil, sauce, rice, noodles, breading, frying, serving size, and uncertainty. "
                "Always output macro ranges and confidence levels. "
                "If structured extraction failed or USDA queries are missing, confidence must be low. "
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
                "Give the final recommendation with:\n"
                "- detected language and translation\n"
                "- best dish and why it fits the goal\n"
                "- estimated macro ranges\n"
                "- confidence level\n"
                "- uncertainty\n"
                "- suggested modifications\n"
                "- what to ask the waiter/server\n"
                "- cultural norms only if the menu context supports it"
            ),
        },
    ]

    final_recommendation = call_nemotron(
        messages=final_messages,
        max_tokens=2400,
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
            "nvidia_nemotron_vision_language_detection",
            "nvidia_nemotron_structuring",
            "usda_fooddata_central",
            "nvidia_nemotron_synthesis",
        ],
    }