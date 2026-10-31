from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import notification_email, require_user
from database import db, listings, threads, users
from models import MarkReadRequest, OpenThreadRequest, SendMessageRequest
from broadcast import broadcast
from push import send_push
from routes.notifications import user_email

router = APIRouter()


def _check_caller(user_id: str, caller_id: str) -> None:
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own messages")


def _avatar_url(name: str, size: int = 80) -> str:
    return f"https://ui-avatars.com/api/?name={name.replace(' ', '+')}&size={size}&background=1a7a3c&color=fff"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


REQUEST_THREAD_PREFIX = "request:"


def _counterpart_id(context_id: str) -> str | None:
    """The other side of a thread. Normally that's the seller of the listing
    the thread is about; for a "Looking For" conversation the thread is keyed
    `request:<id>` and the other side is whoever posted the request."""
    if context_id.startswith(REQUEST_THREAD_PREFIX):
        request_id = context_id[len(REQUEST_THREAD_PREFIX) :]
        if db:
            res = db.table("wanted_requests").select("user_id").eq("id", request_id).execute()
            return res.data[0]["user_id"] if res.data else None
        from database import wanted_requests

        row = wanted_requests.get(request_id)
        return row.get("user_id") if row else None
    if db:
        res = db.table("listings").select("seller_id").eq("id", context_id).execute()
        return res.data[0]["seller_id"] if res.data else None
    listing = listings.get(context_id)
    if not listing:
        return None
    return listing.seller_id if hasattr(listing, "seller_id") else listing.get("seller_id")


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
    return _counterpart_id(thread_row.get("listingId", "")) == user_id


# ── Per-participant read cursors ────────────────────────────────────────────
# Unread is derived, not stored: each member's last_read_msg_id is the highest
# message id they've seen, and unread = count of messages above that cursor.
# Cursors only move forward (monotonic), so a stale device or a message sent
# from the chat you're viewing can't resurface a badge.

