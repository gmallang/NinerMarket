import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import require_user
from database import db, ratings, users
from models import Rating
from ratelimit import rate_limit

router = APIRouter()


@router.post("/ratings")
def create_rating(rating: Rating, user_id: str = Depends(require_user)):
    rate_limit(f"rating:{user_id}", max_attempts=20, window_seconds=3600)
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
        inserted = db.table("ratings").insert(rating.model_dump(mode="json")).execute()
    else:
        ratings[rating.id] = rating

    recompute_seller_rating(rating.ratee_id)
    return inserted.data[0] if db else rating


def recompute_seller_rating(ratee_id: str) -> None:
    """Rebuild the denormalized rating count/average from source rows.

    This has to be a full recompute rather than an increment: deleting a
    rating (for example from the admin panel) must remove its stars from the
    seller's average, not leave the old total in place.
    """
    if db:
        rows = db.table("ratings").select("stars").eq("ratee_id", ratee_id).execute().data
        stars = [int(row["stars"]) for row in rows]
        db.table("users").update(
            {
                "rating_avg": sum(stars) / len(stars) if stars else 0.0,
                "rating_count": len(stars),
            }
        ).eq("id", ratee_id).execute()
        return

    stars = [r.stars for r in ratings.values() if r.ratee_id == ratee_id]
    user = users.get(ratee_id)
    if not user:
        return
    user.rating_avg = sum(stars) / len(stars) if stars else 0.0
    user.rating_count = len(stars)


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
