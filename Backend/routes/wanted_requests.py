"""\"Looking For\" requests — the buy side of the marketplace.

A wanted request is deliberately **not** a Listing: it has no price or
condition, it carries a budget range, and it expires. Keeping the two models
apart means requests can never leak into the marketplace grid and listings
keep their existing shape untouched.
"""

import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from auth import require_user
from broadcast import broadcast
from database import db, users, wanted_request_responses, wanted_requests
from models import WantedRequestCreate, WantedRequestUpdate
from moderation import find_prohibited_reasons
from routes.notifications import create_notification
from storage import ensure_photo_url

router = APIRouter()

DEFAULT_EXPIRY_DAYS = 30
MAX_EXPIRY_DAYS = 180
# Mirrors the marketplace category ids the frontend ships (minus "all").
ALLOWED_CATEGORIES = {
    "movein",
    "textbooks",
    "furniture",
    "electronics",
    "bikes",
    "clothing",
    "supplies",
    "housing",
    "services",
    "other",
}
REQUESTER_COLUMNS = "id, display_name, school_year, rating_avg, rating_count"

# Words that carry no matching signal on a campus marketplace. Keeping them out
# of the token sets is what stops "looking for a good mini fridge" from
# matching every listing that says "good condition".
MATCH_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "looking",
    "need",
    "needed",
    "want",
    "wanted",
    "anyone",
    "please",
    "some",
    "have",
    "that",
    "this",
    "from",
    "used",
    "good",
    "great",
    "nice",
    "condition",
    "campus",
    "charlotte",
    "price",
    "cheap",
    "under",
    "around",
}


# ── helpers ────────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value) -> datetime | None:
    """Accepts the datetimes we build and the ISO strings PostgREST returns."""
    if value is None or isinstance(value, datetime):
        return value
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _is_expired(row: dict) -> bool:
    expires = _parse_dt(row.get("expires_at"))
    return bool(expires and expires <= _now())


def _effective_status(row: dict) -> str:
    """Expiry is derived, never stored, so a request can't keep showing as
    active just because nothing ran to flip a column."""
    status = row.get("status") or "active"
    if status == "active" and _is_expired(row):
        return "expired"
    return status


def _requester_dict(user_id: str) -> dict | None:
    if db:
        res = db.table("users").select(REQUESTER_COLUMNS).eq("id", user_id).execute()
        return res.data[0] if res.data else None
    user = users.get(user_id)
    if not user:
        return None
    return {
        "id": user.id,
        "display_name": user.display_name,
        "school_year": getattr(user, "school_year", ""),
        "rating_avg": user.rating_avg,
        "rating_count": user.rating_count,
    }


def _response_counts(request_ids: list[str]) -> dict[str, int]:
    """One query for the whole page — no per-card N+1."""
    if not request_ids:
        return {}
    if db:
        rows = (
            db.table("wanted_request_responses")
            .select("request_id")
            .in_("request_id", request_ids)
            .execute()
            .data
        )
        counts: dict[str, int] = {}
        for row in rows:
            counts[row["request_id"]] = counts.get(row["request_id"], 0) + 1
        return counts
    return {
        rid: len(wanted_request_responses.get(rid, []))
        for rid in request_ids
        if wanted_request_responses.get(rid)
    }


def _request_out(row: dict, requester: dict | None = None, response_count: int = 0) -> dict:
    data = dict(row)
    data["status"] = _effective_status(data)
    data["expires_at"] = _parse_dt(data.get("expires_at"))
    data["created_at"] = _parse_dt(data.get("created_at"))
    data["updated_at"] = _parse_dt(data.get("updated_at"))
    data["requester"] = requester if requester is not None else _requester_dict(data.get("user_id", ""))
    data["response_count"] = response_count
    return data


def _batch_out(rows: list[dict]) -> list[dict]:
    """Hydrates requester + response count for a list of rows in two queries."""
    if not rows:
        return []
    ids = [r["id"] for r in rows]
    counts = _response_counts(ids)
    requester_ids = {r.get("user_id") for r in rows if r.get("user_id")}
    if db:
        requesters = (
            db.table("users").select(REQUESTER_COLUMNS).in_("id", list(requester_ids)).execute().data
            if requester_ids
            else []
        )
        by_id = {u["id"]: u for u in requesters}
    else:
        by_id = {uid: _requester_dict(uid) for uid in requester_ids}
    return [_request_out(r, by_id.get(r.get("user_id")), counts.get(r["id"], 0)) for r in rows]


