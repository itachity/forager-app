"""
Nemotron (NVIDIA) service.

All prompts are built from the user's UserProfile so allergens, diet rules,
language, budget, and nutrition goal are explicit inputs to the model.
There are no hardcoded 'low-calorie high-protein' assumptions.

Failures (missing model env, empty model output, unparseable JSON) raise rather
than fabricating fallback recommendations, so the API can return a real error
to the user instead of made-up data.
"""

import base64
import json
import mimetypes
import os
import re
from typing import Any, Optional

from openai import OpenAI

from api.models import UserProfile


LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "ja": "Japanese",
    "zh": "Chinese",
    "tl": "Tagalog",
    "ru": "Russian",
    "es": "Spanish",
}


def _client() -> OpenAI:
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY is not set. Add it to api/.env.")

    return OpenAI(
        base_url=os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
        api_key=api_key,
    )


def _model() -> str:
    model = os.getenv("NEMOTRON_MODEL")
    if not model:
        raise RuntimeError(
            "NEMOTRON_MODEL is not set. Add it to api/.env "
            "(e.g. nvidia/nemotron-3-nano-omni-30b-a3b-reasoning)."
        )
    return model


# ---------------------------------------------------------------------------
# Profile -> prompt
# ---------------------------------------------------------------------------


def build_constraints_block(profile: UserProfile) -> str:
    """
    Convert the structured profile into a bullet list the model can reason on.
    Allergens and diet rules are honored even in cheat_day mode (safety).
    """
    parts: list[str] = []

    # Allergens / avoid lists are always honored.
    if profile.dietary.allergens:
        parts.append(
            f"User allergens (must NEVER appear in any recommendation, "
            f"and must be flagged if uncertain): "
            f"{', '.join(profile.dietary.allergens)}"
        )
    if profile.dietary.avoidIngredients:
        parts.append(
            f"Ingredients to avoid: {', '.join(profile.dietary.avoidIngredients)}"
        )

    rules = [
        rule_name
        for rule_name, enabled in profile.dietary.dietRules.model_dump().items()
        if enabled
    ]
    if rules:
        parts.append(f"Diet rules: {', '.join(rules)}")

    if profile.dietary.spiceTolerance != "any":
        parts.append(f"Spice tolerance: {profile.dietary.spiceTolerance}")

    if profile.profileMode == "cheat_day":
        parts.append(
            "CHEAT DAY MODE: relax nutrition goals, budget, and order-term "
            "preferences. Still honor allergens and diet rules."
        )
    else:
        if profile.preferences.budget != "any":
            parts.append(f"Budget: {profile.preferences.budget}")
        parts.append(
            f"Max distance from user: {profile.preferences.maxDistanceMiles} miles"
        )
        if profile.preferences.likedCuisines:
            parts.append(
                f"Liked cuisines: {', '.join(profile.preferences.likedCuisines)}"
            )
        if profile.preferences.dislikedCuisines:
            parts.append(
                f"Disliked cuisines: {', '.join(profile.preferences.dislikedCuisines)}"
            )
        if profile.preferences.likedFoods:
            parts.append(f"Liked foods: {', '.join(profile.preferences.likedFoods)}")
        if profile.preferences.dislikedFoods:
            parts.append(
                f"Disliked foods: {', '.join(profile.preferences.dislikedFoods)}"
            )
        if profile.preferences.preferredOrderTerms:
            parts.append(
                f"Preferred order terms (e.g. 'grilled', 'on the side'): "
                f"{', '.join(profile.preferences.preferredOrderTerms)}"
            )
        if profile.preferences.avoidOrderTerms:
            parts.append(
                f"Avoid order terms: {', '.join(profile.preferences.avoidOrderTerms)}"
            )

        goals = profile.nutritionGoals
        if goals.goalType != "none":
            parts.append(f"Nutrition goal: {goals.goalType}")
        if goals.caloriesMax is not None:
            parts.append(f"Calories max: {goals.caloriesMax} kcal")
        if goals.caloriesMin is not None:
            parts.append(f"Calories min: {goals.caloriesMin} kcal")
        if goals.proteinMinGrams is not None:
            parts.append(f"Protein min: {goals.proteinMinGrams} g")
        if goals.carbsMaxGrams is not None:
            parts.append(f"Carbs max: {goals.carbsMaxGrams} g")
        if goals.fatMaxGrams is not None:
            parts.append(f"Fat max: {goals.fatMaxGrams} g")

    language_name = LANGUAGE_NAMES.get(
        profile.language.preferredLanguage,
        profile.language.preferredLanguage,
    )
    parts.append(f"Respond in language: {language_name}")
    if profile.language.explainCulturalNorms:
        parts.append("Include relevant cultural/etiquette notes when applicable.")

    if profile.profileMode == "guest":
        parts.append(
            "Guest mode: profile may be incomplete; do not invent restrictions "
            "or goals that were not provided."
        )

    if not parts:
        return "User profile is empty. Give general best-practice food advice."
    return "\n".join(f"- {p}" for p in parts)


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------


