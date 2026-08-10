import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import require_user
from database import db, ratings, users
from models import Rating

router = APIRouter()


@router.post("/ratings")
def create_rating(rating: Rating, user_id: str = Depends(require_user)):
    rating.rater_id = user_id
    if rating.rater_id == rating.ratee_id:
        raise HTTPException(status_code=400, detail="Cannot rate yourself")

    if db:
        dup = (
            db.table("ratings")
            .select("id")
            .eq("rater_id", rating.rater_id)
            .eq("ratee_id", rating.ratee_id)
            .execute()
        )
        if dup.data:
            raise HTTPException(status_code=409, detail="You've already rated this seller")
    elif any(
        r.rater_id == rating.rater_id and r.ratee_id == rating.ratee_id
        for r in ratings.values()
    ):
        raise HTTPException(status_code=409, detail="You've already rated this seller")

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


def _attach_rater(rows: list[dict]) -> list[dict]:
    rater_ids = {r.get("rater_id") for r in rows if r.get("rater_id")}
    names: dict[str, str] = {}
    if rater_ids:
        if db:
            res = (
                db.table("users")
                .select("id, display_name")
                .in_("id", list(rater_ids))
                .execute()
            )
            names = {u["id"]: u["display_name"] for u in res.data}
        else:
            names = {
                uid: user.display_name for uid, user in users.items() if uid in rater_ids
            }
    for r in rows:
        rid = r.get("rater_id")
        r["rater"] = (
            {"id": rid, "display_name": names.get(rid, "Former member")} if rid else None
        )
    return rows


@router.get("/ratings/{ratee_id}")
def get_ratings(ratee_id: str):
    if db:
        rows = db.table("ratings").select("*").eq("ratee_id", ratee_id).execute().data
        return _attach_rater(rows)
    rows = [r.model_dump(mode="json") for r in ratings.values() if r.ratee_id == ratee_id]
    return _attach_rater(rows)
