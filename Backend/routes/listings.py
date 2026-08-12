import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from auth import require_user
from broadcast import broadcast
from database import db, listings, reports, users
from models import Listing, ReportRequest
from moderation import find_prohibited_reasons
from ratelimit import client_ip, rate_limit
from routes.notifications import create_notification

router = APIRouter()

SELLER_COLUMNS = "id, display_name, school_year, payment_methods, rating_avg, rating_count"


def generate_id():
    return str(uuid.uuid4())


def _seller_dict(user):
    if not user:
        return None
    return {
        "id": user.id,
        "display_name": user.display_name,
        "school_year": getattr(user, "school_year", ""),
        "payment_methods": getattr(user, "payment_methods", []),
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
        rows = query.order("created_at", desc=True).execute().data

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
    results = sorted(results, key=lambda l: l.created_at, reverse=True)
    return [_with_seller(l) for l in results]


@router.post("/listings")
def create_listing(listing: Listing, user_id: str = Depends(require_user)):
    listing.id = listing.id or generate_id()
    listing.seller_id = user_id

    reasons = find_prohibited_reasons(listing.name, listing.description)
    if reasons:
        listing.status = "flagged"
        listing.flag_reason = ", ".join(reasons)

    if db:
        data = db.table("listings").insert(listing.model_dump(mode="json")).execute()
        result = _with_seller(data.data[0])
    else:
        listings[listing.id] = listing
        result = _with_seller(listing)

    if reasons:
        create_notification(
            listing.seller_id,
            f"Your listing \"{listing.name}\" was flagged for review ({listing.flag_reason})"
            " and isn't visible to others yet. Edit it to remove the prohibited item.",
            listing.id,
        )
    else:
        create_notification(
            listing.seller_id,
            f"Your listing \"{listing.name}\" is now live.",
            listing.id,
        )

    broadcast("listings", "listing_changed", {"id": listing.id})
    return result


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


REPORT_THRESHOLD = 3


@router.post("/listings/{id}/report")
def report_listing(
    id: str,
    body: ReportRequest,
    request: Request,
    user_id: str = Depends(require_user),
):
    """Records a report after a user reports a listing (duplicates from the
    same reporter are rejected). Only once REPORT_THRESHOLD distinct
    reporters have flagged it does the listing actually get hidden — a
    single report can't take a listing down on its own. The seller is
    notified when that threshold is crossed and can edit to resolve."""
    if db:
        existing = db.table("listings").select("*").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        listing = existing.data[0]
    else:
        if id not in listings:
            raise HTTPException(status_code=404, detail="Listing not found")
        listing = listings[id]

    seller_id = listing["seller_id"] if db else listing.seller_id
    name = listing["name"] if db else listing.name

    if seller_id == user_id:
        raise HTTPException(status_code=400, detail="You can't report your own listing")

    rate_limit(f"report:{user_id}:{client_ip(request)}", max_attempts=10, window_seconds=3600)

    if db:
        dup = (
            db.table("listing_reports")
            .select("id")
            .eq("listing_id", id)
            .eq("reporter_id", user_id)
            .execute()
        )
        if dup.data:
            raise HTTPException(status_code=409, detail="You've already reported this listing.")
    elif any(
        r["listing_id"] == id and r["reporter_id"] == user_id for r in reports.values()
    ):
        raise HTTPException(status_code=409, detail="You've already reported this listing.")

    report = {
        "id": generate_id(),
        "listing_id": id,
        "reporter_id": user_id,
        "reason": body.reason,
        "details": body.details,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if db:
        db.table("listing_reports").insert(report).execute()
        report_count = len(
            db.table("listing_reports").select("id").eq("listing_id", id).execute().data
        )
    else:
        reports[report["id"]] = report
        report_count = sum(1 for r in reports.values() if r["listing_id"] == id)

    current_status = listing["status"] if db else listing.status
    crosses_threshold = report_count >= REPORT_THRESHOLD and current_status != "flagged"

    if crosses_threshold:
        flag_label = f"User report: {body.reason}"
        if db:
            existing_reason = listing.get("flag_reason") or ""
            if flag_label not in existing_reason:
                listing["flag_reason"] = (
                    f"{existing_reason}, {flag_label}".lstrip(", ") if existing_reason else flag_label
                )
            listing["status"] = "flagged"
            db.table("listings").update(
                {"status": "flagged", "flag_reason": listing["flag_reason"]}
            ).eq("id", id).execute()
        else:
            listing.status = "flagged"
            if flag_label not in listing.flag_reason:
                listing.flag_reason = (
                    f"{listing.flag_reason}, {flag_label}" if listing.flag_reason else flag_label
                )

        create_notification(
            seller_id,
            f"Your listing \"{name}\" was reported and is hidden from other students until it's resolved.",
            id,
        )

        broadcast("listings", "listing_changed", {"id": id})

    return _with_seller(listing)


def _apply_moderation(updates: dict, current_name: str, current_desc: str, current_status: str) -> None:
    """Re-checks the (possibly updated) text and keeps status/flag_reason in
    sync: flags it if the new text matches, or clears a flag that was only
    ever due to this filter once the seller edits the offending text out."""
    name = updates.get("name", current_name)
    description = updates.get("description", current_desc)
    reasons = find_prohibited_reasons(name, description)
    if reasons:
        updates["status"] = "flagged"
        updates["flag_reason"] = ", ".join(reasons)
    elif current_status == "flagged":
        updates["status"] = "active"
        updates["flag_reason"] = ""


def _sync_sold_at(updates: dict, current_status: str) -> None:
    """Tracks when a listing became sold so the seller can unsell their most
    recent ones: sold_at is stamped the moment a listing flips to sold and
    cleared again when it's put back up for sale."""
    new_status = updates.get("status")
    if new_status == "sold" and current_status != "sold":
        updates["sold_at"] = datetime.now(timezone.utc).isoformat()
    elif current_status == "sold" and new_status and new_status != "sold":
        updates["sold_at"] = None


@router.patch("/listings/{id}")
def update_listing(id: str, updates: dict, user_id: str = Depends(require_user)):
    updates = {k: v for k, v in updates.items() if k != "seller_id"}

    if db:
        existing = db.table("listings").select("*").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        if existing.data[0]["seller_id"] != user_id:
            raise HTTPException(status_code=403, detail="You can only edit your own listings")
        _apply_moderation(
            updates,
            existing.data[0]["name"],
            existing.data[0]["description"],
            existing.data[0]["status"],
        )
        _sync_sold_at(updates, existing.data[0]["status"])
        data = db.table("listings").update(updates).eq("id", id).execute()
        broadcast("listings", "listing_changed", {"id": id})
        return _with_seller(data.data[0])

    if id not in listings:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listings[id].seller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own listings")
    _apply_moderation(updates, listings[id].name, listings[id].description, listings[id].status)
    _sync_sold_at(updates, listings[id].status)
    for key, value in updates.items():
        setattr(listings[id], key, value)
    broadcast("listings", "listing_changed", {"id": id})
    return _with_seller(listings[id])


@router.delete("/listings/{id}")
def delete_listing(id: str, user_id: str = Depends(require_user)):
    if db:
        existing = db.table("listings").select("seller_id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        if existing.data[0]["seller_id"] != user_id:
            raise HTTPException(status_code=403, detail="You can only delete your own listings")
        db.table("listings").delete().eq("id", id).execute()
        broadcast("listings", "listing_changed", {"id": id})
        return {"deleted": id}

    if id not in listings:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listings[id].seller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own listings")
    del listings[id]
    broadcast("listings", "listing_changed", {"id": id})
    return {"deleted": id}
