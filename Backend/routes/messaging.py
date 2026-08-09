from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import require_user
from database import db, listings, threads, users
from models import OpenThreadRequest, SendMessageRequest

router = APIRouter()


def _check_caller(user_id: str, caller_id: str) -> None:
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own messages")


def _avatar_url(name: str, size: int = 80) -> str:
    return f"https://ui-avatars.com/api/?name={name.replace(' ', '+')}&size={size}&background=1a7a3c&color=fff"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _seller_name(seller_id: str) -> str:
    seller = users.get(seller_id)
    return seller.display_name if seller else "Unknown seller"


def _thread_dict(thread_id: int, user_id: str, listing_id: str, name: str) -> dict:
    return {
        "id": thread_id,
        "user_id": user_id,
        "listingId": listing_id,
        "name": name,
        "avatar": _avatar_url(name),
        "online": True,
        "unread": 0,
        "lastMsg": "",
        "lastTimestamp": _now(),
        "messages": [],
    }


def _next_id() -> int:
    ids = [int(t["id"]) for t in threads.values()] if threads else []
    return (max(ids) + 1) if ids else 1


@router.get("/users/{user_id}/threads")
def list_threads(user_id: str, caller_id: str = Depends(require_user)):
    _check_caller(user_id, caller_id)
    if db:
        rows = (
            db.table("threads")
            .select("*")
            .eq("user_id", user_id)
            .order("lastTimestamp", desc=True)
            .execute()
            .data
        )
        for row in rows:
            msgs = (
                db.table("messages")
                .select("*")
                .eq("thread_id", str(row["id"]))
                .order("timestamp")
                .execute()
                .data
            )
            row["messages"] = msgs
            row["id"] = int(row["id"])
        return rows

    out = [t for t in threads.values() if t["user_id"] == user_id]
    return sorted(out, key=lambda t: t["lastTimestamp"], reverse=True)


@router.post("/users/{user_id}/threads")
def open_thread(user_id: str, body: OpenThreadRequest, caller_id: str = Depends(require_user)):
    _check_caller(user_id, caller_id)
    if db:
        existing = (
            db.table("threads")
            .select("*")
            .eq("user_id", user_id)
            .eq("listingId", body.listing_id)
            .execute()
        )
        if existing.data:
            row = existing.data[0]
            msgs = (
                db.table("messages")
                .select("*")
                .eq("thread_id", str(row["id"]))
                .order("timestamp")
                .execute()
                .data
            )
            row["messages"] = msgs
            row["id"] = int(row["id"])
            return row
        res = db.table("listings").select("seller_id").eq("id", body.listing_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        seller_id = res.data[0]["seller_id"]
        sres = db.table("users").select("display_name").eq("id", seller_id).execute()
        name = sres.data[0]["display_name"] if sres.data else "Unknown seller"
        tid = str(int(datetime.now(timezone.utc).timestamp() * 1000))
        thread = {
            "id": tid,
            "user_id": user_id,
            "listingId": body.listing_id,
            "name": name,
            "avatar": _avatar_url(name),
            "online": True,
            "unread": 0,
            "lastMsg": "",
            "lastTimestamp": _now(),
        }
        db.table("threads").insert(thread).execute()
        thread["id"] = int(tid)
        thread["messages"] = []
        return thread

    for t in threads.values():
        if t["user_id"] == user_id and t["listingId"] == body.listing_id:
            return t

    listing = listings.get(body.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    seller_id = listing.seller_id if hasattr(listing, "seller_id") else listing.get("seller_id")
    thread = _thread_dict(_next_id(), user_id, body.listing_id, _seller_name(seller_id))
    threads[thread["id"]] = thread
    return thread


@router.post("/users/{user_id}/threads/{thread_id}/messages")
def send_thread_message(
    user_id: str,
    thread_id: int,
    body: SendMessageRequest,
    caller_id: str = Depends(require_user),
):
    _check_caller(user_id, caller_id)
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if db:
        existing = (
            db.table("threads").select("*").eq("id", str(thread_id)).eq("user_id", user_id).execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        msg = {
            "id": int(datetime.now().timestamp() * 1000),
            "text": body.text.strip(),
            "sent": True,
            "timestamp": _now(),
        }
        db.table("messages").insert({**msg, "thread_id": str(thread_id)}).execute()
        db.table("threads").update(
            {"lastMsg": msg["text"], "lastTimestamp": msg["timestamp"], "unread": 0}
        ).eq("id", str(thread_id)).execute()
        row = db.table("threads").select("*").eq("id", str(thread_id)).execute().data[0]
        msgs = (
            db.table("messages")
            .select("*")
            .eq("thread_id", str(thread_id))
            .order("timestamp")
            .execute()
            .data
        )
        row["messages"] = msgs
        row["id"] = int(row["id"])
        return row

    thread = threads.get(thread_id)
    if not thread or thread["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Thread not found")

    msg = {
        "id": int(datetime.now().timestamp() * 1000),
        "text": body.text.strip(),
        "sent": True,
        "timestamp": _now(),
    }
    thread["messages"].append(msg)
    thread["lastMsg"] = msg["text"]
    thread["lastTimestamp"] = msg["timestamp"]
    thread["unread"] = 0
    return thread


@router.patch("/users/{user_id}/threads/{thread_id}/read")
def mark_thread_read(user_id: str, thread_id: int, caller_id: str = Depends(require_user)):
    _check_caller(user_id, caller_id)
    if db:
        existing = (
            db.table("threads").select("*").eq("id", str(thread_id)).eq("user_id", user_id).execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        data = (
            db.table("threads").update({"unread": 0}).eq("id", str(thread_id)).execute()
        )
        row = data.data[0]
        msgs = (
            db.table("messages")
            .select("*")
            .eq("thread_id", str(thread_id))
            .order("timestamp")
            .execute()
            .data
        )
        row["messages"] = msgs
        row["id"] = int(row["id"])
        return row

    thread = threads.get(thread_id)
    if not thread or thread["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread["unread"] = 0
    return thread
