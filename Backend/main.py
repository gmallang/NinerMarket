from fastapi import FastAPI
from routes import users, listings, ratings

app = FastAPI()

app.include_router(users.router)
app.include_router(listings.router)
app.include_router(ratings.router)