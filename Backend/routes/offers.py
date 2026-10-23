import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from auth import require_user
from broadcast import broadcast
from database import db, listings, offers, users
from models import OfferCreate
from ratelimit import client_ip, rate_limit
from routes.messaging import start_deal_thread
from routes.notifications import create_notification

router = APIRouter()

VALID_STATUSES = {"pending", "accepted", "declined", "cancelled"}


def generate_id():
    return str(uuid.uuid4())


def _get_listing(listing_id: str) -> dict:
    """Returns the listing as a dict (a raw row from Supabase or a pydantic
    model from the in-memory store) — the `db` flag distinguishes them."""
    if db:
        data = db.table("listings").select("*").eq("id", listing_id).execute()
        if not data.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        return data.data[0]
    if listing_id not in listings:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listings[listing_id]


def _get_offer(offer_id: str) -> dict:
    if db:
        data = db.table("offers").select("*").eq("id", offer_id).execute()
        if not data.data:
            raise HTTPException(status_code=404, detail="Offer not found")
        return data.data[0]
    if offer_id not in offers:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offers[offer_id]


def _listing_attr(row: dict, key: str):
    return row.get(key) if db else getattr(row, key, None)


def _user_name(user_id: str) -> str:
    if db:
        data = db.table("users").select("display_name").eq("id", user_id).execute()
        return data.data[0]["display_name"] if data.data else "Former member"
    user = users.get(user_id)
    return user.display_name if user else "Former member"


def _offer_out(offer: dict, user_id: str) -> dict:
    listing = _get_listing(offer["listing_id"])
    return {
        "id": offer["id"],
        "listing_id": offer["listing_id"],
        "listing_name": _listing_attr(listing, "name"),
        "listing_price": _listing_attr(listing, "price"),
        "listing_status": _listing_attr(listing, "status"),
        "buyer_id": offer["buyer_id"],
        "buyer_name": _user_name(offer["buyer_id"]),
        "price": offer["price"],
        "status": offer["status"],
        "created_at": offer["created_at"],
        "direction": "received" if _listing_attr(listing, "seller_id") == user_id else "sent",
    }


def _update_offer(offer_id: str, updates: dict) -> dict:
    if db:
        data = db.table("offers").update(updates).eq("id", offer_id).execute()
        return data.data[0]
    offers[offer_id].update(updates)
    return offers[offer_id]


@router.post("/listings/{listing_id}/offers")
def create_offer(
    listing_id: str,
    body: OfferCreate,
    request: Request,
    user_id: str = Depends(require_user),
):
    """Lets a buyer name their price on an active listing. One pending offer
    per buyer+listing; the seller is notified and can accept or decline."""
    listing = _get_listing(listing_id)
    seller_id = _listing_attr(listing, "seller_id")
    if seller_id == user_id:
        raise HTTPException(status_code=400, detail="You can't make an offer on your own listing")
    if _listing_attr(listing, "status") != "active":
        raise HTTPException(status_code=400, detail="This listing is no longer available")
    if body.price > _listing_attr(listing, "price"):
        raise HTTPException(status_code=400, detail="Offers can't exceed the listed price")

    rate_limit(f"offer:{user_id}:{client_ip(request)}", max_attempts=20, window_seconds=3600)

    if db:
        dup = (
            db.table("offers")
            .select("id")
            .eq("listing_id", listing_id)
            .eq("buyer_id", user_id)
            .eq("status", "pending")
            .execute()
        )
        if dup.data:
            raise HTTPException(
                status_code=409, detail="You already have a pending offer on this listing"
            )
    elif any(
        o["listing_id"] == listing_id
        and o["buyer_id"] == user_id
        and o["status"] == "pending"
        for o in offers.values()
    ):
        raise HTTPException(
            status_code=409, detail="You already have a pending offer on this listing"
        )

    now = datetime.now(timezone.utc).isoformat()
    offer = {
        "id": generate_id(),
        "listing_id": listing_id,
        "buyer_id": user_id,
        "price": body.price,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }
    if db:
        db.table("offers").insert(offer).execute()
    else:
        offers[offer["id"]] = offer

    buyer_name = _user_name(user_id)
    create_notification(
        seller_id,
        f"{buyer_name} offered ${body.price:,.2f} on your listing "
        f'"{_listing_attr(listing, "name")}".',
        listing_id,
        related_user_id=user_id,
        related_user_name=buyer_name,
    )

    return _offer_out(offer, user_id)


