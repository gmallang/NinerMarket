import uuid

from fastapi import APIRouter, HTTPException, Query

from database import db, listings
from models import Listing

router = APIRouter()


def generate_id():
    return str(uuid.uuid4())


@router.get("/listings")
def list_listings(
    category: str | None = Query(default=None),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    status: str | None = Query(default=None),
):
    if db:
        query = db.table("listings").select("*")
        if category:
            query = query.eq("category", category)
        if min_price is not None:
            query = query.gte("price", min_price)
        if max_price is not None:
            query = query.lte("price", max_price)
        if status:
            query = query.eq("status", status)
        return query.execute().data

    results = listings.values()
    if category:
        results = [l for l in results if l.category == category]
    if min_price is not None:
        results = [l for l in results if l.price >= min_price]
    if max_price is not None:
        results = [l for l in results if l.price <= max_price]
    if status:
        results = [l for l in results if l.status == status]
    return list(results)


@router.post("/listings")
def create_listing(listing: Listing):
    listing.id = listing.id or generate_id()
    if db:
        data = db.table("listings").insert(listing.model_dump(mode="json")).execute()
        return data.data[0]

    listings[listing.id] = listing
    return listing


@router.get("/listings/{id}")
def get_listing(id: str):
    if db:
        data = db.table("listings").select("*").eq("id", id).execute()
        if not data.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        return data.data[0]

    if id not in listings:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listings[id]


@router.patch("/listings/{id}")
def update_listing(id: str, updates: dict):
    if db:
        existing = db.table("listings").select("*").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        data = db.table("listings").update(updates).eq("id", id).execute()
        return data.data[0]

    if id not in listings:
        raise HTTPException(status_code=404, detail="Listing not found")
    for key, value in updates.items():
        setattr(listings[id], key, value)
    return listings[id]


@router.delete("/listings/{id}")
def delete_listing(id: str):
    if db:
        existing = db.table("listings").select("id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        db.table("listings").delete().eq("id", id).execute()
        return {"deleted": id}

    if id not in listings:
        raise HTTPException(status_code=404, detail="Listing not found")
    del listings[id]
    return {"deleted": id}
