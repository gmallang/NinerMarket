import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import require_user
from database import db, notifications
from models import NotificationCreate

router = APIRouter()


def _check_caller(user_id: str, caller_id: str) -> None:
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own notifications")


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
        return notification

    notifications.setdefault(user_id, []).append(notification)
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