def _get_message_text(response: Any) -> str:
    message = response.choices[0].message
    content = message.content

    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
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


def _call(
    *,
    messages: list[dict[str, Any]],
    max_tokens: int,
    temperature: float = 0.2,
    top_p: float = 0.95,
) -> str:
    client = _client()
    model = _model()

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )
    except Exception:
        # Some hosted variants reject extra_body; retry without it.
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
        )

    text = _get_message_text(response)
    if not text:
        raise RuntimeError("Nemotron returned empty content.")
    return text


def _parse_json(text: str) -> dict[str, Any]:
    """
    Parse JSON from a model response. Handles raw JSON or ```json fenced.
    Raises ValueError on failure rather than returning fabricated data.
    """
    cleaned = text.strip()

    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, re.DOTALL)
    if fenced:
        cleaned = fenced.group(1).strip()

    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start : end + 1]

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Could not parse JSON from Nemotron output: {exc}") from exc


def _image_to_data_url(image_bytes: bytes, filename: Optional[str]) -> str:
    mime_type = None
    if filename:
        mime_type, _ = mimetypes.guess_type(filename)
    if mime_type is None:
        mime_type = "image/jpeg"
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


# ---------------------------------------------------------------------------
# /chat synthesis
# ---------------------------------------------------------------------------


def _format_places_for_prompt(places: list[dict[str, Any]]) -> str:
    """Compact summary of ranked places so the model has the data it needs."""
    lines: list[str] = []
    for idx, place in enumerate(places, start=1):
        name = (place.get("displayName") or {}).get("text") or "Unknown"
        rating = place.get("rating")
        review_count = place.get("userRatingCount")
        price = place.get("priceLevel")
        distance = place.get("distanceMiles")
        open_now = (place.get("currentOpeningHours") or {}).get("openNow")
        types = place.get("types") or []
        primary = place.get("primaryType")
        components = place.get("foragerScoreComponents") or {}

        line = (
            f"{idx}. {name} | rating={rating} ({review_count} reviews) | "
            f"price={price} | "
            f"distance={distance:.2f}mi" if distance is not None else f"{idx}. {name}"
        )
        if distance is not None:
            line = (
                f"{idx}. {name} | rating={rating} ({review_count} reviews) | "
                f"price={price} | distance={distance:.2f}mi | "
                f"open_now={open_now} | primaryType={primary} | "
                f"types={types[:5]} | foragerScore={place.get('foragerScore', 0):.3f} | "
                f"components={components}"
            )
        lines.append(line)
    return "\n".join(lines)


def synthesize_chat_recommendations(
    *,
    user_message: str,
    profile: UserProfile,
    places: list[dict[str, Any]],
    usda_results: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """
    Pick a recommended order at each top place and return structured JSON
    matching the frontend's Recommendation type.
    """
    if not places:
        raise ValueError("No places to synthesize from.")

    constraints = build_constraints_block(profile)
    places_block = _format_places_for_prompt(places)
    usda_block = (
        json.dumps(usda_results, indent=2, ensure_ascii=False)
        if usda_results
        else "No USDA reference data available."
    )

    system_prompt = (
        "You are Forager, an AI food decision assistant. "
        "You are given the user's request, their profile constraints, a ranked "
        "list of nearby restaurants, and optional USDA nutrition reference "
        "data. Return JSON ONLY (no markdown fence, no explanation outside JSON).\n\n"
        "Rules:\n"
        "1. Honor allergens and diet rules absolutely. If a place is unsuitable, "
        "skip it; do not lower the standard.\n"
        "2. USDA values are references only, not exact restaurant macros. Use "
        "ranges, never single numbers, and pick a confidence honestly.\n"
        "3. Suggest realistic order modifications when they help the user's goal.\n"
        "4. If you are unsure about an ingredient, list a question for the waiter "
        "instead of guessing.\n\n"
        "JSON schema:\n"
        "{\n"
        '  "answer": "string (1-3 sentences in the user\'s preferred language)",\n'
        '  "recommendations": [\n'
        "    {\n"
        '      "place": "string (use exactly the place name from the list)",\n'
        '      "order": "string (specific dish or order)",\n'
        '      "estimated_macros": {\n'
        '        "calories": "string range like \\"650-800 kcal\\"",\n'
        '        "protein": "string range like \\"35-50 g\\"",\n'
        '        "carbs": "string range",\n'
        '        "fat": "string range",\n'
        '        "confidence": "high | medium | low"\n'
        "      },\n"
        '      "why": "string (short, ties back to the user\'s goal/budget/etc.)",\n'
        '      "suggested_modifications": ["string", ...],\n'
        '      "allergen_warnings": ["string", ...]\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Return up to 3 recommendations from the top of the ranked list."
    )

    user_prompt = (
        f"User message: {user_message}\n\n"
        f"User profile constraints:\n{constraints}\n\n"
        f"Ranked nearby places:\n{places_block}\n\n"
        f"USDA reference data:\n{usda_block}"
    )

    text = _call(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=2000,
        temperature=0.2,
    )

    return _parse_json(text)


# ---------------------------------------------------------------------------
# /analyze-menu pipeline
# ---------------------------------------------------------------------------


def analyze_menu_image(
    *,
    image_bytes: bytes,
    filename: Optional[str],
    profile: UserProfile,
) -> str:
    """Step 1: vision pass over the menu image, freeform text out."""
    constraints = build_constraints_block(profile)
    data_url = _image_to_data_url(image_bytes, filename)

    system_prompt = (
        "You are Forager, an AI food decision assistant analyzing a restaurant "
        "menu image. Identify visible dishes, transcribe and translate dish "
        "names when possible, and flag any items that conflict with the user's "
        "constraints.\n\n"
        f"User profile constraints:\n{constraints}\n\n"
        "Do not estimate exact nutrition yet."
    )

    return _call(
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {
                        "type": "text",
                        "text": (
                            "Analyze this menu. Describe visible dishes. Translate "
                            "dish names if possible. Identify which options best "
                            "match the user's profile and goal. Note any "
                            "uncertainty if the image is unclear."
                        ),
                    },
                ],
            },
        ],
        max_tokens=1600,
        temperature=0.2,
    )


