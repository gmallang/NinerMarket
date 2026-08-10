import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import users, listings, ratings, notifications, messaging, photos, offers

app = FastAPI(title="NinerMarket API")

_allowed = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(listings.router)
app.include_router(ratings.router)
app.include_router(notifications.router)
app.include_router(messaging.router)
app.include_router(photos.router)
app.include_router(offers.router)
