import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import notification_email, require_user
from broadcast import broadcast
from database import db, notifications, users
from models import NotificationCreate
from push import send_push

router = APIRouter()


def _check_caller(user_id: str, caller_id: str) -> None:
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own notifications")


def user_email(user_id: str) -> str:
    """Looks up a user's email address, for the email fallback on notifications
    and messages. Returns "" when the user can't be found."""
    if db:
        res = db.table("users").select("email").eq("id", user_id).execute()
        return res.data[0]["email"] if res.data else ""
    user = users.get(user_id)
    return getattr(user, "email", "") if user else ""


def _new_notification(
    user_id: str,
    text: str,
    listing_id: str = "",
    related_user_id: str = "",
    related_user_name: str = "",
) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "text": text,
        "listing_id": listing_id,
        "related_user_id": related_user_id,
        "related_user_name": related_user_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
    }


def create_notification(
    user_id: str,
    text: str,
    listing_id: str = "",
    related_user_id: str = "",
    related_user_name: str = "",
) -> dict:
    """Create a notification for a user. Used internally by listings/offers too.
    `related_user_id`/`related_user_name` name the other person involved (e.g.
    an offer's buyer) so the frontend can offer to message them directly from
    the notification."""
    notification = _new_notification(
        user_id, text, listing_id, related_user_id, related_user_name
    )
    if db:
        db.table("notifications").insert(notification).execute()
    else:
        notifications.setdefault(user_id, []).append(notification)

    # Best-effort live signal so an open tab bumps its bell badge instantly
    # instead of only picking this up on next dropdown-open/sign-in poll.
    broadcast(f"inbox:{user_id}", "new_notification", notification)
    # Also reaches devices with no tab open at all, if they've granted
    # notification permission.
    send_push(user_id, "NinerMarket", text, f"/listing/{listing_id}" if listing_id else "/")
    # Email fallback: works even when the user never enabled web push, which
    # is the common case. Best-effort — a missing RESEND_API_KEY just no-ops.
    to = user_email(user_id)
    if to:
        notification_email(
            to,
            "New activity on NinerMarket",
            text,
            f"/listing/{listing_id}" if listing_id else "/",
        )
    return notification


@router.get("/users/{user_id}/notifications")
def list_notifications(user_id: str, caller_id: str = Depends(require_user)):
    _check_caller(user_id, caller_id)
    if db:
        rows = (
            db.table("notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
            .data
        )
        return rows

    rows = notifications.get(user_id, [])
    return sorted(rows, key=lambda n: n["created_at"], reverse=True)


@router.post("/users/{user_id}/notifications")
def post_notification(
    user_id: str, body: NotificationCreate, caller_id: str = Depends(require_user)
):
    _check_caller(user_id, caller_id)
    return create_notification(user_id, body.text, body.listing_id)


@router.delete("/users/{user_id}/notifications")
def clear_notifications(user_id: str, caller_id: str = Depends(require_user)):
    _check_caller(user_id, caller_id)
    if db:
        db.table("notifications").delete().eq("user_id", user_id).execute()
        return {"ok": True}

    notifications.pop(user_id, None)
    return {"ok": True}


@router.patch("/users/{user_id}/notifications/{notification_id}")
def mark_notification_read(
    user_id: str, notification_id: str, caller_id: str = Depends(require_user)
):
    _check_caller(user_id, caller_id)
    if db:
        existing = (
            db.table("notifications")
            .select("id")
            .eq("user_id", user_id)
            .eq("id", notification_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Notification not found")
        data = (
            db.table("notifications")
            .update({"read": True})
            .eq("user_id", user_id)
            .eq("id", notification_id)
            .execute()
        )
        return data.data[0]

    rows = notifications.get(user_id, [])
    for n in rows:
        if n["id"] == notification_id:
            n["read"] = True
            return n
    raise HTTPException(status_code=404, detail="Notification not found")


@router.patch("/users/{user_id}/notifications")
def mark_all_notifications_read(user_id: str, caller_id: str = Depends(require_user)):
    """Marks every unread notification for this user as read in a single
    DB call, replacing N individual PATCH requests from the frontend."""
    _check_caller(user_id, caller_id)
    if db:
        db.table("notifications").update({"read": True}).eq("user_id", user_id).eq(
            "read", False
        ).execute()
        return {"ok": True}

    for n in notifications.get(user_id, []):
        n["read"] = True
    return {"ok": True}

