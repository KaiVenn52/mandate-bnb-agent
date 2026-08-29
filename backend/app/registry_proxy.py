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
        # Keep an expired snapshot as a last-resort read-only fallback. The
        # caller still receives its original registry timestamp, so stale data
        # cannot be mistaken for a fresh score or performance claim.
        stale_payload = cached[1] if cached else None
    headers = {"Accept": "application/json", "User-Agent": "MANDATE/1.0"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    request = urllib.request.Request(url, headers=headers)
    timeout = float(os.getenv("SCAN8004_TIMEOUT_SECONDS", "14"))
    last_error: Exception | None = None
    payload: Any = None
    # Anonymous registry reads can transiently time out. One bounded retry is
    # enough to smooth that edge without turning the public endpoint into an
    # unbounded proxy or exceeding the Vercel function budget.
    for attempt in range(2):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = json.loads(response.read())
            break
        except (OSError, ValueError, urllib.error.URLError) as exc:
            last_error = exc
            if attempt == 0:
                time.sleep(0.25)
    if payload is None:
        if stale_payload is not None:
            # Keep stale registry data usable for a degraded read-only view,
            # but make the cache state machine-readable so the UI never calls
            # an old snapshot "live".
            stale = dict(stale_payload)
            meta = dict(stale.get("meta") or {})
            meta["mandate_cache_stale"] = True
            meta["mandate_cache_served_at_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            stale["meta"] = meta
            return stale
        raise RegistryProxyError(f"8004scan request failed: {last_error}") from last_error
    if not isinstance(payload, dict) or payload.get("success") is False:
        raise RegistryProxyError("8004scan returned an unsuccessful payload")
    with _lock:
        _cache[url] = (now + ttl_seconds, payload)
        if len(_cache) > 100:
            for key, value in list(_cache.items()):
                if value[0] <= now:
                    _cache.pop(key, None)
    return payload
