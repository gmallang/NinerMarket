"""Seller trust: review-only posting after repeated bad listings.

Every flag (prohibited text, user reports) and every moderator takedown counts
as one bad listing. Three in a row puts the account into review-only posting:
new listings are created as `pending` and stay invisible to other students
until an admin approves them. A listing that passes review breaks the run.
"""

from database import db, users
from routes.notifications import create_notification

BAD_LISTING_STREAK_LIMIT = 3
AUTO_FLAG_REASON = "Three listings in a row needed moderator action"


def _get(user_id: str) -> dict | None:
    if db:
        res = (
            db.table("users")
            .select("id, posting_flagged, bad_listing_streak, flag_reason")
            .eq("id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    user = users.get(user_id)
    if not user:
        return None
    return {
        "id": user.id,
        "posting_flagged": bool(user.posting_flagged),
        "bad_listing_streak": int(user.bad_listing_streak or 0),
        "flag_reason": user.flag_reason or "",
    }


def _save(user_id: str, fields: dict) -> None:
    if db:
        db.table("users").update(fields).eq("id", user_id).execute()
        return

    user = users.get(user_id)
    if not user:
        return
    for key, value in fields.items():
        setattr(user, key, value)


def is_posting_flagged(user_id: str) -> bool:
    """Whether this account's new listings need admin approval."""
    row = _get(user_id)
    return bool(row and row.get("posting_flagged"))


def record_bad_listing(user_id: str, reason: str = "") -> bool:
    """Counts one flagged or removed listing. Returns True when this strike
    pushed the seller into review-only posting."""
    row = _get(user_id)
    if not row:
        return False

    streak = int(row.get("bad_listing_streak") or 0) + 1
    fields: dict = {"bad_listing_streak": streak}
    newly_flagged = streak >= BAD_LISTING_STREAK_LIMIT and not row.get("posting_flagged")
    if newly_flagged:
        fields["posting_flagged"] = True
        fields["flag_reason"] = AUTO_FLAG_REASON

    _save(user_id, fields)

    if newly_flagged:
        create_notification(
            user_id,
            f"Your account is under review: {AUTO_FLAG_REASON.lower()}. New listings"
            " will wait for admin approval before other students can see them.",
        )
    return newly_flagged


def record_good_listing(user_id: str) -> None:
    """A listing that passed review breaks the run of bad ones."""
    row = _get(user_id)
    if not row or not row.get("bad_listing_streak"):
        return
    _save(user_id, {"bad_listing_streak": 0})
