"""Request IDs, request logs, and JSON bodies for unhandled failures.

Two production problems motivated this module:

1. Any unhandled exception escaped to Starlette's outermost error handler,
   which answers with a bodyless 500 *outside* CORSMiddleware. The browser
   therefore reported "blocked by CORS policy: No 'Access-Control-Allow-Origin'
   header" for what was really a 500, and the actual traceback never reached
   the person debugging it. That is exactly how the 2026-11-11 outage (three
   missing `users` columns) looked like a CORS misconfiguration for hours.
2. Requests carried no identifier, so a user-visible failure could not be
   matched to a log line.

`RequestContextMiddleware` must be registered *before* CORSMiddleware: Starlette
runs the last-added middleware outermost, so CORS then wraps this one and the
error response keeps its CORS headers. main.py does that and says why.
"""

import json
import logging
import os
import time
import uuid
from contextvars import ContextVar
from typing import Any

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Readable from anywhere a request is being handled (routes, error handlers).
request_id_var: ContextVar[str] = ContextVar("request_id", default="")

logger = logging.getLogger("uvicorn.error")

# A client may send its own id (proxies and mobile clients do); it is only ever
# echoed and logged, so cap it and drop anything that would make logs forgeable.
_MAX_REQUEST_ID = 64
_SAFE_ID_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")


def current_request_id() -> str:
    return request_id_var.get()


class JsonFormatter(logging.Formatter):
    """One JSON object per line, request id included. Opt-in (LOG_JSON=1) so
    local development keeps the readable default output."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname,
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "logger": record.name,
            "message": record.getMessage(),
        }
        request_id = request_id_var.get()
        if request_id:
            payload["request_id"] = request_id
        if record.exc_info:
            payload["traceback"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging() -> None:
    """Installs the JSON formatter when LOG_JSON is set. Otherwise this is a
    no-op and uvicorn keeps its own handlers."""
    if not os.getenv("LOG_JSON"):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)


def _incoming_request_id(scope: Scope) -> str:
    for name, value in scope.get("headers") or []:
        if name != b"x-request-id":
            continue
        candidate = value.decode("latin-1").strip()
        if candidate and len(candidate) <= _MAX_REQUEST_ID:
            if set(candidate) <= _SAFE_ID_CHARS:
                return candidate
    return uuid.uuid4().hex[:16]


class RequestContextMiddleware:
    """Stamps every request with an id, answers unhandled exceptions with JSON,
    and logs one line per request. Pure ASGI on purpose: BaseHTTPMiddleware
    cannot always tell whether the response has already started, and writing a
    second response corrupts the connection."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _incoming_request_id(scope)
        token = request_id_var.set(request_id)
        method = scope.get("method", "")
        path = scope.get("path", "")
        started = False
        status = 500
        start = time.perf_counter()

        async def send_with_id(message: Message) -> None:
            nonlocal started, status
            if message["type"] == "http.response.start":
                started = True
                status = message["status"]
                MutableHeaders(scope=message)["X-Request-Id"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception as exc:
            # The full traceback goes to the server log; the caller gets an id
            # they can quote, plus the exception type (never its message, which
            # can carry user data or internal hostnames).
            logger.exception("unhandled error on %s %s [%s]", method, path, request_id)
            if not started:
                body = json.dumps(
                    {
                        "detail": "Internal server error",
                        "error": type(exc).__name__,
                        "request_id": request_id,
                    }
                ).encode()
                status = 500
                await send(
                    {
                        "type": "http.response.start",
                        "status": 500,
                        "headers": [
                            (b"content-type", b"application/json"),
                            (b"content-length", str(len(body)).encode()),
                            (b"x-request-id", request_id.encode()),
                        ],
                    }
                )
                await send({"type": "http.response.body", "body": body})
        finally:
            # Readiness/liveness probes are polled constantly; logging them
            # would bury real traffic.
            if path not in ("/healthz", "/readyz"):
                logger.info(
                    "%s %s -> %s in %.0fms [%s]",
                    method,
                    path,
                    status,
                    (time.perf_counter() - start) * 1000,
                    request_id,
                )
            request_id_var.reset(token)
