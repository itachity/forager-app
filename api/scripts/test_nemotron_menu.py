"""
Smoke test: NVIDIA Nemotron Omni + menu image + USDA macro reference.

Goal:
- Send a foreign-language menu image to Nemotron.
- Ask Nemotron to identify the best low-calorie, high-protein healthy meal.
- Ask Nemotron to generate USDA FoodData Central search queries.
- Call USDA directly from Python.
- Feed USDA results back to Nemotron.
- Print a realistic final recommendation with macro ranges and confidence.

Run from api/:
    python scripts/test_nemotron_menu.py --image sample_menu.jpg

Expected files:
    api/.env
    api/sample_menu.jpg

Required api/.env:
    NVIDIA_API_KEY=your_real_key_here
    USDA_API_KEY=your_real_key_here
    NEMOTRON_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
"""

import argparse
import base64
import json
import mimetypes
import os
import re
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from openai import OpenAI


# ------------------------------------------------------------
# Setup
# ------------------------------------------------------------

API_DIR = Path(__file__).resolve().parents[1]
load_dotenv(API_DIR / ".env")

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
USDA_API_KEY = os.getenv("USDA_API_KEY")

MODEL = os.getenv(
    "NEMOTRON_MODEL",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
)

if not NVIDIA_API_KEY:
    raise RuntimeError("Missing NVIDIA_API_KEY in api/.env")

if not USDA_API_KEY:
    raise RuntimeError("Missing USDA_API_KEY in api/.env")

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=NVIDIA_API_KEY,
)


# ------------------------------------------------------------
# Utility helpers
# ------------------------------------------------------------

def resolve_image_path(image_arg: str) -> Path:
    """
    Allows:
    - python scripts/test_nemotron_menu.py --image sample_menu.jpg
    - python scripts/test_nemotron_menu.py --image scripts/sample_menu.jpg
    - python scripts/test_nemotron_menu.py --image C:/full/path/sample_menu.jpg
    """
    raw_path = Path(image_arg)

    if raw_path.is_absolute() and raw_path.exists():
        return raw_path

    current_dir_path = Path.cwd() / raw_path
    if current_dir_path.exists():
        return current_dir_path

    api_dir_path = API_DIR / raw_path
    if api_dir_path.exists():
        return api_dir_path

    scripts_dir_path = API_DIR / "scripts" / raw_path
    if scripts_dir_path.exists():
        return scripts_dir_path

    raise FileNotFoundError(
        f"Could not find image: {image_arg}\n"
        f"Tried:\n"
        f"- {current_dir_path}\n"
        f"- {api_dir_path}\n"
        f"- {scripts_dir_path}"
    )


def image_to_data_url(image_path: Path) -> str:
    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    mime_type, _ = mimetypes.guess_type(str(image_path))
    if mime_type is None:
        mime_type = "image/jpeg"

    image_bytes = image_path.read_bytes()
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def get_message_text(response: Any) -> str:
    """
    Extracts message.content safely.
    Some OpenAI-compatible APIs may return content as a string or list.
    """
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
    max_tokens: int = 1200,
    temperature: float = 0.2,
    label: str = "Nemotron call",
) -> Any:
    """
    Calls Nemotron with a safer retry pattern.

    First tries enable_thinking=False because reasoning models sometimes produce
    empty visible content. If that fails, retries without extra_body.
    """
    print(f"\n--- {label} ---")

    try:
        return client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=temperature,
            top_p=0.95,
            max_tokens=max_tokens,
            extra_body={
                "chat_template_kwargs": {
                    "enable_thinking": False
                }
            },
        )
    except Exception as first_error:
        print("\nFirst call failed with enable_thinking=False.")
        print(f"Error: {first_error}")
        print("\nRetrying without extra_body...")

        return client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=temperature,
            top_p=0.95,
            max_tokens=max_tokens,
        )


def extract_json_from_text(text: str) -> dict[str, Any]:
    """
    Tries to parse model output as JSON.
    Handles raw JSON or fenced ```json blocks.
    """
    cleaned = text.strip()

    # Remove markdown JSON fence if present.
    fenced_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
    if fenced_match:
        cleaned = fenced_match.group(1).strip()

    # If there is extra text, grab the biggest JSON-looking object.
    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start:end + 1]

    return json.loads(cleaned)