def _validate(
    title: str | None,
    category: str | None,
    description: str | None,
    budget_min: float | None,
    budget_max: float | None,
    expires_at: datetime | None,
    *,
    require_all: bool,
) -> datetime | None:
    if require_all and (not title or not category or not description):
        raise HTTPException(status_code=422, detail="Title, category and description are required")

    if category is not None and category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=422, detail="Unknown category")

    if budget_min is not None and budget_max is not None and budget_min > budget_max:
        raise HTTPException(status_code=422, detail="Minimum budget can't be more than the maximum")

    reasons = find_prohibited_reasons(title or "", description or "")
    if reasons:
        raise HTTPException(
            status_code=422,
            detail=f"Requests for prohibited items aren't allowed ({', '.join(reasons)})",
        )

    if expires_at is None:
        return _now() + timedelta(days=DEFAULT_EXPIRY_DAYS) if require_all else None
    parsed = _parse_dt(expires_at)
    if parsed is None:
        raise HTTPException(status_code=422, detail="Invalid expiration date")
    if parsed <= _now():
        raise HTTPException(status_code=422, detail="Expiration must be in the future")
    if parsed > _now() + timedelta(days=MAX_EXPIRY_DAYS):
        raise HTTPException(status_code=422, detail=f"Expiration can't be more than {MAX_EXPIRY_DAYS} days out")
    return parsed


def _get_request_row(request_id: str) -> dict | None:
    if db:
        res = db.table("wanted_requests").select("*").eq("id", request_id).execute()
        return res.data[0] if res.data else None
    row = wanted_requests.get(request_id)
    return dict(row) if row else None


def _get_request_or_404(request_id: str) -> dict:
    row = _get_request_row(request_id)
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    return row


def _require_owner(row: dict, caller_id: str) -> None:
    if row.get("user_id") != caller_id:
        raise HTTPException(status_code=403, detail="You can only edit your own requests")


# ── public feed ────────────────────────────────────────────────────────────


