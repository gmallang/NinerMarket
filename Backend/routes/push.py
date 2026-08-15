import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import require_user
from database import db, push_subscriptions

router = APIRouter()


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


def _check_caller(user_id: str, caller_id: str) -> None:
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only manage your own subscriptions")


@router.get("/push/vapid-public-key")
def get_vapid_public_key():
    return {"key": os.getenv("VAPID_PUBLIC_KEY", "")}


@router.post("/users/{user_id}/push-subscriptions")
def subscribe(user_id: str, body: PushSubscribeRequest, caller_id: str = Depends(require_user)):
    _check_caller(user_id, caller_id)
    row = {
        "endpoint": body.endpoint,
        "user_id": user_id,
        "p256dh": body.keys.p256dh,
        "auth": body.keys.auth,
    }
    if db:
        db.table("push_subscriptions").upsert(row, on_conflict="endpoint").execute()
        return {"ok": True}

    existing = push_subscriptions.setdefault(user_id, [])
    existing[:] = [s for s in existing if s["endpoint"] != body.endpoint]
    existing.append(row)
    return {"ok": True}


@router.delete("/users/{user_id}/push-subscriptions")
def unsubscribe(user_id: str, body: PushUnsubscribeRequest, caller_id: str = Depends(require_user)):
    _check_caller(user_id, caller_id)
    if db:
        db.table("push_subscriptions").delete().eq("endpoint", body.endpoint).execute()
        return {"ok": True}

    existing = push_subscriptions.get(user_id, [])
    existing[:] = [s for s in existing if s["endpoint"] != body.endpoint]
    return {"ok": True}