# ------------------------------------------------------------
# USDA helpers
# ------------------------------------------------------------

def normalize_energy_to_kcal(value: float, unit: str | None) -> str:
    """
    USDA sometimes returns Energy as KCAL and sometimes as kJ.
    If it is kJ, convert to kcal so we do not accidentally call kJ calories.
    """
    if unit is None:
        return f"{value:.0f} kcal"

    normalized_unit = unit.strip().lower()

    if normalized_unit in ["kcal", "calorie", "calories"]:
        return f"{value:.0f} kcal"

    if normalized_unit in ["kj", "kilojoule", "kilojoules"]:
        kcal = value / 4.184
        return f"{kcal:.0f} kcal"

    return f"{value} {unit}"


def extract_macros(food: dict[str, Any]) -> dict[str, Any]:
    """
    USDA foodNutrients usually include nutrientName/value/unitName.
    This extracts major macro fields when present.

    Important:
    - USDA values are references only.
    - They may be per 100 g, per serving, branded item, or survey estimate.
    - They are not exact restaurant meal macros.
    """
    macros = {
        "calories": None,
        "protein": None,
        "carbs": None,
        "fat": None,
    }

    # Prefer KCAL over kJ if both are present.
    energy_kj_backup = None

    for nutrient in food.get("foodNutrients", []):
        name = (nutrient.get("nutrientName") or "").lower()
        value = nutrient.get("value")
        unit = nutrient.get("unitName")

        if value is None:
            continue

        if "energy" in name:
            normalized_unit = (unit or "").strip().lower()

            if normalized_unit in ["kcal", "calorie", "calories"]:
                macros["calories"] = normalize_energy_to_kcal(float(value), unit)
            elif normalized_unit in ["kj", "kilojoule", "kilojoules"]:
                energy_kj_backup = normalize_energy_to_kcal(float(value), unit)
            elif macros["calories"] is None:
                macros["calories"] = normalize_energy_to_kcal(float(value), unit)

        elif "protein" in name and macros["protein"] is None:
            macros["protein"] = f"{float(value):.1f} {unit}"

        elif "carbohydrate" in name and macros["carbs"] is None:
            macros["carbs"] = f"{float(value):.1f} {unit}"

        elif ("total lipid" in name or name.strip() == "fat") and macros["fat"] is None:
            macros["fat"] = f"{float(value):.1f} {unit}"

    if macros["calories"] is None and energy_kj_backup is not None:
        macros["calories"] = energy_kj_backup

    return macros


def search_usda_foods(query: str, page_size: int = 5) -> dict[str, Any]:
    """
    Searches USDA FoodData Central and returns simplified macro info.
    """
    page_size = max(1, min(page_size, 5))

    url = "https://api.nal.usda.gov/fdc/v1/foods/search"
    params = {"api_key": USDA_API_KEY}
    payload = {
        "query": query,
        "pageSize": page_size,
    }

    with httpx.Client(timeout=20.0) as http:
        response = http.post(url, params=params, json=payload)
        response.raise_for_status()
        data = response.json()

    foods = []
    for food in data.get("foods", [])[:page_size]:
        foods.append(
            {
                "fdcId": food.get("fdcId"),
                "description": food.get("description"),
                "dataType": food.get("dataType"),
                "brandOwner": food.get("brandOwner"),
                "servingSize": food.get("servingSize"),
                "servingSizeUnit": food.get("servingSizeUnit"),
                "householdServingFullText": food.get("householdServingFullText"),
                "macros": extract_macros(food),
            }
        )

    return {
        "query": query,
        "source": "USDA FoodData Central",
        "important_warning": (
            "USDA values are references only. They may be per 100 g, per serving, "
            "or from a branded/survey item. Do not treat them as exact restaurant meal macros."
        ),
        "results": foods,
    }


# ------------------------------------------------------------
# Nemotron pipeline
# ------------------------------------------------------------