@router.get("/users/{user_id}/offers")
def list_offers(user_id: str, caller_id: str = Depends(require_user)):
    """Returns every offer where the caller is the buyer or the seller of the
    underlying listing, newest first."""
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only view your own offers")

    if db:
        # First, find all listing IDs the user is selling so we can filter
        # offers server-side instead of pulling the entire offers table.
        seller_listing_ids = [
            row["id"]
            for row in db.table("listings").select("id").eq("seller_id", user_id).execute().data
        ]

        # Build a server-side OR filter: offers where user is the buyer OR
        # offers on listings where user is the seller.
        or_parts = [f"buyer_id.eq.{user_id}"]
        if seller_listing_ids:
            ids_csv = ",".join(seller_listing_ids)
            or_parts.append(f"listing_id.in.({ids_csv})")

        rows = (
            db.table("offers")
            .select("*")
            .or_(",".join(or_parts))
            .order("created_at", desc=True)
            .execute()
            .data
        )

        if not rows:
            return []

        # Batch-fetch listings and users to avoid N+1 queries.
        listing_ids = list({r["listing_id"] for r in rows})
        listing_rows: dict[str, dict] = {}
        if listing_ids:
            res = (
                db.table("listings")
                .select("id, name, price, status, seller_id")
                .in_("id", listing_ids)
                .execute()
            )
            listing_rows = {l["id"]: l for l in res.data}
        buyer_ids = list({r["buyer_id"] for r in rows})
        names: dict[str, str] = {}
        if buyer_ids:
            res = (
                db.table("users")
                .select("id, display_name")
                .in_("id", buyer_ids)
                .execute()
            )
            names = {u["id"]: u["display_name"] for u in res.data}

        out = []
        for row in rows:
            listing = listing_rows.get(row["listing_id"])
            if not listing:
                continue
            out.append(
                {
                    "id": row["id"],
                    "listing_id": row["listing_id"],
                    "listing_name": listing.get("name", ""),
                    "listing_price": listing.get("price", 0),
                    "listing_status": listing.get("status", ""),
                    "buyer_id": row["buyer_id"],
                    "buyer_name": names.get(row["buyer_id"], "Former member"),
                    "price": row["price"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                    "direction": (
                        "received" if listing.get("seller_id") == user_id else "sent"
                    ),
                }
            )
        return out

    rows = sorted(offers.values(), key=lambda o: o["created_at"], reverse=True)
    out = []
    for row in rows:
        listing = listings.get(row["listing_id"])
        if not listing:
            continue
        if row["buyer_id"] == user_id or listing.seller_id == user_id:
            out.append(_offer_out(row, user_id))
    return out


@router.post("/offers/{offer_id}/accept")
def accept_offer(offer_id: str, user_id: str = Depends(require_user)):
    """The seller accepts a pending offer: the offer becomes accepted and the
    listing is marked sold so it drops out of browse."""
    offer = _get_offer(offer_id)
    listing = _get_listing(offer["listing_id"])
    if _listing_attr(listing, "seller_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the seller can accept this offer")
    if offer["status"] != "pending":
        raise HTTPException(status_code=400, detail="This offer is no longer pending")
    if _listing_attr(listing, "status") != "active":
        raise HTTPException(status_code=400, detail="This listing is no longer available")

    now = datetime.now(timezone.utc).isoformat()
    _update_offer(offer_id, {"status": "accepted", "updated_at": now})

    if db:
        db.table("listings").update({"status": "sold", "sold_at": now}).eq(
            "id", offer["listing_id"]
        ).execute()
    else:
        listing.status = "sold"
        listing.sold_at = datetime.now(timezone.utc)

    broadcast("listings", "listing_changed", {"id": offer["listing_id"]})

    seller_name = _user_name(user_id)
    # Open the buyer<->seller conversation right away so the two can arrange
    # the handoff, seeded with a message from the seller. Reuses an existing
    # thread if they were already chatting about this listing.
    start_deal_thread(
        offer["listing_id"],
        offer["buyer_id"],
        user_id,
        f'Accepted your offer of ${offer["price"]:,.2f} for '
        f'"{_listing_attr(listing, "name")}" — let\'s arrange pickup.',
    )
    create_notification(
        offer["buyer_id"],
        f'Your offer of ${offer["price"]:,.2f} for '
        f'"{_listing_attr(listing, "name")}" was accepted.',
        offer["listing_id"],
        related_user_id=user_id,
        related_user_name=seller_name,
    )

    return _offer_out(_get_offer(offer_id), user_id)


@router.post("/offers/{offer_id}/decline")
def decline_offer(offer_id: str, user_id: str = Depends(require_user)):
    offer = _get_offer(offer_id)
    listing = _get_listing(offer["listing_id"])
    if _listing_attr(listing, "seller_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the seller can decline this offer")
    if offer["status"] != "pending":
        raise HTTPException(status_code=400, detail="This offer is no longer pending")

    _update_offer(
        offer_id, {"status": "declined", "updated_at": datetime.now(timezone.utc).isoformat()}
    )

    seller_name = _user_name(user_id)
    create_notification(
        offer["buyer_id"],
        f'Your offer of ${offer["price"]:,.2f} for '
        f'"{_listing_attr(listing, "name")}" was declined.',
        offer["listing_id"],
        related_user_id=user_id,
        related_user_name=seller_name,
    )

    return _offer_out(_get_offer(offer_id), user_id)


@router.delete("/offers/{offer_id}")
def cancel_offer(offer_id: str, user_id: str = Depends(require_user)):
    """The buyer withdraws their own pending offer."""
    offer = _get_offer(offer_id)
    if offer["buyer_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only cancel your own offers")
    if offer["status"] != "pending":
        raise HTTPException(status_code=400, detail="This offer is no longer pending")

    _update_offer(
        offer_id, {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}
    )

    return _offer_out(_get_offer(offer_id), user_id)
