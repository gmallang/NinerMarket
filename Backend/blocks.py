"""Blocking: one student cutting another out of their marketplace.

A block is stored in one direction (blocker -> blocked) but takes effect in
both: neither side can start a conversation, send a message, or make an offer
to the other. Existing threads stay readable - history is not destroyed - but
no new messages go through until the block is lifted.
"""

from datetime import datetime, timezone

from database import blocks, db
from database import users as user_store


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_blocked_between(a: str, b: str) -> bool:
    """True when either account has blocked the other."""
    if not a or not b or a == b:
        return False
    if db:
        res = (
            db.table("blocks")
            .select("blocker_id")
            .or_(
                f"and(blocker_id.eq.{a},blocked_id.eq.{b}),"
                f"and(blocker_id.eq.{b},blocked_id.eq.{a})"
            )
            .limit(1)
            .execute()
        )
        return bool(res.data)
    return (a, b) in blocks or (b, a) in blocks


def block(blocker_id: str, blocked_id: str) -> None:
    """Idempotent: blocking someone twice is a no-op, not an error."""
    if db:
        db.table("blocks").upsert(
            {
                "blocker_id": blocker_id,
                "blocked_id": blocked_id,
                "created_at": _now(),
            },
            on_conflict="blocker_id,blocked_id",
        ).execute()
        return
    blocks.setdefault((blocker_id, blocked_id), _now())


def unblock(blocker_id: str, blocked_id: str) -> None:
    if db:
        db.table("blocks").delete().eq("blocker_id", blocker_id).eq(
            "blocked_id", blocked_id
        ).execute()
        return
    blocks.pop((blocker_id, blocked_id), None)


def blocked_ids(blocker_id: str) -> set[str]:
    if db:
        rows = (
            db.table("blocks")
            .select("blocked_id")
            .eq("blocker_id", blocker_id)
            .execute()
            .data
            or []
        )
        return {row["blocked_id"] for row in rows}
    return {blocked for (blocker, blocked) in blocks if blocker == blocker_id}


def list_blocked(blocker_id: str) -> list[dict]:
    """The people this account has blocked, newest first, with just enough
    profile to recognise them in the settings list."""
    if db:
        rows = (
            db.table("blocks")
            .select("blocked_id, created_at")
            .eq("blocker_id", blocker_id)
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )
        ids = [row["blocked_id"] for row in rows]
        if not ids:
            return []
        people = (
            db.table("users")
            .select("id, display_name")
            .in_("id", ids)
            .execute()
            .data
            or []
        )
        names = {person["id"]: person for person in people}
        return [
            names.get(blocked_id, {"id": blocked_id, "display_name": "Former member"})
            for blocked_id in ids
        ]

    ordered = sorted(
        ((blocked, created) for (blocker, blocked), created in blocks.items() if blocker == blocker_id),
        key=lambda pair: pair[1],
        reverse=True,
    )
    out = []
    for blocked_id, _created in ordered:
        user = user_store.get(blocked_id)
        out.append(
            {
                "id": blocked_id,
                "display_name": user.display_name if user else "Former member",
            }
        )
    return out
