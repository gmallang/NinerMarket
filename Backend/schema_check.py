"""Automated check that the live Supabase schema still matches the code.

The 2026-11-11 production outage was schema drift: `users` was missing
`posting_flagged`, `flag_reason` and `bad_listing_streak`, while `User` - and
therefore every users upsert - includes them. Every signup, Google sign-in,
email verification and password reset returned a 500, and nothing detected it,
because `schema.sql` is applied by hand and there was no readiness check.

How the probe works: PostgREST resolves the column names in `select` against
the live schema cache before it reads any row, so `select=<column>&limit=1` is
a cheap existence test. `200` means the column is there; a `42703` body means
it is not; `404` / `PGRST205` means the table itself is missing. This needs the
service_role key (`SUPABASE_KEY`); the anon key is blocked by RLS and cannot
tell a missing column from an empty table.

Run it by hand after applying a migration:

    cd Backend && python schema_check.py

Exit codes: 0 = schema matches, 1 = drift (missing table/column), 2 = the probe
itself could not run (no credentials or unreachable project).
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field

import requests

# Cached so /readyz can call this on every probe without hammering PostgREST.
CACHE_SECONDS = 300
PROBE_TIMEOUT_SECONDS = 8

# Every table and column the backend reads or writes. Keep in step with
# schema.sql and models.py - a column added to a Pydantic model belongs here in
# the same change, which is the whole point of the check.
EXPECTED: dict[str, tuple[str, ...]] = {
    "users": (
        "id",
        "email",
        "display_name",
        "school_year",
        "payment_methods",
        "rating_avg",
        "rating_count",
        "password_hash",
        "email_verified",
        "verification_code",
        "verification_expires",
        "password_reset_code",
        "password_reset_expires",
        "posting_flagged",
        "flag_reason",
        "bad_listing_streak",
        "deleted_at",
    ),
    "listings": (
        "id",
        "seller_id",
        "name",
        "price",
        "category",
        "condition",
        "description",
        "status",
        "flag_reason",
        "photos",
        "photos_small",
        "pickup_location",
        "created_at",
        "sold_at",
        "deleted_at",
    ),
    "ratings": ("id", "rater_id", "ratee_id", "listing_id", "stars", "comment", "created_at"),
    "threads": (
        "id",
        "user_id",
        "listingId",
        "name",
        "avatar",
        "online",
        "unread",
        "lastMsg",
        "lastTimestamp",
    ),
    "messages": ("id", "thread_id", "text", "sent", "timestamp"),
    "thread_members": ("thread_id", "user_id", "last_read_msg_id"),
    "notifications": (
        "id",
        "user_id",
        "text",
        "listing_id",
        "related_user_id",
        "related_user_name",
        "created_at",
        "read",
    ),
    "push_subscriptions": ("endpoint", "user_id", "p256dh", "auth", "created_at"),
    "listing_reports": (
        "id",
        "listing_id",
        "reporter_id",
        "reason",
        "details",
        "status",
        "resolved_at",
        "resolved_by",
        "created_at",
    ),
    "admin_actions": (
        "id",
        "admin_id",
        "admin_email",
        "action",
        "target_type",
        "target_id",
        "target_label",
        "details",
        "created_at",
    ),
    "offers": ("id", "listing_id", "buyer_id", "price", "status", "created_at", "updated_at"),
    "saved_listings": ("user_id", "listing_id", "created_at"),
    "wanted_requests": (
        "id",
        "user_id",
        "title",
        "description",
        "category",
        "budget_min",
        "budget_max",
        "preferred_location",
        "photos",
        "status",
        "expires_at",
        "deleted_at",
        "created_at",
        "updated_at",
    ),
    "wanted_request_responses": (
        "id",
        "request_id",
        "responder_id",
        "conversation_id",
        "created_at",
    ),
}


@dataclass(frozen=True)
class SchemaReport:
    ok: bool
    missing: tuple[str, ...] = ()
    # Set when the probe could not run at all. Not drift, so it does not fail
    # readiness - a transient network blip must not mark a healthy instance
    # unready - but the CLI exits non-zero so a migration run is never mistaken
    # for a verified one.
    detail: str = ""
    checked_at: float = field(default_factory=time.time)


_cached: SchemaReport | None = None
_cached_at = 0.0


def _target() -> tuple[str, str] | None:
    url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    key = (os.getenv("SUPABASE_KEY") or "").strip()
    return (url, key) if url and key else None


def _probe(base: str, key: str, table: str, columns: tuple[str, ...]) -> tuple[int, str]:
    response = requests.get(
        f"{base}/rest/v1/{table}",
        params={"select": ",".join(columns), "limit": "1"},
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=PROBE_TIMEOUT_SECONDS,
    )
    return response.status_code, response.text[:600]


def _error_code(body: str) -> str:
    try:
        return str(json.loads(body).get("code", ""))
    except (ValueError, AttributeError):
        return ""


def _missing_column_from(body: str, table: str) -> str:
    """PostgREST names the offending column: 'column users.flag_reason does not
    exist'. Returns '' when the body is something else entirely."""
    try:
        message = str(json.loads(body).get("message", ""))
    except (ValueError, AttributeError):
        return ""
    prefix = f"column {table}."
    if prefix in message and "does not exist" in message:
        remainder = message.split(prefix, 1)[1]
        return remainder.split(" ", 1)[0].strip('"')
    return ""


def check_schema(force: bool = False) -> SchemaReport:
    """Probes the configured project once per CACHE_SECONDS."""
    global _cached, _cached_at

    target = _target()
    if target is None:
        return SchemaReport(ok=True, detail="no SUPABASE_URL/SUPABASE_KEY configured")

    now = time.monotonic()
    if not force and _cached is not None and now - _cached_at < CACHE_SECONDS:
        return _cached

    base, key = target
    missing: list[str] = []

    for table, columns in EXPECTED.items():
        try:
            status, body = _probe(base, key, table, columns)
        except requests.RequestException as exc:
            report = SchemaReport(ok=True, detail=f"{table}: probe failed ({type(exc).__name__})")
            _cached, _cached_at = report, now
            return report

        if status == 200:
            continue

        if status == 404 or _error_code(body) == "PGRST205":
            missing.append(table)
            continue

        if _error_code(body) == "42703":
            # One request reported the first missing column; probe the rest
            # individually so a single run lists every gap in the table.
            for column in columns:
                try:
                    column_status, column_body = _probe(base, key, table, (column,))
                except requests.RequestException as exc:
                    report = SchemaReport(
                        ok=True, detail=f"{table}.{column}: probe failed ({type(exc).__name__})"
                    )
                    _cached, _cached_at = report, now
                    return report
                if column_status != 200:
                    missing.append(f"{table}.{_missing_column_from(column_body, table) or column}")
            continue

        report = SchemaReport(
            ok=True, detail=f"{table}: unexpected probe status {status} ({_error_code(body) or 'no code'})"
        )
        _cached, _cached_at = report, now
        return report

    report = SchemaReport(ok=not missing, missing=tuple(missing))
    _cached, _cached_at = report, now
    return report


if __name__ == "__main__":
    result = check_schema(force=True)
    if result.detail:
        print(f"schema check could not run: {result.detail}")
        raise SystemExit(2)
    if result.ok:
        print(f"schema ok ({len(EXPECTED)} tables)")
        raise SystemExit(0)
    print("schema drift detected - apply Backend/migrations, then reload PostgREST:")
    for item in result.missing:
        print(f"  missing: {item}")
    raise SystemExit(1)
