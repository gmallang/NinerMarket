import os

from fastapi import APIRouter, HTTPException, Request

from database import db, listings
from models import CheckoutRequest, Listing
from routes.notifications import create_notification

router = APIRouter()


def _get_listing(listing_id: str):
    if db:
        res = db.table("listings").select("id, name, price, seller_id, status").eq("id", listing_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        return res.data[0]  # already a dict
    listing = listings.get(listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    # Pydantic model → plain dict so .get() works consistently
    return listing.model_dump() if hasattr(listing, "model_dump") else vars(listing)


def _mark_listing_sold(listing_id: str):
    if db:
        db.table("listings").update({"status": "sold"}).eq("id", listing_id).execute()
    else:
        if listing_id in listings:
            # Handle Pydantic model vs dict
            if hasattr(listings[listing_id], "status"):
                listings[listing_id].status = "sold"
            else:
                listings[listing_id]["status"] = "sold"


@router.post("/checkout")
def create_checkout(body: CheckoutRequest):
    listing = _get_listing(body.listing_id)
    if listing.get("status") != "active":
        raise HTTPException(status_code=400, detail="This listing is no longer available")

    secret_key = os.getenv("STRIPE_SECRET_KEY")
    if not secret_key:
        # No Stripe credentials configured — run in mock mode so the flow
        # works end-to-end without real charges.
        _mark_listing_sold(body.listing_id)
        create_notification(
            listing.get("seller_id", ""),
            f"Someone purchased your listing \"{listing.get('name', '')}\".",
            body.listing_id,
        )
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


@router.post("/checkout/webhook")
async def stripe_webhook(request: Request):
    secret_key = os.getenv("STRIPE_SECRET_KEY")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    
    if not secret_key or not webhook_secret:
        raise HTTPException(status_code=400, detail="Stripe not configured")

    import stripe
    stripe.api_key = secret_key

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        listing_id = session.get("metadata", {}).get("listing_id")
        if listing_id:
            _mark_listing_sold(listing_id)

    return {"status": "success"}
