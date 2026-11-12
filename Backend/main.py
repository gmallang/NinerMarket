import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import db
from image_moderation import ImageRejected
from observability import RequestContextMiddleware, configure_logging
from routes import (
    admin,
    users,
    listings,
    ratings,
    notifications,
    messaging,
    photos,
    offers,
    push,
    saved,
    wanted_requests,
)
from schema_check import check_schema

# Swagger UI / ReDoc / the raw OpenAPI schema list every endpoint (including
# that /admin/* exists) to anyone who asks. Harmless in local dev; on Vercel
# (see database.py's own VERCEL check) there's no reason to advertise the
# full API surface to the public internet, so all three are disabled there.
_in_prod = bool(os.getenv("VERCEL"))
configure_logging()
app = FastAPI(
    title="NinerMarket API",
    docs_url=None if _in_prod else "/docs",
    redoc_url=None if _in_prod else "/redoc",
    openapi_url=None if _in_prod else "/openapi.json",
)

@app.exception_handler(ImageRejected)
def _image_rejected(_request: Request, exc: ImageRejected) -> JSONResponse:
    """A photo blocked by the Terms check. Handled here rather than in each
    route so every upload path (standalone /photos, listing create/edit,
    wanted requests) answers the same way - the sell and request forms show
    this detail verbatim."""
    return JSONResponse(status_code=422, content={"detail": str(exc)})


_allowed = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

# Middleware order is load-bearing: Starlette runs the LAST added middleware
# outermost. RequestContextMiddleware is added first so CORSMiddleware wraps it,
# and the 500 it returns for an unhandled exception still carries CORS headers.
# Added the other way round, the browser reports that 500 as a CORS failure and
# the real error is invisible - which is exactly what happened when production
# was missing three `users` columns.
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    # The listings endpoint reports its unpaginated match count here; without
    # exposing it the browser can't read the header cross-origin and the
    # "Showing X–Y of Z" footer falls back to guesses.
    expose_headers=["X-Total-Count"],
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    """A JSON API doesn't need the full header set a browser-rendered site
    does (that's in Frontend/vercel.json), but nosniff costs nothing and
    closes off any browser path that'd try to render a response as HTML."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/healthz")
def healthz() -> dict:
    """Liveness: the process is up. Deliberately touches nothing external, so
    a provider outage can't get a healthy instance restarted."""
    return {"ok": True}


@app.get("/readyz")
def readyz() -> JSONResponse:
    """Readiness: can this instance serve authenticated traffic?

    With the in-memory dev store that is always yes. On Supabase it means every
    table and column the models use still exists (see schema_check.py) - the
    check that would have caught the 2026-11-11 outage before users did. The
    missing list stays in the server log: it names internal tables and has no
    business in a public response.
    """
    if db is None:
        return JSONResponse({"ok": True, "store": "memory"})

    report = check_schema()
    if report.ok:
        return JSONResponse({"ok": True, "store": "supabase"})
    return JSONResponse(status_code=503, content={"ok": False, "store": "supabase"})


app.include_router(users.router)
app.include_router(listings.router)
app.include_router(ratings.router)
app.include_router(notifications.router)
app.include_router(messaging.router)
app.include_router(photos.router)
app.include_router(offers.router)
app.include_router(push.router)
app.include_router(saved.router)
app.include_router(wanted_requests.router)
app.include_router(admin.router)
