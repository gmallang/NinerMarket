from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import users, listings, ratings

app = FastAPI(title="NinerMarket API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(listings.router)
app.include_router(ratings.router)
