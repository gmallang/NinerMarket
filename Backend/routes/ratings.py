import uuid
from fastapi import APIRouter, HTTPException
from models import Rating
from database import ratings

router = APIRouter()

@router.post("/ratings")
def create_rating(rating: Rating):
    rating.id = str(uuid.uuid4())
    ratings[rating.id] = rating
    return rating

@router.get("/ratings/{ratee_id}")
def get_ratings(ratee_id: str):
    return [r for r in ratings.values() if r.ratee_id == ratee_id]