def extract_menu_analysis_json(
    *,
    menu_description: str,
    profile: UserProfile,
) -> dict[str, Any]:
    """
    Step 2: convert freeform menu description into structured JSON we can
    feed to USDA. Raises if Nemotron output is unparseable.
    """
    constraints = build_constraints_block(profile)

    system_prompt = (
        "You convert a restaurant menu analysis into JSON. Return JSON only.\n\n"
        f"User profile constraints:\n{constraints}\n\n"
        "JSON schema:\n"
        "{\n"
        '  "detected_language": "string",\n'
        '  "best_dish_original": "string",\n'
        '  "best_dish_english": "string",\n'
        '  "likely_ingredients": ["string", ...],\n'
        '  "cooking_method": "string",\n'
        '  "usda_queries": ["string", ...],\n'
        '  "reason_for_choice": "string",\n'
        '  "uncertainty": "string"\n'
        "}\n\n"
        "USDA queries should be short English food searches (e.g. "
        "'grilled chicken taco', 'beef pepper stir fry')."
    )

    text = _call(
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "Menu analysis to convert:\n\n"
                    f"{menu_description}"
                ),
            },
        ],
        max_tokens=1200,
        temperature=0.1,
    )

    return _parse_json(text)


def synthesize_menu_recommendation(
    *,
    profile: UserProfile,
    menu_description: str,
    menu_analysis: dict[str, Any],
    usda_results: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Step 3: feed image analysis + USDA reference back to Nemotron and ask for
    structured JSON matching MenuRecommendation. Raises on failure.
    """
    constraints = build_constraints_block(profile)

    system_prompt = (
        "You are Forager. Produce the final menu recommendation JSON only.\n\n"
        f"User profile constraints:\n{constraints}\n\n"
        "Rules:\n"
        "1. USDA data is reference only. Use macro ranges and an honest "
        "confidence level.\n"
        "2. Honor allergens and diet rules absolutely.\n"
        "3. List concrete questions for the waiter when uncertain.\n"
        "4. Include cultural notes only if explainCulturalNorms is enabled.\n\n"
        "JSON schema:\n"
        "{\n"
        '  "detected_language": "string",\n'
        '  "summary": "string (1-2 sentences in user\'s preferred language)",\n'
        '  "recommendations": [\n'
        "    {\n"
        '      "dish_original": "string",\n'
        '      "dish_translated": "string | null",\n'
        '      "likely_ingredients": ["string", ...],\n'
        '      "estimated_macros": {\n'
        '        "calories": "range string",\n'
        '        "protein": "range string",\n'
        '        "carbs": "range string",\n'
        '        "fat": "range string",\n'
        '        "confidence": "high | medium | low"\n'
        "      },\n"
        '      "why": "string",\n'
        '      "suggested_modifications": ["string", ...],\n'
        '      "allergen_warnings": ["string", ...],\n'
        '      "cultural_notes": "string | null",\n'
        '      "questions_for_waiter": ["string", ...]\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user_prompt = (
        f"Menu image analysis:\n{menu_description}\n\n"
        f"Structured menu analysis:\n"
        f"{json.dumps(menu_analysis, indent=2, ensure_ascii=False)}\n\n"
        f"USDA reference results:\n"
        f"{json.dumps(usda_results, indent=2, ensure_ascii=False)}"
    )

    text = _call(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=2000,
        temperature=0.2,
    )

    return _parse_json(text)
