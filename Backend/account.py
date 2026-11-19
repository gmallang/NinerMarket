"""Closing an account, shared by the admin panel and a user deleting their own.

Closing is a soft delete on purpose: the row and its child rows stay so a
moderator can restore an account closed by mistake, and so the audit log still
points at a real user. Sign-in and every existing session token stop working
the moment `deleted_at` is set, because `get_user_by_id` treats a closed row as
gone.
"""

from datetime import datetime, timezone

from fastapi import HTTPException

from broadcast import broadcast
from database import db, listings, offers, users, wanted_requests


def close_account(user_id: str) -> dict:
    """Closes an account and hides everything it has on the marketplace.

    Returns the counts both the admin panel and the account-deletion screen
    show, plus the display name the audit log records. Raises 404 for an
    unknown account and 400 for one that is already closed.
    """
    now = datetime.now(timezone.utc)
    timestamp = now.isoformat()

    if db:
        existing = (
            db.table("users")
            .select("id, display_name, email, deleted_at")
            .eq("id", user_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="User not found")
        user = existing.data[0]
        if user.get("deleted_at"):
            raise HTTPException(status_code=400, detail="This account is already closed")

        db.table("users").update({"deleted_at": timestamp}).eq("id", user_id).execute()
        hidden_listings = len(
            db.table("listings")
            .select("id")
            .eq("seller_id", user_id)
            .is_("deleted_at", "null")
            .execute()
            .data
        )
        db.table("listings").update({"deleted_at": timestamp}).eq(
            "seller_id", user_id
        ).is_("deleted_at", "null").execute()
        hidden_requests = len(
            db.table("wanted_requests")
            .select("id")
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .execute()
            .data
        )
        db.table("wanted_requests").update({"deleted_at": timestamp}).eq(
            "user_id", user_id
        ).is_("deleted_at", "null").execute()
        # Pending offers from a closed buyer would otherwise block a seller
        # from accepting anyone else.
        db.table("offers").update({"status": "cancelled"}).eq(
            "buyer_id", user_id
        ).eq("status", "pending").execute()
        # A closed account has no device to notify, and keeping the rows would
        # leave a stale FCM token or web-push endpoint pointed at someone who
        # signed out for good.
        db.table("push_tokens").delete().eq("user_id", user_id).execute()
        db.table("push_subscriptions").delete().eq("user_id", user_id).execute()
        display_name = user.get("display_name", "")
    else:
        user = users.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if getattr(user, "deleted_at", None):
            raise HTTPException(status_code=400, detail="This account is already closed")

        user.deleted_at = now
        hidden_listings = 0
        for listing in listings.values():
            if listing.seller_id == user_id and getattr(listing, "deleted_at", None) is None:
                listing.deleted_at = now
                hidden_listings += 1
        hidden_requests = 0
        for row in wanted_requests.values():
            if row.get("user_id") == user_id and not row.get("deleted_at"):
                row["deleted_at"] = timestamp
                hidden_requests += 1
        for offer in offers.values():
            if offer.get("buyer_id") == user_id and offer.get("status") == "pending":
                offer["status"] = "cancelled"
        # The in-memory push rows are dev-only and are rebuilt on the next
        # sign-in, so only the database rows are worth deleting.
        display_name = user.display_name

    broadcast("listings", "listing_changed", {})
    broadcast("requests", "request_changed", {})
    return {
        "deleted": user_id,
        "deleted_at": timestamp,
        "display_name": display_name,
        "listings_hidden": hidden_listings,
        "requests_hidden": hidden_requests,
    }
