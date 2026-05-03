from __future__ import annotations

from typing import Any, Callable

from tools.macros import get_macro_references, search_usda_foods
from tools.menus import analyze_menu_image_bytes
from tools.reddit import get_community_signal, search_reddit_website, suggest_subreddits
from tools.restaurants import search_and_score_restaurants, search_google_restaurants


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "search_restaurants",
            "description": "Search and score restaurants using Google Places and Forager scoring.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "lat": {"type": "number"},
                    "lng": {"type": "number"},
                    "radius_meters": {"type": "number"},
                },
                "required": ["query", "lat", "lng"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_usda_foods",
            "description": "Search USDA FoodData Central for macro references.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "page_size": {"type": "integer"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_reddit_website",
            "description": "Temporary Reddit website JSON fallback while waiting for Reddit API approval.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "subreddits": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "limit": {"type": "integer"},
                },
                "required": ["query"],
            },
        },
    },
]


DISPATCH_TABLE: dict[str, Callable[..., Any]] = {
    "search_google_restaurants": search_google_restaurants,
    "search_and_score_restaurants": search_and_score_restaurants,
    "search_usda_foods": search_usda_foods,
    "get_macro_references": get_macro_references,
    "suggest_subreddits": suggest_subreddits,
    "search_reddit_website": search_reddit_website,
    "get_community_signal": get_community_signal,
    "analyze_menu_image_bytes": analyze_menu_image_bytes,
}