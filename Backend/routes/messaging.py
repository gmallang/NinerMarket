from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import require_user
from database import db, listings, threads, users
from models import OpenThreadRequest, SendMessageRequest
from broadcast import broadcast
from routes.notifications import create_notification

router = APIRouter()


def _check_caller(user_id: str, caller_id: str) -> None:
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own messages")


def _avatar_url(name: str, size: int = 80) -> str:
    return f"https://ui-avatars.com/api/?name={name.replace(' ', '+')}&size={size}&background=1a7a3c&color=fff"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _listing_seller_id(listing_id: str) -> str | None:
    if db:
        res = db.table("listings").select("seller_id").eq("id", listing_id).execute()
        return res.data[0]["seller_id"] if res.data else None
    listing = listings.get(listing_id)
    if not listing:
        return None
    return listing.seller_id if hasattr(listing, "seller_id") else listing.get("seller_id")


def _listing_name(listing_id: str) -> str:
    if db:
        res = db.table("listings").select("name").eq("id", listing_id).execute()
        return res.data[0]["name"] if res.data else "a listing"
    listing = listings.get(listing_id)
    if not listing:
        return "a listing"
    return listing.name if hasattr(listing, "name") else listing.get("name", "a listing")


def _display_name(user_id: str) -> str:
    if db:
        res = db.table("users").select("display_name").eq("id", user_id).execute()
        return res.data[0]["display_name"] if res.data else "Unknown user"
    u = users.get(user_id)
    return u.display_name if u else "Unknown user"


def _is_participant(thread_row: dict, user_id: str) -> bool:
    """A thread has two sides — whoever opened it (thread_row['user_id']) and
    the seller of the listing it's about. Both must be able to see and reply
    to it, even though the row itself is only ever stored once."""
    if thread_row.get("user_id") == user_id:
        return True
    return _listing_seller_id(thread_row.get("listingId", "")) == user_id


