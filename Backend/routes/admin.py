"""Admin panel endpoints — read every row, delete any row.

The panel exists so the project's moderators can take content down without
opening the database console. Access is an email allow-list (`ADMIN_EMAILS`,
see auth.py) re-checked against the caller's session on every request: the
frontend hides the panel from everyone else, but require_admin is what
actually decides.

Deletes are hard deletes. In Postgres the foreign keys cascade the dependent
rows (offers, saved items, reports, notifications), so the in-memory dev store
has to sweep those collections itself.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from auth import is_admin_email, require_user
from broadcast import broadcast
from database import (
    db,
    listings,
    notifications,
    push_subscriptions,
    ratings,
    reports,
    saved,
    users,
    wanted_request_responses,
    wanted_requests,
)
from routes.listings import SELLER_COLUMNS
from routes.notifications import create_notification
from routes.users import get_user_by_id
from routes.wanted_requests import _batch_out

router = APIRouter()

USER_COLUMNS = "id, email, display_name, school_year, email_verified, rating_avg, rating_count"


def require_admin(user_id: str = Depends(require_user)) -> str:
    """FastAPI dependency: require_user, plus the caller must be an admin.
    Resolves the session's user id to an email, so the flag the browser holds
    is never what grants access."""
    user = get_user_by_id(user_id)
    if not user or not is_admin_email(user.email):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id


# ── shared lookups ─────────────────────────────────────────────────────────


def _count_by(rows: list[dict], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        counts[row[key]] = counts.get(row[key], 0) + 1
    return counts


def _report_counts(listing_ids: list[str]) -> dict[str, int]:
    """Reports per listing in a single query — the panel surfaces them so
    admins can see which listings students have already complained about."""
    if not listing_ids:
        return {}
    if db:
        rows = (
            db.table("listing_reports")
            .select("listing_id")
            .in_("listing_id", listing_ids)
            .execute()
            .data
        )
    else:
        rows = [r for r in reports.values() if r["listing_id"] in listing_ids]
    return _count_by(rows, "listing_id")


def _listing_counts(user_ids: list[str]) -> dict[str, int]:
    """Listings per seller, so deleting an account shows its blast radius."""
    if not user_ids:
        return {}
    if db:
        rows = (
            db.table("listings")
            .select("seller_id")
            .in_("seller_id", user_ids)
            .execute()
            .data
        )
    else:
        rows = [
            {"seller_id": l.seller_id} for l in listings.values() if l.seller_id in user_ids
        ]
    return _count_by(rows, "seller_id")


def _sellers(seller_ids: set[str]) -> dict[str, dict]:
    if not seller_ids:
        return {}
    if db:
        rows = (
            db.table("users")
            .select(SELLER_COLUMNS)
            .in_("id", list(seller_ids))
            .execute()
            .data
        )
        return {row["id"]: row for row in rows}

    found: dict[str, dict] = {}
    for user_id in seller_ids:
        user = users.get(user_id)
        if not user:
            continue
        found[user_id] = {
            "id": user.id,
            "display_name": user.display_name,
            "school_year": getattr(user, "school_year", ""),
            "payment_methods": getattr(user, "payment_methods", []),
            "rating_avg": user.rating_avg,
            "rating_count": user.rating_count,
        }
    return found


def _decorate_listings(rows: list[dict]) -> list[dict]:
    counts = _report_counts([r["id"] for r in rows])
    sellers = _sellers({r.get("seller_id") for r in rows if r.get("seller_id")})
    for row in rows:
        row["seller"] = sellers.get(row.get("seller_id"))
        row["report_count"] = counts.get(row["id"], 0)
    return rows


def _matches(text: str, needle: str) -> bool:
    return needle in (text or "").lower()


# ── listings ───────────────────────────────────────────────────────────────


@router.get("/admin/listings")
def list_all_listings(
    response: Response,
    q: str | None = Query(default=None, max_length=120),
    status: str = Query(default="all"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(require_admin),
):
    """Every listing in any status — active, sold, flagged — newest first.
    Unlike the public feed this never hides flagged listings, since those are
    exactly what an admin is here to look at."""
    needle = (q or "").strip()

    if db:
        query = db.table("listings").select("*", count="exact")
        if status != "all":
            query = query.eq("status", status)
        if needle:
            query = query.or_(f"name.ilike.*{needle}*,description.ilike.*{needle}*")
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        rows = res.data or []
        total = getattr(res, "count", None)
        response.headers["X-Total-Count"] = str(total if total is not None else len(rows))
        return _decorate_listings(rows)

    rows = [l.model_dump(mode="json") for l in listings.values()]
    if status != "all":
        rows = [r for r in rows if r.get("status") == status]
    if needle:
        lower = needle.lower()
        rows = [r for r in rows if _matches(f'{r.get("name", "")} {r.get("description", "")}', lower)]
    rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
    response.headers["X-Total-Count"] = str(len(rows))
    return _decorate_listings(rows[offset : offset + limit])


@router.delete("/admin/listings/{listing_id}")
def delete_any_listing(listing_id: str, _: str = Depends(require_admin)):
    """Removes a listing regardless of who owns it. The seller is told it was
    a moderator (not another student) so a takedown isn't a mystery."""
    if db:
        existing = (
            db.table("listings")
            .select("id, seller_id, name")
            .eq("id", listing_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        row = existing.data[0]
        db.table("listings").delete().eq("id", listing_id).execute()
    else:
        if listing_id not in listings:
            raise HTTPException(status_code=404, detail="Listing not found")
        listing = listings.pop(listing_id)
        row = {"id": listing_id, "seller_id": listing.seller_id, "name": listing.name}
        for saved_ids in saved.values():
            saved_ids.discard(listing_id)
        for report_id in [r["id"] for r in reports.values() if r["listing_id"] == listing_id]:
            reports.pop(report_id, None)

    create_notification(
        row["seller_id"],
        f'Your listing "{row["name"]}" was removed by a moderator.',
        "",
    )
    broadcast("listings", "listing_changed", {})
    return {"deleted": listing_id}


# ── Looking For requests ───────────────────────────────────────────────────


@router.get("/admin/requests")
def list_all_requests(
    response: Response,
    q: str | None = Query(default=None, max_length=120),
    status: str = Query(default="all"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(require_admin),
):
    needle = (q or "").strip()

    if db:
        query = db.table("wanted_requests").select("*", count="exact")
        if status != "all":
            query = query.eq("status", status)
        if needle:
            query = query.or_(f"title.ilike.*{needle}*,description.ilike.*{needle}*")
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        rows = res.data or []
        total = getattr(res, "count", None)
        response.headers["X-Total-Count"] = str(total if total is not None else len(rows))
        return _batch_out(rows)

    rows = [dict(r) for r in wanted_requests.values()]
    if status != "all":
        rows = [r for r in rows if (r.get("status") or "active") == status]
    if needle:
        lower = needle.lower()
        rows = [r for r in rows if _matches(f'{r.get("title", "")} {r.get("description", "")}', lower)]
    rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
    response.headers["X-Total-Count"] = str(len(rows))
    return _batch_out(rows[offset : offset + limit])


@router.delete("/admin/requests/{request_id}")
def delete_any_request(request_id: str, _: str = Depends(require_admin)):
    if db:
        existing = (
            db.table("wanted_requests")
            .select("id, user_id, title")
            .eq("id", request_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Request not found")
        row = existing.data[0]
        db.table("wanted_requests").delete().eq("id", request_id).execute()
    else:
        row = wanted_requests.pop(request_id, None)
        if row is None:
            raise HTTPException(status_code=404, detail="Request not found")
        wanted_request_responses.pop(request_id, None)

    create_notification(
        row["user_id"],
        f'Your request "{row["title"]}" was removed by a moderator.',
        "",
    )
    broadcast("requests", "request_changed", {"id": request_id})
    return {"deleted": request_id}


# ── accounts ───────────────────────────────────────────────────────────────


@router.get("/admin/users")
def list_all_users(
    response: Response,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(require_admin),
):
    needle = (q or "").strip()

    if db:
        query = db.table("users").select(USER_COLUMNS, count="exact")
        if needle:
            query = query.or_(f"email.ilike.*{needle}*,display_name.ilike.*{needle}*")
        res = query.order("display_name").range(offset, offset + limit - 1).execute()
        rows = res.data or []
        total = getattr(res, "count", None)
    else:
        rows = [
            {
                "id": u.id,
                "email": u.email,
                "display_name": u.display_name,
                "school_year": u.school_year,
                "email_verified": u.email_verified,
                "rating_avg": u.rating_avg,
                "rating_count": u.rating_count,
            }
            for u in users.values()
        ]
        if needle:
            lower = needle.lower()
            rows = [r for r in rows if _matches(f'{r["email"]} {r["display_name"]}', lower)]
        rows.sort(key=lambda r: str(r["display_name"]).lower())
        rows, total = rows[offset : offset + limit], len(rows)

    counts = _listing_counts([r["id"] for r in rows])
    for row in rows:
        row["is_admin"] = is_admin_email(row.get("email"))
        row["listing_count"] = counts.get(row["id"], 0)

    response.headers["X-Total-Count"] = str(total if total is not None else len(rows))
    return rows


@router.delete("/admin/users/{user_id}")
def delete_any_user(user_id: str, admin_id: str = Depends(require_admin)):
    """Deletes an account and everything hanging off it. Blocked for the
    caller's own account so an admin can't lock themselves out mid-session."""
    if user_id == admin_id:
        raise HTTPException(
            status_code=400, detail="You can't delete your own account from the admin panel"
        )

    if db:
        existing = db.table("users").select("id").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="User not found")
        db.table("users").delete().eq("id", user_id).execute()
    else:
        if users.pop(user_id, None) is None:
            raise HTTPException(status_code=404, detail="User not found")
        for listing_id in [l.id for l in listings.values() if l.seller_id == user_id]:
            listings.pop(listing_id, None)
        for request_id in [
            r["id"] for r in wanted_requests.values() if r.get("user_id") == user_id
        ]:
            wanted_requests.pop(request_id, None)
            wanted_request_responses.pop(request_id, None)
        for rating_id in [
            r.id for r in ratings.values() if user_id in (r.rater_id, r.ratee_id)
        ]:
            ratings.pop(rating_id, None)
        saved.pop(user_id, None)
        notifications.pop(user_id, None)
        push_subscriptions.pop(user_id, None)

    broadcast("listings", "listing_changed", {})
    return {"deleted": user_id}
