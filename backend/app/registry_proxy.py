"""Small allowlisted, cached proxy for the public 8004scan index."""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


BASE_URL = "https://8004scan.io/api/v1/public"
API_KEY = os.getenv("SCAN8004_API_KEY", "")
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_lock = threading.Lock()


class RegistryProxyError(RuntimeError):
    pass


def fetch_registry(path: str, params: dict[str, str], ttl_seconds: int = 120) -> dict[str, Any]:
    query = urllib.parse.urlencode(sorted(params.items()))
    url = f"{BASE_URL}{path}?{query}" if query else f"{BASE_URL}{path}"
    now = time.monotonic()
    with _lock:
        cached = _cache.get(url)
        if cached and cached[0] > now:
            return cached[1]
    headers = {"Accept": "application/json", "User-Agent": "MANDATE/1.0"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=12) as response:
            payload = json.loads(response.read())
    except (OSError, ValueError, urllib.error.URLError) as exc:
        raise RegistryProxyError(f"8004scan request failed: {exc}") from exc
    if not isinstance(payload, dict) or payload.get("success") is False:
        raise RegistryProxyError("8004scan returned an unsuccessful payload")
    with _lock:
        _cache[url] = (now + ttl_seconds, payload)
        if len(_cache) > 100:
            for key, value in list(_cache.items()):
                if value[0] <= now:
                    _cache.pop(key, None)
    return payload
