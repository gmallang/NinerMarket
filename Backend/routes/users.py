from fastapi import APIRouter, HTTPException, Query

from database import db, listings, users
from models import User
from routes.listings import SELLER_COLUMNS, _with_seller

router = APIRouter()


@router.post("/users")
def create_user(user: User):
    if not user.email.endswith("@charlotte.edu"):
        raise HTTPException(status_code=400, detail="Must use a .charlotte.edu email")

    if db:
        existing = db.table("users").select("id").eq("id", user.id).execute()
        if existing.data:
            raise HTTPException(status_code=409, detail="User already exists")
        data = db.table("users").insert(user.model_dump(mode="json")).execute()
        return data.data[0]

    if user.id in users:
        raise HTTPException(status_code=409, detail="User already exists")
    users[user.id] = user
    return user


@router.get("/users/{id}")
def get_user(id: str):
    if db:
        data = db.table("users").select("*").eq("id", id).execute()
        if not data.data:
            raise HTTPException(status_code=404, detail="User not found")
        return data.data[0]

    if id not in users:
        raise HTTPException(status_code=404, detail="User not found")
    return users[id]


@router.patch("/users/{id}")
def update_user(id: str, updates: dict):
    if db:
        existing = db.table("users").select("id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="User not found")
        data = db.table("users").update(updates).eq("id", id).execute()
        return data.data[0]

    if id not in users:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in updates.items():
        setattr(users[id], key, value)
    return users[id]


@router.get("/users/{id}/listings")
def get_user_listings(id: str, status: str | None = Query(default=None)):
    if db:
        query = db.table("listings").select("*").eq("seller_id", id)
        if status:
            query = query.eq("status", status)
        rows = query.execute().data

        seller = None
        sres = db.table("users").select(SELLER_COLUMNS).eq("id", id).execute()
        if sres.data:
            seller = sres.data[0]
        for row in rows:
            row["seller"] = seller
        return rows

    results = [l for l in listings.values() if l.seller_id == id]
    if status:
        results = [l for l in results if l.status == status]
    return [_with_seller(l) for l in results]