@router.get("/requests")
def list_requests(
    response: Response,
    category: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=120),
    status: str = Query(default="active"),
    limit: int = Query(default=12, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
):
    """Public Looking For feed. Only active, unexpired requests by default."""
    response.headers["Cache-Control"] = "public, max-age=15, stale-while-revalidate=60"
    now = _now()

    if db:
        query = db.table("wanted_requests").select("*", count="exact")
        if status == "active":
            query = query.eq("status", "active").gt("expires_at", now.isoformat())
        elif status == "expired":
            query = query.eq("status", "active").lte("expires_at", now.isoformat())
        elif status == "fulfilled":
            query = query.eq("status", "fulfilled")
        if category and category != "all":
            query = query.eq("category", category)
        if q and q.strip():
            needle = q.strip()
            query = query.or_(f"title.ilike.*{needle}*,description.ilike.*{needle}*")
        res = (
            query.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        rows = res.data or []
        total = getattr(res, "count", None)
        response.headers["X-Total-Count"] = str(total if total is not None else len(rows))
        return _batch_out(rows)

    rows = [dict(r) for r in wanted_requests.values()]
    if status == "active":
        rows = [r for r in rows if _effective_status(r) == "active"]
    elif status == "expired":
        rows = [r for r in rows if _effective_status(r) == "expired"]
    elif status == "fulfilled":
        rows = [r for r in rows if (r.get("status") or "") == "fulfilled"]
    if category and category != "all":
        rows = [r for r in rows if r.get("category") == category]
    if q and q.strip():
        needle = q.strip().lower()
        rows = [
            r
            for r in rows
            if needle in str(r.get("title", "")).lower()
            or needle in str(r.get("description", "")).lower()
        ]
    rows.sort(key=lambda r: _parse_dt(r.get("created_at")) or _now(), reverse=True)
    response.headers["X-Total-Count"] = str(len(rows))
    return _batch_out(rows[offset : offset + limit])


@router.get("/requests/{request_id}")
def get_request(request_id: str):
    row = _get_request_or_404(request_id)
    out = _batch_out([row])
    return out[0]


# ── owner management ───────────────────────────────────────────────────────


@router.get("/users/{user_id}/requests")
def list_user_requests(
    user_id: str,
    status: str = Query(default="all"),
    caller_id: str = Depends(require_user),
):
    """The caller's own requests, every status included (that's what the My
    Requests screen needs). Deliberately owner-only — the public feed is
    /requests."""
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only view your own requests")

    if db:
        query = db.table("wanted_requests").select("*").eq("user_id", user_id)
        if status in {"active", "fulfilled", "expired"}:
            if status == "expired":
                query = query.eq("status", "active").lte("expires_at", _now().isoformat())
            elif status == "active":
                query = query.eq("status", "active").gt("expires_at", _now().isoformat())
            else:
                query = query.eq("status", status)
        rows = query.order("created_at", desc=True).execute().data
        return _batch_out(rows)

    rows = [dict(r) for r in wanted_requests.values() if r.get("user_id") == user_id]
    if status in {"active", "fulfilled", "expired"}:
        rows = [r for r in rows if _effective_status(r) == status]
    rows.sort(key=lambda r: _parse_dt(r.get("created_at")) or _now(), reverse=True)
    return _batch_out(rows)


@router.post("/requests")
def create_request(body: WantedRequestCreate, caller_id: str = Depends(require_user)):
    expires_at = _validate(
        body.title,
        body.category,
        body.description,
        body.budget_min,
        body.budget_max,
        body.expires_at,
        require_all=True,
    )
    now = _now()
    row = {
        "id": str(uuid.uuid4()),
        "user_id": caller_id,
        "title": body.title.strip(),
        "description": body.description.strip(),
        "category": body.category,
        "budget_min": body.budget_min,
        "budget_max": body.budget_max,
        "preferred_location": body.preferred_location.strip(),
        "photos": [ensure_photo_url(caller_id, p)["url"] for p in body.photos],
        "status": "active",
        "expires_at": expires_at,
        "created_at": now,
        "updated_at": now,
    }
    stored = {**row, "expires_at": expires_at.isoformat(), "created_at": now.isoformat(), "updated_at": now.isoformat()}
    if db:
        db.table("wanted_requests").insert(stored).execute()
    else:
        wanted_requests[row["id"]] = stored
    broadcast("requests", "request_changed", {"id": row["id"]})
    return _request_out(stored)


@router.patch("/requests/{request_id}")
def update_request(
    request_id: str,
    body: WantedRequestUpdate,
    caller_id: str = Depends(require_user),
):
    row = _get_request_or_404(request_id)
    _require_owner(row, caller_id)

    updates: dict = {}
    for field in ("title", "description", "category", "budget_min", "budget_max", "preferred_location", "photos"):
        value = getattr(body, field)
        if value is not None:
            updates[field] = value.strip() if isinstance(value, str) else value

    new_status = body.status
    if new_status is not None:
        if new_status not in {"active", "fulfilled"}:
            raise HTTPException(status_code=422, detail="Status must be active or fulfilled")
        updates["status"] = new_status

    merged_title = updates.get("title", row.get("title"))
    merged_desc = updates.get("description", row.get("description"))
    merged_category = updates.get("category", row.get("category"))
    _validate(
        merged_title,
        merged_category,
        merged_desc,
        updates.get("budget_min", row.get("budget_min")),
        updates.get("budget_max", row.get("budget_max")),
        None,
        require_all=True,
    )

    # Reopening an expired request needs a fresh window, otherwise it flips
    # straight back to "expired" the moment it's saved.
    if new_status == "active" and _is_expired({**row, **updates}):
        updates["expires_at"] = _now() + timedelta(days=DEFAULT_EXPIRY_DAYS)
    elif body.expires_at is not None:
        updates["expires_at"] = _validate(None, None, None, None, None, body.expires_at, require_all=False)

    if updates.get("photos"):
        updates["photos"] = [ensure_photo_url(caller_id, p)["url"] for p in updates["photos"]]

    updates["updated_at"] = _now()

    if db:
        payload = {
            k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in updates.items()
        }
        res = db.table("wanted_requests").update(payload).eq("id", request_id).execute()
        updated = res.data[0] if res.data else {**row, **payload}
    else:
        stored = {
            k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in updates.items()
        }
        wanted_requests[request_id] = {**row, **stored}
        updated = wanted_requests[request_id]

    broadcast("requests", "request_changed", {"id": request_id})
    return _batch_out([updated])[0]


@router.delete("/requests/{request_id}")
def delete_request(request_id: str, caller_id: str = Depends(require_user)):
    row = _get_request_or_404(request_id)
    _require_owner(row, caller_id)
    if db:
        db.table("wanted_requests").delete().eq("id", request_id).execute()
    else:
        wanted_requests.pop(request_id, None)
        wanted_request_responses.pop(request_id, None)
    broadcast("requests", "request_changed", {"id": request_id})
    return {"ok": True}


# ── responses ──────────────────────────────────────────────────────────────


@router.post("/requests/{request_id}/respond")
def respond_to_request(request_id: str, caller_id: str = Depends(require_user)):
    """Records that the caller reached out, and tells the requester.

    The actual conversation lives in the existing messaging system — the
    frontend opens a thread keyed by `request:<id>` so both sides can keep
    talking without a second inbox.
    """
    row = _get_request_or_404(request_id)
    if row.get("user_id") == caller_id:
        raise HTTPException(status_code=400, detail="You can't respond to your own request")
    if _effective_status(row) != "active":
        raise HTTPException(status_code=400, detail="This request is no longer active")

    created_at = _now().isoformat()
    existing = None
    if db:
        found = (
            db.table("wanted_request_responses")
            .select("*")
            .eq("request_id", request_id)
            .eq("responder_id", caller_id)
            .execute()
        )
        existing = found.data[0] if found.data else None
    else:
        existing = next(
            (r for r in wanted_request_responses.get(request_id, []) if r["responder_id"] == caller_id),
            None,
        )

    if existing:
        return existing

    responder = _requester_dict(caller_id)
    responder_name = (responder or {}).get("display_name", "A student")
    response = {
        "id": str(uuid.uuid4()),
        "request_id": request_id,
        "responder_id": caller_id,
        "conversation_id": f"request:{request_id}",
        "created_at": created_at,
    }
    if db:
        db.table("wanted_request_responses").insert(response).execute()
    else:
        wanted_request_responses.setdefault(request_id, []).append(response)

    create_notification(
        row["user_id"],
        f'{responder_name} responded to your request "{row.get("title", "")}".',
        "",
        caller_id,
        responder_name,
    )
    return response


# ── listing → request matching ─────────────────────────────────────────────


def _tokens(text: str) -> set[str]:
    return {
        word
        for word in re.findall(r"[a-z0-9]+", (text or "").lower())
        if len(word) >= 4 and word not in MATCH_STOPWORDS
    }


def _already_notified(user_id: str, listing_id: str) -> bool:
    prefix = "A new listing may match your request"
    if db:
        rows = (
            db.table("notifications")
            .select("text")
            .eq("user_id", user_id)
            .eq("listing_id", listing_id)
            .execute()
            .data
        )
        return any(str(r.get("text", "")).startswith(prefix) for r in rows)
    from database import notifications

    return any(
        n.get("listing_id") == listing_id and str(n.get("text", "")).startswith(prefix)
        for n in notifications.get(user_id, [])
    )


def notify_request_matches(listing: dict, seller_id: str) -> int:
    """Notifies requesters whose active request the new listing plausibly
    matches. Conservative on purpose: same category plus either two shared
    keywords or one shared keyword that appears in the request's title.
    Returns how many people were notified.
    """
    category = listing.get("category")
    listing_id = listing.get("id", "")
    listing_name = listing.get("name", "")
    if not category or not listing_id:
        return 0

    listing_tokens = _tokens(f"{listing_name} {listing.get('description', '')}")
    if not listing_tokens:
        return 0

    if db:
        candidates = (
            db.table("wanted_requests")
            .select("*")
            .eq("status", "active")
            .eq("category", category)
            .gt("expires_at", _now().isoformat())
            .limit(200)
            .execute()
            .data
        )
    else:
        candidates = [
            dict(r)
            for r in wanted_requests.values()
            if r.get("category") == category and _effective_status(r) == "active"
        ]

    notified = 0
    for row in candidates:
        requester_id = row.get("user_id")
        if not requester_id or requester_id == seller_id:
            continue
        title_tokens = _tokens(row.get("title", ""))
        shared = listing_tokens & (_tokens(f"{row.get('title', '')} {row.get('description', '')}"))
        if len(shared) < 2 and not (shared & title_tokens):
            continue
        if _already_notified(requester_id, listing_id):
            continue
        create_notification(
            requester_id,
            f'A new listing may match your request "{row.get("title", "")}": "{listing_name}"',
            listing_id,
        )
        notified += 1
    return notified