def _latest_msg_id(thread_id: int) -> int:
    if db:
        res = (
            db.table("messages")
            .select("id")
            .eq("thread_id", str(thread_id))
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        return res.data[0]["id"] if res.data else 0
    thread = threads.get(thread_id)
    msgs = thread.get("messages", []) if thread else []
    return max((m["id"] for m in msgs), default=0)


def _member_cursor(thread_id: int, user_id: str) -> int:
    if db:
        res = (
            db.table("thread_members")
            .select("last_read_msg_id")
            .eq("thread_id", str(thread_id))
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0]["last_read_msg_id"] if res.data else 0
    thread = threads.get(thread_id)
    return (thread.get("reads") or {}).get(user_id, 0) if thread else 0


def _advance_cursor(thread_id: int, user_id: str, up_to: int) -> None:
    """Moves a member's read cursor forward to up_to, never backwards.
    Skips the pre-read of the current cursor — upsert with MAX would be ideal,
    but Supabase PostgREST doesn't support expressions in upsert values.
    Instead we read once and only write when the new value is actually higher,
    which is already safe: the cursor is monotonic by construction (we never
    call this with a lower value than the current one in normal operation)."""
    if db:
        res = (
            db.table("thread_members")
            .select("last_read_msg_id")
            .eq("thread_id", str(thread_id))
            .eq("user_id", user_id)
            .execute()
        )
        current = res.data[0]["last_read_msg_id"] if res.data else 0
        next_cursor = max(current, up_to)
        db.table("thread_members").upsert(
            {"thread_id": str(thread_id), "user_id": user_id, "last_read_msg_id": next_cursor},
            on_conflict="thread_id,user_id",
        ).execute()
        return
    thread = threads.get(thread_id)
    if thread:
        current = (thread.get("reads") or {}).get(user_id, 0)
        thread.setdefault("reads", {})[user_id] = max(current, up_to)


def _unread_for(thread_id: int, user_id: str) -> int:
    cursor = _member_cursor(thread_id, user_id)
    if db:
        res = (
            db.table("messages")
            .select("id")
            .eq("thread_id", str(thread_id))
            .gt("id", cursor)
            .execute()
        )
        return len(res.data)
    thread = threads.get(thread_id)
    return sum(1 for m in thread.get("messages", []) if m["id"] > cursor) if thread else 0


def _notify_new_message(recipient_id: str, sender_id: str, text: str, thread_id: int) -> None:
    """Tells the other participant a message arrived: live inbox signal for open
    tabs, web push for subscribed devices, and an email fallback. The email is
    only sent when this is the recipient's first unread message in the thread
    (unread went 0 -> 1), so an active back-and-forth doesn't email on every
    line — the next message after they read emails again."""
    if not recipient_id:
        return
    broadcast(f"inbox:{recipient_id}", "new_message", {"thread_id": thread_id})
    sender_name = _display_name(sender_id)
    send_push(recipient_id, sender_name, text, "/")
    if _unread_for(thread_id, recipient_id) == 1:
        to = user_email(recipient_id)
        if to:
            notification_email(to, f"New message from {sender_name}", text, "/")


def _viewer_relative(row: dict, msgs: list[dict], viewer_id: str) -> dict:
    """Threads are stored from the opener's point of view: name/avatar show
    the seller, and each message's `sent` means "sent by the opener". When
    the seller views the same thread, flip both so they see the buyer's name
    and correctly see which messages are theirs — without a second stored
    copy of the thread. Unread is derived per viewer from their cursor, and
    `other_read_cursor` tells each side which of their messages the other
    person has read (a message is read when its id is at or below that)."""
    row = dict(row)
    if row.get("user_id") != viewer_id:
        other_id = row.get("user_id", "")
        other_name = _display_name(other_id)
        row["name"] = other_name
        row["avatar"] = _avatar_url(other_name)
        row["other_user_id"] = other_id
        msgs = [{**m, "sent": not m.get("sent", True)} for m in msgs]
    else:
        other_id = _counterpart_id(row.get("listingId", ""))
        row["other_user_id"] = other_id
    row["messages"] = msgs
    row["unread"] = _unread_for(int(row["id"]), viewer_id)
    row["other_read_cursor"] = _member_cursor(int(row["id"]), other_id or "")
    return row


def _viewer_relative_batched(
    row: dict,
    msgs: list[dict],
    viewer_id: str,
    seller_by_listing: dict[str, str],
    name_by_user: dict[str, str],
    cursor_by_thread_user: dict[tuple[str, str], int],
) -> dict:
    """Same output shape as _viewer_relative, but resolves the other-side
    lookup and both read cursors from maps built once for the whole inbox
    instead of issuing ~4 queries per thread (the actual cause of the inbox
    getting slower as a user accumulates conversations)."""
    row = dict(row)
    thread_id = str(row["id"])
    if row.get("user_id") != viewer_id:
        other_id = row.get("user_id", "")
        other_name = name_by_user.get(other_id, "Unknown user")
        row["name"] = other_name
        row["avatar"] = _avatar_url(other_name)
        row["other_user_id"] = other_id
        msgs = [{**m, "sent": not m.get("sent", True)} for m in msgs]
    else:
        other_id = seller_by_listing.get(row.get("listingId", ""))
        row["other_user_id"] = other_id

    viewer_cursor = cursor_by_thread_user.get((thread_id, viewer_id), 0)
    row["messages"] = msgs
    row["unread"] = sum(1 for m in msgs if m["id"] > viewer_cursor)
    row["other_read_cursor"] = cursor_by_thread_user.get((thread_id, other_id or ""), 0)
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


def start_deal_thread(
    listing_id: str, buyer_id: str, seller_id: str, seed_text: str
) -> int | None:
    """Opens (or reuses) the buyer<->seller conversation for a listing and posts
    a first message from the seller — used when a seller accepts an offer, so
    the two can arrange the handoff immediately instead of having to open a
    chat by hand. The buyer-facing notification for the acceptance is sent
    separately by the caller, so this only emits the live inbox signal (no
    duplicate push/email). Returns the thread id, or None if unresolvable."""
    if db:
        existing = (
            db.table("threads")
            .select("id")
            .eq("user_id", buyer_id)
            .eq("listingId", listing_id)
            .execute()
        )
        if existing.data:
            thread_id = int(existing.data[0]["id"])
        else:
            name = _display_name(seller_id)
            tid = str(int(datetime.now(timezone.utc).timestamp() * 1000))
            db.table("threads").insert(
                {
                    "id": tid,
                    "user_id": buyer_id,
                    "listingId": listing_id,
                    "name": name,
                    "avatar": _avatar_url(name),
                    "online": True,
                    "unread": 0,
                    "lastMsg": "",
                    "lastTimestamp": _now(),
                }
            ).execute()
            thread_id = int(tid)

        msg_id = int(datetime.now().timestamp() * 1000)
        # sent=False: messages are stored from the opener's point of view and the
        # opener is the buyer, so a seller-authored message is "not sent by opener".
        db.table("messages").insert(
            {
                "id": msg_id,
                "thread_id": str(thread_id),
                "text": seed_text,
                "sent": False,
                "timestamp": _now(),
            }
        ).execute()
        db.table("threads").update(
            {"lastMsg": seed_text, "lastTimestamp": _now()}
        ).eq("id", str(thread_id)).execute()
        # The seller authored it, so advance their cursor past it.
        _advance_cursor(thread_id, seller_id, msg_id)
        broadcast(f"inbox:{buyer_id}", "new_message", {"thread_id": thread_id})
        return thread_id

    thread = next(
        (
            t
            for t in threads.values()
            if t.get("user_id") == buyer_id and t.get("listingId") == listing_id
        ),
        None,
    )
    if thread is None:
        thread = _thread_dict(_next_id(), buyer_id, listing_id, _display_name(seller_id))
        threads[thread["id"]] = thread
    thread_id = thread["id"]
    msg = {
        "id": int(datetime.now().timestamp() * 1000),
        "text": seed_text,
        "sent": False,
        "timestamp": _now(),
    }
    thread.setdefault("messages", []).append(msg)
    thread["lastMsg"] = seed_text
    thread["lastTimestamp"] = msg["timestamp"]
    _advance_cursor(thread_id, seller_id, msg["id"])
    broadcast(f"inbox:{buyer_id}", "new_message", {"thread_id": thread_id})
    return thread_id


@router.get("/users/{user_id}/threads")
def list_threads(user_id: str, caller_id: str = Depends(require_user)):
    _check_caller(user_id, caller_id)
    if db:
        my_listing_ids = [
            row["id"]
            for row in db.table("listings").select("id").eq("seller_id", user_id).execute().data
        ]
        # Threads about a "Looking For" request are keyed `request:<id>`, and
        # the requester is a participant even though they own no listing.
        my_request_ids = [
            f"request:{row['id']}"
            for row in db.table("wanted_requests").select("id").eq("user_id", user_id).execute().data
        ]
        or_filter = f"user_id.eq.{user_id}"
        if my_listing_ids:
            or_filter += f",listingId.in.({','.join(my_listing_ids)})"
        if my_request_ids:
            quoted = ",".join(f'"{key}"' for key in my_request_ids)
            or_filter += f",listingId.in.({quoted})"
        rows = (
            db.table("threads")
            .select("*")
            .or_(or_filter)
            .order("lastTimestamp", desc=True)
            .execute()
            .data
        )

        if not rows:
            return []

        # Batch-fetch all messages for all threads in a single query instead
        # of one query per thread (eliminates the N+1 pattern).
        thread_ids = [str(row["id"]) for row in rows]
        all_msgs = (
            db.table("messages")
            .select("*")
            .in_("thread_id", thread_ids)
            .order("timestamp")
            .execute()
            .data
        )
        # Group messages by thread_id for O(1) lookup below.
        msgs_by_thread: dict[str, list[dict]] = {}
        for msg in all_msgs:
            msgs_by_thread.setdefault(msg["thread_id"], []).append(msg)

        # Batch-resolve every "other side" lookup and read cursor once for
        # the whole inbox instead of once per thread (eliminates the other
        # N+1 pattern: seller/display-name lookups and unread-cursor checks
        # that used to run 3-4 queries per thread).
        context_ids = {row["listingId"] for row in rows}
        listing_ids = [cid for cid in context_ids if not cid.startswith(REQUEST_THREAD_PREFIX)]
        request_ids = [
            cid[len(REQUEST_THREAD_PREFIX) :]
            for cid in context_ids
            if cid.startswith(REQUEST_THREAD_PREFIX)
        ]
        sellers = (
            db.table("listings").select("id,seller_id").in_("id", listing_ids).execute().data
            if listing_ids
            else []
        )
        seller_by_listing = {r["id"]: r["seller_id"] for r in sellers}
        if request_ids:
            requesters = (
                db.table("wanted_requests").select("id,user_id").in_("id", request_ids).execute().data
            )
            seller_by_listing.update(
                {f"{REQUEST_THREAD_PREFIX}{r['id']}": r["user_id"] for r in requesters}
            )

        opener_ids = list({row["user_id"] for row in rows if row["user_id"] != user_id})
        names = (
            db.table("users").select("id,display_name").in_("id", opener_ids).execute().data
            if opener_ids
            else []
        )
        name_by_user = {r["id"]: r["display_name"] for r in names}

        members = db.table("thread_members").select("*").in_("thread_id", thread_ids).execute().data
        cursor_by_thread_user = {
            (m["thread_id"], m["user_id"]): m["last_read_msg_id"] for m in members
        }

        out = []
        for row in rows:
            row["id"] = int(row["id"])
            msgs = msgs_by_thread.get(str(row["id"]), [])
            out.append(
                _viewer_relative_batched(
                    row, msgs, user_id, seller_by_listing, name_by_user, cursor_by_thread_user
                )
            )
        return out

    out = [
        _viewer_relative(t, t.get("messages", []), user_id)
        for t in threads.values()
        if _is_participant(t, user_id)
    ]
    return sorted(out, key=lambda t: t["lastTimestamp"], reverse=True)


@router.get("/users/{user_id}/threads/{thread_id}")
def get_thread(user_id: str, thread_id: int, caller_id: str = Depends(require_user)):
    """Fetches a single thread. Used to refresh just the affected conversation
    when a realtime "new message" signal arrives, instead of reloading every
    thread the user has — that round trip (plus a per-thread messages query)
    is what was showing up as a delay before a message actually appeared."""
    _check_caller(user_id, caller_id)
    if db:
        existing = db.table("threads").select("*").eq("id", str(thread_id)).execute()
        if not existing.data or not _is_participant(existing.data[0], user_id):
            raise HTTPException(status_code=404, detail="Thread not found")
        row = existing.data[0]
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
    return _viewer_relative(thread, thread["messages"], user_id)


@router.post("/users/{user_id}/threads")
def open_thread(user_id: str, body: OpenThreadRequest, caller_id: str = Depends(require_user)):
    """Opens (or reuses) the thread for a listing. Threads are always keyed by
    the buyer's id, since that's who "opens" the conversation in the normal
    flow. When the caller is the listing's seller — e.g. reaching out to
    someone who made an offer, before that person has ever opened a chat —
    `other_user_id` names the buyer, and the thread is keyed by their id
    instead so it lines up with one they might open themselves later."""
    _check_caller(user_id, caller_id)
    seller_id = _counterpart_id(body.listing_id)
    if seller_id is None:
        raise HTTPException(status_code=404, detail="Listing or request not found")

    if user_id == seller_id:
        if not body.other_user_id:
            raise HTTPException(
                status_code=400, detail="other_user_id is required to message someone about your own listing"
            )
        buyer_id = body.other_user_id
    else:
        buyer_id = user_id

    if db:
        existing = (
            db.table("threads")
            .select("*")
            .eq("user_id", buyer_id)
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

        name = _display_name(seller_id)
        tid = str(int(datetime.now(timezone.utc).timestamp() * 1000))
        thread = {
            "id": tid,
            "user_id": buyer_id,
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
        return _viewer_relative(thread, [], user_id)

    for t in threads.values():
        if t["user_id"] == buyer_id and t["listingId"] == body.listing_id:
            return _viewer_relative(t, t.get("messages", []), user_id)

    thread = _thread_dict(_next_id(), buyer_id, body.listing_id, _display_name(seller_id))
    threads[thread["id"]] = thread
    return _viewer_relative(thread, [], user_id)


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
            }
        ).eq("id", str(thread_id)).execute()
        # The sender obviously saw what they just sent — advance their cursor.
        _advance_cursor(thread_id, user_id, msg["id"])

        # Reuse the already-fetched thread_row and append the new message
        # locally instead of re-querying the DB for the thread + all messages.
        thread_row["lastMsg"] = msg["text"]
        thread_row["lastTimestamp"] = msg["timestamp"]
        thread_row["id"] = int(thread_row["id"])

        # Fetch existing messages (still needed for the full thread response,
        # but we only do this once per send, not twice as before).
        existing_msgs = (
            db.table("messages")
            .select("*")
            .eq("thread_id", str(thread_id))
            .order("timestamp")
            .execute()
            .data
        )

        # No notification-center entry here on purpose: the thread's own
        # unread badge already signals new messages and clears correctly the
        # instant it's read, whereas a separate notification had no way to
        # stay in sync with that and just piled up as noise.
        recipient_id = (
            _counterpart_id(thread_row["listingId"]) if sent_by_opener else thread_row["user_id"]
        )
        _notify_new_message(recipient_id, user_id, msg["text"], thread_id)
        return _viewer_relative(thread_row, existing_msgs, user_id)

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
    _advance_cursor(thread_id, user_id, msg["id"])

    recipient_id = (
        _counterpart_id(thread["listingId"]) if sent_by_opener else thread["user_id"]
    )
    _notify_new_message(recipient_id, user_id, msg["text"], thread_id)
    return _viewer_relative(thread, thread["messages"], user_id)


@router.patch("/users/{user_id}/threads/{thread_id}/read")
def mark_thread_read(
    user_id: str,
    thread_id: int,
    caller_id: str = Depends(require_user),
    body: MarkReadRequest | None = None,
):
    """Advances the caller's read cursor to the given message id (or the latest
    message in the thread when omitted). Cursors are monotonic, so replayed or
    out-of-order calls can never resurface already-read messages."""
    _check_caller(user_id, caller_id)
    if db:
        existing = db.table("threads").select("*").eq("id", str(thread_id)).execute()
        if not existing.data or not _is_participant(existing.data[0], user_id):
            raise HTTPException(status_code=404, detail="Thread not found")
        up_to = body.last_read_msg_id if body and body.last_read_msg_id else _latest_msg_id(thread_id)
        _advance_cursor(thread_id, user_id, up_to)
        row = dict(existing.data[0])
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
    up_to = body.last_read_msg_id if body and body.last_read_msg_id else _latest_msg_id(thread_id)
    _advance_cursor(thread_id, user_id, up_to)
    return _viewer_relative(thread, thread["messages"], user_id)
