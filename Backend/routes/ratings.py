import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import require_user
from database import db, ratings
from models import Rating

router = APIRouter()


@router.post("/ratings")
def create_rating(rating: Rating, user_id: str = Depends(require_user)):
    rating.rater_id = user_id
    if rating.rater_id == rating.ratee_id:
        raise HTTPException(status_code=400, detail="Cannot rate yourself")

    rating.id = rating.id or str(uuid.uuid4())

    if db:
        data = db.table("ratings").insert(rating.model_dump(mode="json")).execute()
        _update_seller_rating(rating.ratee_id, rating.stars)
        return data.data[0]

    ratings[rating.id] = rating
    return rating


def _update_seller_rating(ratee_id: str, stars: int):
    user_data = db.table("users").select("rating_avg, rating_count").eq("id", ratee_id).execute()
    if not user_data.data:
        return
    current = user_data.data[0]
    count = current.get("rating_count", 0)
    avg = current.get("rating_avg", 0.0)
    new_count = count + 1
    new_avg = (avg * count + stars) / new_count
    db.table("users").update({"rating_avg": new_avg, "rating_count": new_count}).eq("id", ratee_id).execute()


@router.get("/ratings/{ratee_id}")
def get_ratings(ratee_id: str):
    if db:
        return db.table("ratings").select("*").eq("ratee_id", ratee_id).execute().data
    return [r for r in ratings.values() if r.ratee_id == ratee_id]
