import os

from fastapi import APIRouter, HTTPException

from database import db, listings
from models import CheckoutRequest, Listing

router = APIRouter()


def _get_listing(listing_id: str):
    if db:
        res = db.table("listings").select("id, name, price, seller_id, status").eq("id", listing_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        return res.data[0]
    listing = listings.get(listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


@router.post("/checkout")
def create_checkout(body: CheckoutRequest):
    listing = _get_listing(body.listing_id)
    if listing.get("status") != "active":
        raise HTTPException(status_code=400, detail="This listing is no longer available")

    secret_key = os.getenv("STRIPE_SECRET_KEY")
    if not secret_key:
        # No Stripe credentials configured — run in mock mode so the flow
        # works end-to-end without real charges.
        return {"url": None, "mock": True, "listing_id": body.listing_id}

    try:
        import stripe
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Stripe SDK is not installed. Add 'stripe' to requirements.txt or set STRIPE_SECRET_KEY.",
        ) from exc

    stripe.api_key = secret_key

    price_cents = int(round(listing.get("price", 0) * 100))
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": price_cents,
                        "product_data": {"name": listing.get("name", "NinerMarket item")},
                    },
                }
            ],
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            metadata={"listing_id": body.listing_id},
        )
    except Exception as exc:  # pragma: no cover - depends on Stripe API
        raise HTTPException(status_code=500, detail=f"Could not create Stripe session: {exc}") from exc

    return {"url": session.url, "mock": False, "listing_id": body.listing_id}
