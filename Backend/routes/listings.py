import uuid

from fastapi import APIRouter, HTTPException, Query

from database import db, listings, users
from models import Listing

router = APIRouter()

SELLER_COLUMNS = "id, display_name, rating_avg, rating_count"


def generate_id():
    return str(uuid.uuid4())


def _seller_dict(user):
    if not user:
        return None
    return {
        "id": user.id,
        "display_name": user.display_name,
        "rating_avg": user.rating_avg,
        "rating_count": user.rating_count,
    }


def _with_seller(entry):
    if isinstance(entry, Listing):
        data = entry.model_dump(mode="json")
    else:
        data = dict(entry)

    if db:
        res = db.table("users").select(SELLER_COLUMNS).eq("id", data.get("seller_id")).execute()
        data["seller"] = res.data[0] if res.data else None
    else:
        data["seller"] = _seller_dict(users.get(data.get("seller_id")))
    return data


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
        rows = query.execute().data

        seller_ids = {r.get("seller_id") for r in rows if r.get("seller_id")}
        sellers = {}
        if seller_ids:
            sres = db.table("users").select(SELLER_COLUMNS).in_("id", list(seller_ids)).execute()
            sellers = {s["id"]: s for s in sres.data}
        for r in rows:
            r["seller"] = sellers.get(r.get("seller_id"))
        return rows

    results = listings.values()
    if category:
        results = [l for l in results if l.category == category]
    if min_price is not None:
        results = [l for l in results if l.price >= min_price]
    if max_price is not None:
        results = [l for l in results if l.price <= max_price]
    if status:
        results = [l for l in results if l.status == status]
    return [_with_seller(l) for l in results]


@router.post("/listings")
def create_listing(listing: Listing):
    listing.id = listing.id or generate_id()
    if db:
        data = db.table("listings").insert(listing.model_dump(mode="json")).execute()
        return _with_seller(data.data[0])

    listings[listing.id] = listing
    return _with_seller(listing)


@router.get("/listings/{id}")
def get_listing(id: str):
    if db:
        data = db.table("listings").select("*").eq("id", id).execute()
        if not data.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        return _with_seller(data.data[0])

    if id not in listings:
        raise HTTPException(status_code=404, detail="Listing not found")
    return _with_seller(listings[id])


@router.patch("/listings/{id}")
def update_listing(id: str, updates: dict):
    if db:
        existing = db.table("listings").select("*").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        data = db.table("listings").update(updates).eq("id", id).execute()
        return _with_seller(data.data[0])

    if id not in listings:
        raise HTTPException(status_code=404, detail="Listing not found")
    for key, value in updates.items():
        setattr(listings[id], key, value)
    return _with_seller(listings[id])


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
