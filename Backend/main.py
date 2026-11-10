import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

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

# Swagger UI / ReDoc / the raw OpenAPI schema list every endpoint (including
# that /admin/* exists) to anyone who asks. Harmless in local dev; on Vercel
# (see database.py's own VERCEL check) there's no reason to advertise the
# full API surface to the public internet, so all three are disabled there.
_in_prod = bool(os.getenv("VERCEL"))
app = FastAPI(
    title="NinerMarket API",
    docs_url=None if _in_prod else "/docs",
    redoc_url=None if _in_prod else "/redoc",
    openapi_url=None if _in_prod else "/openapi.json",
)

_allowed = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

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
