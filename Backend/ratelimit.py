import time
from collections import defaultdict

from fastapi import HTTPException, Request

_hits: dict[str, list[float]] = defaultdict(list)


def rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    """Fixed-window limiter keyed by an arbitrary string (e.g. "login:1.2.3.4").
    In-memory only — resets on cold start, so this is a best-effort speed bump
    against brute-forcing, not a hard guarantee on serverless."""
    now = time.time()
    hits = _hits[key]
    hits[:] = [t for t in hits if now - t < window_seconds]
    if len(hits) >= max_attempts:
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")
    hits.append(now)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