def analyze_menu_image(image_path: Path) -> str:
    """
    Step 1:
    Ask Nemotron to read the image and describe/transcribe useful menu info.

    This intentionally does NOT ask for JSON, because strict JSON + image can
    produce empty responses on some hosted reasoning models.
    """
    data_url = image_to_data_url(image_path)

    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "You are Forager, an AI food decision assistant. "
                "You analyze restaurant menu images in any language. "
                "Your job is to describe the menu, identify visible dishes, translate dish names when possible, "
                "and identify which options are likely healthier, lower calorie, and higher protein. "
                "Do not estimate exact nutrition yet."
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
                        "Analyze this menu image. "
                        "Describe the visible dishes. "
                        "Translate important dish names if possible. "
                        "Identify the best healthy low-calorie, high-protein option. "
                        "Also mention any uncertainty if the image is unclear."
                    ),
                },
            ],
        },
    ]

    response = call_nemotron(
        messages=messages,
        max_tokens=1600,
        temperature=0.2,
        label="Step 1: Nemotron vision menu analysis",
    )

    text = get_message_text(response)

    if not text:
        print("\nNemotron returned empty content for the image analysis.")
        print("Full raw response:")
        print(response.model_dump_json(indent=2))
        raise RuntimeError(
            "Empty vision response. Try a clearer image, lower image size, "
            "or verify the model's exact NVIDIA Build code snippet."
        )

    return text


def extract_menu_analysis_json(menu_description: str) -> dict[str, Any]:
    """
    Step 2:
    Convert the freeform menu description into structured JSON.
    This is text-only, so it is more reliable than image-to-JSON.
    """
    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "You convert restaurant menu analysis into clean JSON for a food recommendation app. "
                "Return ONLY valid JSON. No markdown. No explanation outside JSON.\n\n"
                "JSON schema:\n"
                "{\n"
                '  "detected_language": "string",\n'
                '  "best_dish_original": "string",\n'
                '  "best_dish_english": "string",\n'
                '  "likely_ingredients": ["string"],\n'
                '  "cooking_method": "string",\n'
                '  "usda_queries": ["string", "string", "string"],\n'
                '  "reason_for_choice": "string",\n'
                '  "uncertainty": "string"\n'
                "}\n\n"
                "The USDA queries should be short English food searches like "
                "'beef pepper stir fry', 'grilled chicken taco', or 'chicken rice bowl'."
            ),
        },
        {
            "role": "user",
            "content": (
                "Here is the menu image analysis:\n\n"
                f"{menu_description}\n\n"
                "Extract the best healthy low-calorie, high-protein option and produce the JSON."
            ),
        },
    ]

    response = call_nemotron(
        messages=messages,
        max_tokens=1200,
        temperature=0.1,
        label="Step 2: Extracting structured menu analysis JSON",
    )

    text = get_message_text(response)

    if not text:
        print("\nNemotron returned empty content for JSON extraction.")
        print("Full raw response:")
        print(response.model_dump_json(indent=2))
        raise RuntimeError("Empty JSON extraction response.")

    print("\n--- Raw JSON extraction response ---")
    print(text)

    try:
        return extract_json_from_text(text)
    except json.JSONDecodeError:
        print("\nCould not parse JSON from Nemotron.")
        print("Raw response was:")
        print(text)

        # Safe fallback so the script can continue during hackathon testing.
        return {
            "detected_language": "unknown",
            "best_dish_original": "unknown",
            "best_dish_english": "lean protein dish from menu",
            "likely_ingredients": ["lean protein", "vegetables"],
            "cooking_method": "unknown",
            "usda_queries": [
                "grilled chicken",
                "beef stir fry",
                "fish with vegetables"
            ],
            "reason_for_choice": (
                "Fallback used because the model did not return valid JSON."
            ),
            "uncertainty": (
                "High uncertainty because structured JSON extraction failed."
            ),
        }


def call_usda_for_queries(usda_queries: list[str]) -> list[dict[str, Any]]:
    """
    Step 3:
    Call USDA directly from Python using the queries generated by Nemotron.
    """
    print("\n--- Step 3: Calling USDA FoodData Central ---")

    usda_results = []

    for query in usda_queries[:3]:
        print(f"\nUSDA query: {query}")

        try:
            result = search_usda_foods(query=query, page_size=3)
        except Exception as exc:
            result = {
                "query": query,
                "error": str(exc),
            }

        usda_results.append(result)
        print(json.dumps(result, indent=2, ensure_ascii=False))

    return usda_results


