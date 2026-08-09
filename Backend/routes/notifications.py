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


def _new_notification(user_id: str, text: str, listing_id: str = "") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "text": text,
        "listing_id": listing_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
    }


def create_notification(user_id: str, text: str, listing_id: str = "") -> dict:
    """Create a notification for a user. Used internally by listings/checkout too."""
    notification = _new_notification(user_id, text, listing_id)
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
