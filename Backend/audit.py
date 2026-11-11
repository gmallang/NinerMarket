"""Append-only log of admin actions.

Every mutating admin endpoint calls `log_action`, so the panel can answer "who
deleted that listing, and when?" long after the row is gone. The log has no
foreign keys on purpose: a closed account or a removed listing must not take
its history with it.

Writes are best-effort. A logging failure is reported to the server log but
never fails the moderation action itself - the action is what the admin asked
for, and the request should not half-succeed because the log insert failed.
"""

import logging
import uuid
from datetime import datetime, timezone

from database import admin_actions, db, users

AUDIT_COLUMNS = (
    "id, admin_id, admin_email, action, target_type, target_id, target_label, "
    "details, created_at"
)

logger = logging.getLogger("uvicorn.error")


def log_action(
    admin_id: str,
    action: str,
    target_type: str,
    target_id: str = "",
    target_label: str = "",
    details: str = "",
) -> dict:
    """Records one admin action. `action` is a stable dotted name such as
    "listing.delete" or "user.flag"; `target_label` is the human-readable name
    the panel shows (listing title, account name) so the log stays readable
    after the target is deleted."""
    admin_email = ""
    if db:
        res = db.table("users").select("email").eq("id", admin_id).execute()
        admin_email = res.data[0].get("email", "") if res.data else ""
    else:
        user = users.get(admin_id)
        admin_email = getattr(user, "email", "") if user else ""

    row = {
        "id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "admin_email": admin_email,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "target_label": target_label[:200],
        "details": details[:500],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if db:
        try:
            db.table("admin_actions").insert(row).execute()
        except Exception:
            logger.exception("admin audit write failed: %s", action)
    else:
        admin_actions.append(row)
    return row


def list_actions(needle: str = "", limit: int = 100, offset: int = 0) -> tuple[list[dict], int]:
    """Newest-first page of the audit log, optionally filtered by a substring
    across action, target label, details and admin email."""
    needle = needle.strip().lower()

    if db:
        query = db.table("admin_actions").select(AUDIT_COLUMNS, count="exact")
        if needle:
            query = query.or_(
                f"action.ilike.*{needle}*,target_label.ilike.*{needle}*,"
                f"details.ilike.*{needle}*,admin_email.ilike.*{needle}*"
            )
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        rows = res.data or []
        total = getattr(res, "count", None)
        return rows, int(total if total is not None else len(rows))

    rows = list(reversed(admin_actions))
    if needle:
        fields = ("action", "target_label", "details", "admin_email")
        rows = [
            row
            for row in rows
            if needle in " ".join(str(row.get(key, "")) for key in fields).lower()
        ]
    return rows[offset : offset + limit], len(rows)
