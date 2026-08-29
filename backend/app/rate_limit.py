"""Per-instance abuse guard for public read/compute endpoints."""

from __future__ import annotations

import threading
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    _lock = threading.Lock()
    _hits: dict[tuple[str, str], list[float]] = {}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "POST" and (path.startswith("/agents/") or path.endswith("/agent-run")):
            bucket, limit, window = "compute", 12, 60
        elif path == "/registry/agents/search":
            bucket, limit, window = "registry-search", 10, 60
        elif path == "/registry/provider-acceptance":
            bucket, limit, window = "provider-acceptance", 8, 60
        elif path == "/registry/provider-capability":
            bucket, limit, window = "provider-capability", 8, 60
        elif path == "/registry/provider-card":
            bucket, limit, window = "provider-card", 8, 60
        elif path == "/registry/provider-execution":
            bucket, limit, window = "provider-execution", 4, 60
        else:
            return await call_next(request)
        forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
        client = forwarded or (request.client.host if request.client else "unknown")
        now = time.monotonic()
        key = (client, bucket)
        with self._lock:
            active = [stamp for stamp in self._hits.get(key, []) if stamp > now - window]
            if len(active) >= limit:
                retry = max(1, int(window - (now - active[0])))
                return JSONResponse({"detail": "Rate limit exceeded. Retry shortly."}, status_code=429, headers={"Retry-After": str(retry)})
            active.append(now)
            self._hits[key] = active
            if len(self._hits) > 2000:
                self._hits = {item: stamps for item, stamps in self._hits.items() if stamps and stamps[-1] > now - 300}
        return await call_next(request)
