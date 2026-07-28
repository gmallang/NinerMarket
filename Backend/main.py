from fastapi import FastAPI
from routes import users, listings, messages, ratings

app = FastAPI()

app.include_router(users.router)
app.include_router(listings.router)
app.include_router(messages.router)
app.include_router(ratings.router)