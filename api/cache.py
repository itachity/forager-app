"""
Simple disk cache:
request-hash -> pickle cache

This is useful for hackathon demos so Google/USDA/Reddit calls do not fail
during judging because of rate limits or bad Wi-Fi.
"""

from __future__ import annotations

import functools
import hashlib
import json
import pickle
import time
from pathlib import Path
from typing import Any, Callable


CACHE_DIR = Path(__file__).resolve().parent / ".cache"
CACHE_DIR.mkdir(exist_ok=True)


def _json_default(value: Any) -> str:
    return repr(value)


def make_cache_key(function_name: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> str:
    payload = {
        "function": function_name,
        "args": args,
        "kwargs": kwargs,
    }

    raw = json.dumps(payload, sort_keys=True, default=_json_default)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def disk_cache(ttl_seconds: int = 3600) -> Callable:
    """
    Decorator for caching pure-ish API wrapper functions.

    Example:
        @disk_cache(ttl_seconds=3600)
        def search_google_places(...):
            ...
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            cache_key = make_cache_key(func.__name__, args, kwargs)
            cache_path = CACHE_DIR / f"{cache_key}.pkl"

            if cache_path.exists():
                try:
                    with cache_path.open("rb") as f:
                        cached = pickle.load(f)

                    age = time.time() - cached["created_at"]

                    if age <= ttl_seconds:
                        return cached["value"]

                except Exception:
                    # Bad cache should never kill the app.
                    cache_path.unlink(missing_ok=True)

            value = func(*args, **kwargs)

            try:
                with cache_path.open("wb") as f:
                    pickle.dump(
                        {
                            "created_at": time.time(),
                            "value": value,
                        },
                        f,
                    )
            except Exception:
                # Caching is nice-to-have only.
                pass

            return value

        return wrapper

    return decorator