def _viewer_relative(row: dict, msgs: list[dict], viewer_id: str) -> dict:
    """Threads are stored from the opener's point of view: name/avatar show
    the seller, and each message's `sent` means "sent by the opener". When
    the seller views the same thread, flip both so they see the buyer's name
    and correctly see which messages are theirs — without a second stored
    copy of the thread."""
    row = dict(row)
    if row.get("user_id") != viewer_id:
        other_id = row.get("user_id", "")
        other_name = _display_name(other_id)
        row["name"] = other_name
        row["avatar"] = _avatar_url(other_name)
        row["other_user_id"] = other_id
        msgs = [{**m, "sent": not m.get("sent", True)} for m in msgs]
    else:
        row["other_user_id"] = _listing_seller_id(row.get("listingId", ""))
    row["messages"] = msgs
    return row


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
        my_listing_ids = [
            row["id"]
            for row in db.table("listings").select("id").eq("seller_id", user_id).execute().data
        ]
        or_filter = f"user_id.eq.{user_id}"
        if my_listing_ids:
            or_filter += f",listingId.in.({','.join(my_listing_ids)})"
        rows = (
            db.table("threads")
            .select("*")
            .or_(or_filter)
            .order("lastTimestamp", desc=True)
            .execute()
            .data
        )
        out = []
        for row in rows:
            msgs = (
                db.table("messages")
                .select("*")
                .eq("thread_id", str(row["id"]))
                .order("timestamp")
                .execute()
                .data
            )
            row["id"] = int(row["id"])
            out.append(_viewer_relative(row, msgs, user_id))
        return out

    out = [
        _viewer_relative(t, t.get("messages", []), user_id)
        for t in threads.values()
        if _is_participant(t, user_id)
    ]
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
            row["id"] = int(row["id"])
            return _viewer_relative(row, msgs, user_id)

        res = db.table("listings").select("seller_id").eq("id", body.listing_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        seller_id = res.data[0]["seller_id"]
        if seller_id == user_id:
            raise HTTPException(
                status_code=400, detail="You can't message yourself about your own listing"
            )
        name = _display_name(seller_id)
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
            return _viewer_relative(t, t.get("messages", []), user_id)

    listing = listings.get(body.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    seller_id = listing.seller_id if hasattr(listing, "seller_id") else listing.get("seller_id")
    if seller_id == user_id:
        raise HTTPException(
            status_code=400, detail="You can't message yourself about your own listing"
        )
    thread = _thread_dict(_next_id(), user_id, body.listing_id, _display_name(seller_id))
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
        existing = db.table("threads").select("*").eq("id", str(thread_id)).execute()
        if not existing.data or not _is_participant(existing.data[0], user_id):
            raise HTTPException(status_code=404, detail="Thread not found")
        thread_row = existing.data[0]
        sent_by_opener = thread_row["user_id"] == user_id
        msg = {
            "id": int(datetime.now().timestamp() * 1000),
            "text": body.text.strip(),
            "sent": sent_by_opener,
            "timestamp": _now(),
        }
        db.table("messages").insert({**msg, "thread_id": str(thread_id)}).execute()
        db.table("threads").update(
            {
                "lastMsg": msg["text"],
                "lastTimestamp": msg["timestamp"],
                "unread": thread_row.get("unread", 0) + 1,
            }
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
        row["id"] = int(row["id"])

        recipient_id = (
            _listing_seller_id(thread_row["listingId"]) if sent_by_opener else thread_row["user_id"]
        )
        if recipient_id:
            sender_name = _display_name(user_id)
            listing_name = _listing_name(thread_row["listingId"])
            create_notification(
                recipient_id,
                f"{sender_name} sent you a message about {listing_name}.",
                thread_row["listingId"],
            )
            broadcast(f"inbox:{recipient_id}", "new_message", {"thread_id": thread_id})
        return _viewer_relative(row, msgs, user_id)

    thread = threads.get(thread_id)
    if not thread or not _is_participant(thread, user_id):
        raise HTTPException(status_code=404, detail="Thread not found")

    sent_by_opener = thread["user_id"] == user_id
    msg = {
        "id": int(datetime.now().timestamp() * 1000),
        "text": body.text.strip(),
        "sent": sent_by_opener,
        "timestamp": _now(),
    }
    thread["messages"].append(msg)
    thread["lastMsg"] = msg["text"]
    thread["lastTimestamp"] = msg["timestamp"]
    thread["unread"] = thread.get("unread", 0) + 1

    recipient_id = (
        _listing_seller_id(thread["listingId"]) if sent_by_opener else thread["user_id"]
    )
    if recipient_id:
        sender_name = _display_name(user_id)
        listing_name = _listing_name(thread["listingId"])
        create_notification(
            recipient_id,
            f"{sender_name} sent you a message about {listing_name}.",
            thread["listingId"],
        )
        broadcast(f"inbox:{recipient_id}", "new_message", {"thread_id": thread_id})
    return _viewer_relative(thread, thread["messages"], user_id)


@router.patch("/users/{user_id}/threads/{thread_id}/read")
def mark_thread_read(user_id: str, thread_id: int, caller_id: str = Depends(require_user)):
    _check_caller(user_id, caller_id)
    if db:
        existing = db.table("threads").select("*").eq("id", str(thread_id)).execute()
        if not existing.data or not _is_participant(existing.data[0], user_id):
            raise HTTPException(status_code=404, detail="Thread not found")
        data = db.table("threads").update({"unread": 0}).eq("id", str(thread_id)).execute()
        row = data.data[0]
        msgs = (
            db.table("messages")
            .select("*")
            .eq("thread_id", str(thread_id))
            .order("timestamp")
            .execute()
            .data
        )
        row["id"] = int(row["id"])
        return _viewer_relative(row, msgs, user_id)

    thread = threads.get(thread_id)
    if not thread or not _is_participant(thread, user_id):
        raise HTTPException(status_code=404, detail="Thread not found")
    thread["unread"] = 0
    return _viewer_relative(thread, thread["messages"], user_id)