def create_final_recommendation(
    menu_description: str,
    menu_analysis: dict[str, Any],
    usda_results: list[dict[str, Any]],
) -> str:
    """
    Step 4:
    Feed image analysis + USDA reference data back to Nemotron.
    Ask for realistic macro ranges.
    """
    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "You are Forager, an AI food decision assistant. "
                "You make realistic restaurant meal recommendations using menu image analysis "
                "and USDA nutrition reference data.\n\n"
                "Important nutrition rules:\n"
                "1. USDA data is only a reference, not exact restaurant nutrition.\n"
                "2. Never treat one USDA result as the exact macro value for the whole restaurant dish.\n"
                "3. Estimate realistic restaurant portion sizes.\n"
                "4. Account for oil, sauce, rice, noodles, breading, frying, and portion uncertainty.\n"
                "5. Always give macro ranges, not exact values.\n"
                "6. If portion size is unclear, use medium-low or low confidence.\n"
                "7. Wider ranges are better than fake precision.\n"
                "8. Say clearly that the user should verify ingredients and portion size with the restaurant.\n\n"
                "Final answer format:\n"
                "## Best recommendation\n"
                "## Translation\n"
                "## Why it fits low-calorie high-protein goals\n"
                "## Estimated macro range\n"
                "Use a markdown table with Calories, Protein, Carbs, Fat, and Confidence.\n"
                "## Confidence and uncertainty\n"
                "## What to ask the waiter"
            ),
        },
        {
            "role": "user",
            "content": (
                "Menu image analysis:\n\n"
                f"{menu_description}\n\n"
                "Structured menu analysis:\n\n"
                f"{json.dumps(menu_analysis, indent=2, ensure_ascii=False)}\n\n"
                "USDA reference results:\n\n"
                f"{json.dumps(usda_results, indent=2, ensure_ascii=False)}\n\n"
                "Now make the final recommendation. "
                "Use realistic restaurant macro ranges. "
                "Do not overclaim. Do not say USDA gives exact restaurant macros."
            ),
        },
    ]

    response = call_nemotron(
        messages=messages,
        max_tokens=2000,
        temperature=0.2,
        label="Step 4: Final Nemotron recommendation",
    )

    text = get_message_text(response)

    if not text:
        print("\nNemotron returned empty content for final recommendation.")
        print("Full raw response:")
        print(response.model_dump_json(indent=2))
        raise RuntimeError("Empty final recommendation response.")

    return text


def run_menu_test(image_path: Path) -> None:
    print("\n=== NEMOTRON MENU IMAGE + USDA MACRO TEST ===")
    print(f"Model: {MODEL}")
    print(f"Image: {image_path}")

    # Step 1
    menu_description = analyze_menu_image(image_path)

    print("\n=== STEP 1 RESULT: MENU IMAGE ANALYSIS ===")
    print(menu_description)

    # Step 2
    menu_analysis = extract_menu_analysis_json(menu_description)

    print("\n=== STEP 2 RESULT: STRUCTURED MENU ANALYSIS ===")
    print(json.dumps(menu_analysis, indent=2, ensure_ascii=False))

    # Step 3
    usda_queries = menu_analysis.get("usda_queries", [])

    if not usda_queries:
        print("\nNo USDA queries found. Using fallback queries.")
        usda_queries = [
            "grilled chicken",
            "beef stir fry",
            "fish with vegetables",
        ]

    usda_results = call_usda_for_queries(usda_queries)

    # Step 4
    final_recommendation = create_final_recommendation(
        menu_description=menu_description,
        menu_analysis=menu_analysis,
        usda_results=usda_results,
    )

    print("\n=== FINAL RECOMMENDATION ===")
    print(final_recommendation)


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--image",
        default="menu.jpg",
        help="Path to menu image. Default: menu.jpg in current folder.",
    )

    args = parser.parse_args()

    resolved_image_path = resolve_image_path(args.image)
    run_menu_test(resolved_image_path)