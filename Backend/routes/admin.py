"""Admin panel endpoints — moderate every row, and be able to undo it.

The panel exists so the project's moderators can act without opening the
database console. Access is an email allow-list (`ADMIN_EMAILS`, see auth.py)
re-checked against the caller's session on every request: the frontend hides
the panel from everyone else, but require_admin is what actually decides.

Three moderation workflows live here:

* **Reports** — listing reports are read as a queue with the reporter, reason
  and details. Dismissing a report clears it; once a listing has no open
  reports left, a hide that came only from reports is lifted. Upholding a
  report removes the listing.
* **Audit log** — every mutating endpoint records who did what in
  `admin_actions` (see audit.py), which the panel shows in its own tab.
* **Soft delete** — closing an account sets `users.deleted_at` and hides the
  account's listings and requests instead of destroying them. The Deleted tab
  restores it. Content takedowns (listing / request / rating) are still hard
  deletes; the audit log is their record.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from audit import list_actions, log_action
from auth import is_admin_email, require_user
from broadcast import broadcast
from database import (
    db,
    listings,
    offers,
    ratings,
    reports,
    saved,
    users,
    wanted_request_responses,
    wanted_requests,
)
from models import UserFlagUpdate
from routes.listings import SELLER_COLUMNS
from routes.notifications import create_notification
from routes.ratings import recompute_seller_rating
from routes.users import get_user_by_id
from routes.wanted_requests import _batch_out
from trust import record_bad_listing, record_good_listing

router = APIRouter()

USER_COLUMNS = (
    "id, email, display_name, school_year, email_verified, rating_avg, rating_count, "
    "posting_flagged, flag_reason, bad_listing_streak, deleted_at"
)

REPORT_COLUMNS = "id, listing_id, reporter_id, reason, details, status, resolved_at, resolved_by, created_at"


def require_admin(user_id: str = Depends(require_user)) -> str:
    """FastAPI dependency: require_user, plus the caller must be an admin.
    Resolves the session's user id to an email, so the flag the browser holds
    is never what grants access."""
    user = get_user_by_id(user_id)
    if not user or not is_admin_email(user.email):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def _people(user_ids: set[str]) -> dict[str, dict]:
    """id/name/email for the report queue, in one query."""
    if not user_ids:
        return {}
    if db:
        rows = (
            db.table("users")
            .select("id, display_name, email")
            .in_("id", list(user_ids))
            .execute()
            .data
        )
        return {row["id"]: row for row in rows}

    found: dict[str, dict] = {}
    for user_id in user_ids:
        user = users.get(user_id)
        if user:
            found[user_id] = {
                "id": user.id,
                "display_name": user.display_name,
                "email": user.email,
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


def _decorate_ratings(rows: list[dict]) -> list[dict]:
    """Attach both sides of the rating so an admin can see who wrote it and
    who received it without opening the database."""
    party_ids = {
        row[key] for row in rows for key in ("rater_id", "ratee_id") if row.get(key)
    }
    parties = _sellers(party_ids)
    for row in rows:
        row["rater"] = parties.get(row.get("rater_id"))
        row["ratee"] = parties.get(row.get("ratee_id"))
    return rows


# ── listings ───────────────────────────────────────────────────────────────


@router.get("/admin/listings")
def list_all_listings(
    response: Response,
    q: str | None = Query(default=None, max_length=120),
    status: str = Query(default="all", max_length=60),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(require_admin),
):
    """Every live listing in any status — active, sold, pending, flagged —
    newest first. Listings hidden by a closed account are excluded; restore the
    account from the Deleted tab to see them again."""
    needle = (q or "").strip()

    if db:
        query = (
            db.table("listings")
            .select("*", count="exact")
            .is_("deleted_at", "null")
        )
        if status != "all":
            query = query.eq("status", status)
        if needle:
            query = query.or_(f"name.ilike.*{needle}*,description.ilike.*{needle}*")
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        rows = res.data or []
        total = getattr(res, "count", None)
        response.headers["X-Total-Count"] = str(total if total is not None else len(rows))
        return _decorate_listings(rows)

    rows = [
        l.model_dump(mode="json")
        for l in listings.values()
        if getattr(l, "deleted_at", None) is None
    ]
    if status != "all":
        rows = [r for r in rows if r.get("status") == status]
    if needle:
        lower = needle.lower()
        rows = [r for r in rows if _matches(f'{r.get("name", "")} {r.get("description", "")}', lower)]
    rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
    response.headers["X-Total-Count"] = str(len(rows))
    return _decorate_listings(rows[offset : offset + limit])


def _remove_listing(listing_id: str, admin_id: str, details: str = "") -> dict:
    """Removes a listing regardless of who owns it, tells the seller it was a
    moderator, and records the strike + audit entry. Shared by the direct
    delete endpoint and upholding a report."""
    if db:
        existing = (
            db.table("listings")
            .select("id, seller_id, name, status")
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
        row = {
            "id": listing_id,
            "seller_id": listing.seller_id,
            "name": listing.name,
            "status": listing.status,
        }
        for saved_ids in saved.values():
            saved_ids.discard(listing_id)
        for report_id in [r["id"] for r in reports.values() if r["listing_id"] == listing_id]:
            reports.pop(report_id, None)

    create_notification(
        row["seller_id"],
        f'Your listing "{row["name"]}" was removed by a moderator.',
        "",
    )
    # A takedown is a bad listing, unless it was already flagged - that one was
    # counted when the flag was applied, so counting it again would double it.
    if row.get("status") != "flagged":
        record_bad_listing(row["seller_id"], "Listing removed by a moderator")
    log_action(
        admin_id,
        "listing.delete",
        "listing",
        listing_id,
        row["name"],
        details or f'Removed a {row.get("status", "listing")} listing',
    )
    broadcast("listings", "listing_changed", {})
    return row


@router.delete("/admin/listings/{listing_id}")
def delete_any_listing(listing_id: str, admin_id: str = Depends(require_admin)):
    """Removes a listing regardless of who owns it. The seller is told it was
    a moderator (not another student) so a takedown isn't a mystery."""
    row = _remove_listing(listing_id, admin_id)
    return {"deleted": row["id"]}


@router.post("/admin/listings/{listing_id}/approve")
def approve_listing(listing_id: str, admin_id: str = Depends(require_admin)):
    """Publishes a pending (or flagged) listing after a moderator has looked at
    it, and clears the flag so the seller starts with a clean slate."""
    if db:
        existing = (
            db.table("listings")
            .select("id, seller_id, name, status")
            .eq("id", listing_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Listing not found")
        row = existing.data[0]
        if row["status"] not in {"pending", "flagged"}:
            raise HTTPException(
                status_code=400, detail="Only pending or flagged listings need approval"
            )
        db.table("listings").update(
            {"status": "active", "flag_reason": ""}
        ).eq("id", listing_id).execute()
    else:
        listing = listings.get(listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        if listing.status not in {"pending", "flagged"}:
            raise HTTPException(
                status_code=400, detail="Only pending or flagged listings need approval"
            )
        row = {"id": listing.id, "seller_id": listing.seller_id, "name": listing.name}
        listing.status = "active"
        listing.flag_reason = ""

    record_good_listing(row["seller_id"])
    create_notification(
        row["seller_id"],
        f'Your listing "{row["name"]}" was approved and is now live.',
        listing_id,
    )
    log_action(admin_id, "listing.approve", "listing", listing_id, row["name"])
    broadcast("listings", "listing_changed", {"id": listing_id})
    return {"id": listing_id, "status": "active"}


# ── reports ────────────────────────────────────────────────────────────────


def _decorate_reports(rows: list[dict]) -> list[dict]:
    """Attach the reported listing and the reporter so the queue can be judged
    from the row itself."""
    listing_ids = {r.get("listing_id") for r in rows if r.get("listing_id")}
    reporter_ids = {r.get("reporter_id") for r in rows if r.get("reporter_id")}

    listed: dict[str, dict] = {}
    if db:
        if listing_ids:
            listed = {
                row["id"]: row
                for row in db.table("listings")
                .select("id, name, status, seller_id, price")
                .in_("id", list(listing_ids))
                .execute()
                .data
            }
    else:
        for listing_id in listing_ids:
            listing = listings.get(listing_id)
            if listing:
                listed[listing_id] = {
                    "id": listing.id,
                    "name": listing.name,
                    "status": listing.status,
                    "seller_id": listing.seller_id,
                    "price": listing.price,
                }

    reporters = _people(reporter_ids)
    for row in rows:
        row.setdefault("status", "open")
        row["listing"] = listed.get(row.get("listing_id"))
        row["reporter"] = reporters.get(row.get("reporter_id"))
    return rows


def _get_report_row(report_id: str) -> dict | None:
    if db:
        res = (
            db.table("listing_reports")
            .select(REPORT_COLUMNS)
            .eq("id", report_id)
            .execute()
        )
        return res.data[0] if res.data else None
    row = reports.get(report_id)
    return dict(row) if row else None


def _open_report_count(listing_id: str) -> int:
    if db:
        rows = (
            db.table("listing_reports")
            .select("id")
            .eq("listing_id", listing_id)
            .eq("status", "open")
            .execute()
            .data
        )
        return len(rows)
    return sum(
        1
        for row in reports.values()
        if row.get("listing_id") == listing_id and row.get("status", "open") == "open"
    )


def _resolve_report(report_id: str, resolution: str, admin_id: str, row: dict) -> dict:
    fields = {
        "status": resolution,
        "resolved_at": _now_iso(),
        "resolved_by": admin_id,
    }
    if db:
        db.table("listing_reports").update(fields).eq("id", report_id).execute()
    else:
        reports.setdefault(report_id, {}).update(fields)
    return {**row, **fields}


def _lift_report_hide(listing_id: str, admin_id: str) -> dict | None:
    """When every report against a listing has been dismissed, and the hide was
    caused by those reports (not the prohibited-text filter), put the listing
    back. Otherwise the listing would stay invisible with nothing left to
    explain it."""
    if db:
        res = (
            db.table("listings")
            .select("id, seller_id, name, status, flag_reason")
            .eq("id", listing_id)
            .execute()
        )
        row = res.data[0] if res.data else None
        if not row:
            return None
        if row.get("status") != "flagged" or "User report" not in (row.get("flag_reason") or ""):
            return None
        db.table("listings").update(
            {"status": "active", "flag_reason": ""}
        ).eq("id", listing_id).execute()
    else:
        listing = listings.get(listing_id)
        if not listing:
            return None
        if listing.status != "flagged" or "User report" not in (listing.flag_reason or ""):
            return None
        listing.status = "active"
        listing.flag_reason = ""
        row = {"id": listing.id, "seller_id": listing.seller_id, "name": listing.name}

    record_good_listing(row["seller_id"])
    create_notification(
        row["seller_id"],
        f'Your listing "{row["name"]}" was reviewed and is live again.',
        listing_id,
    )
    log_action(
        admin_id,
        "listing.restore",
        "listing",
        listing_id,
        row["name"],
        "Every report was dismissed",
    )
    broadcast("listings", "listing_changed", {"id": listing_id})
    return row


@router.get("/admin/reports")
def list_reports(
    response: Response,
    status: str = Query(default="open", max_length=30),
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(require_admin),
):
    """The report queue: who reported what, why, and whether it's been dealt
    with. Defaults to open reports, newest first."""
    needle = (q or "").strip().lower()

    if db:
        query = db.table("listing_reports").select(REPORT_COLUMNS, count="exact")
        if status != "all":
            query = query.eq("status", status)
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        rows = res.data or []
        total = getattr(res, "count", None)
    else:
        rows = [dict(r) for r in reports.values()]
        for row in rows:
            row.setdefault("status", "open")
        if status != "all":
            rows = [row for row in rows if row["status"] == status]
        rows.sort(key=lambda row: str(row.get("created_at") or ""), reverse=True)
        total = len(rows)
        rows = rows[offset : offset + limit]

    rows = _decorate_reports(rows)
    if needle:
        def report_text(row: dict) -> str:
            listing = row.get("listing") or {}
            reporter = row.get("reporter") or {}
            return (
                f'{row.get("reason", "")} {row.get("details", "")} '
                f'{listing.get("name", "")} {reporter.get("display_name", "")}'
            )

        rows = [row for row in rows if _matches(report_text(row), needle)]

    response.headers["X-Total-Count"] = str(total if total is not None else len(rows))
    return rows


@router.post("/admin/reports/{report_id}/dismiss")
def dismiss_report(report_id: str, admin_id: str = Depends(require_admin)):
    """Closes a report without touching the listing. If that was the last open
    report and the listing was hidden only because of reports, it goes live
    again."""
    row = _get_report_row(report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    if row.get("status", "open") != "open":
        raise HTTPException(status_code=400, detail="This report is already resolved")

    row = _resolve_report(report_id, "dismissed", admin_id, row)
    listing = row.get("listing_id") or ""
    log_action(
        admin_id,
        "report.dismiss",
        "report",
        report_id,
        (row.get("reason") or "")[:200],
        f'Dismissed a report on listing "{listing}"',
    )

    if listing and _open_report_count(listing) == 0:
        _lift_report_hide(listing, admin_id)

    return _decorate_reports([row])[0]


@router.post("/admin/reports/{report_id}/uphold")
def uphold_report(report_id: str, admin_id: str = Depends(require_admin)):
    """Agrees with a report: the listing is removed, the seller is notified,
    and the action is recorded. Removing the listing also removes its other
    reports (they point at a row that no longer exists)."""
    row = _get_report_row(report_id)
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    if row.get("status", "open") != "open":
        raise HTTPException(status_code=400, detail="This report is already resolved")

    listing_id = row.get("listing_id") or ""
    listing = None
    if listing_id:
        if db:
            res = db.table("listings").select("name").eq("id", listing_id).execute()
            listing = res.data[0]["name"] if res.data else None
        else:
            found = listings.get(listing_id)
            listing = found.name if found else None

    _resolve_report(report_id, "upheld", admin_id, row)
    log_action(
        admin_id,
        "report.uphold",
        "report",
        report_id,
        (row.get("reason") or "")[:200],
        f'Upheld a report on "{listing or listing_id}": {row.get("reason", "")}',
    )

    if listing_id:
        try:
            _remove_listing(
                listing_id,
                admin_id,
                details=f'Upheld a "{row.get("reason", "report")}" report',
            )
        except HTTPException as exc:
            if exc.status_code != 404:
                raise

    return {"upheld": report_id, "deleted": listing_id}


# ── Looking For requests ───────────────────────────────────────────────────


@router.get("/admin/requests")
def list_all_requests(
    response: Response,
    q: str | None = Query(default=None, max_length=120),
    status: str = Query(default="all", max_length=60),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(require_admin),
):
    needle = (q or "").strip()

    if db:
        query = (
            db.table("wanted_requests")
            .select("*", count="exact")
            .is_("deleted_at", "null")
        )
        if status != "all":
            query = query.eq("status", status)
        if needle:
            query = query.or_(f"title.ilike.*{needle}*,description.ilike.*{needle}*")
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        rows = res.data or []
        total = getattr(res, "count", None)
        response.headers["X-Total-Count"] = str(total if total is not None else len(rows))
        return _batch_out(rows)

    rows = [
        dict(r) for r in wanted_requests.values() if not r.get("deleted_at")
    ]
    if status != "all":
        rows = [r for r in rows if (r.get("status") or "active") == status]
    if needle:
        lower = needle.lower()
        rows = [r for r in rows if _matches(f'{r.get("title", "")} {r.get("description", "")}', lower)]
    rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
    response.headers["X-Total-Count"] = str(len(rows))
    return _batch_out(rows[offset : offset + limit])


@router.delete("/admin/requests/{request_id}")
def delete_any_request(request_id: str, admin_id: str = Depends(require_admin)):
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
    log_action(admin_id, "request.delete", "request", request_id, row["title"])
    broadcast("requests", "request_changed", {"id": request_id})
    return {"deleted": request_id}


# ── ratings ────────────────────────────────────────────────────────────────


@router.get("/admin/ratings")
def list_all_ratings(
    response: Response,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(require_admin),
):
    """Every rating, newest first. Kept separate from the public profile
    endpoint so admins can moderate retaliatory or fraudulent reviews."""
    needle = (q or "").strip().lower()

    if db:
        rows = (
            db.table("ratings")
            .select("*")
            .order("created_at", desc=True)
            .limit(500)
            .execute()
            .data
            or []
        )
    else:
        rows = [r.model_dump(mode="json") for r in ratings.values()]
        rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)

    rows = _decorate_ratings(rows)
    if needle:
        def rating_text(row: dict) -> str:
            rater = row.get("rater") or {}
            ratee = row.get("ratee") or {}
            return (
                f'{row.get("comment", "")} {rater.get("display_name", "")} '
                f'{ratee.get("display_name", "")}'
            )

        rows = [row for row in rows if _matches(rating_text(row), needle)]

    response.headers["X-Total-Count"] = str(len(rows))
    return rows[offset : offset + limit]


@router.delete("/admin/ratings/{rating_id}")
def delete_any_rating(rating_id: str, admin_id: str = Depends(require_admin)):
    """Removes a rating and immediately recalculates the recipient's public
    average, so a takedown doesn't leave stale stars on their profile."""
    if db:
        existing = (
            db.table("ratings")
            .select("id, ratee_id, stars")
            .eq("id", rating_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Rating not found")
        row = existing.data[0]
        ratee_id = row["ratee_id"]
        db.table("ratings").delete().eq("id", rating_id).execute()
    else:
        rating = ratings.pop(rating_id, None)
        if rating is None:
            raise HTTPException(status_code=404, detail="Rating not found")
        ratee_id = rating.ratee_id
        row = {"id": rating_id, "stars": rating.stars, "ratee_id": ratee_id}

    recompute_seller_rating(ratee_id)
    ratee = _people({ratee_id}).get(ratee_id) or {}
    log_action(
        admin_id,
        "rating.delete",
        "rating",
        rating_id,
        ratee.get("display_name", ratee_id),
        f'Removed a {row.get("stars", "?")}-star rating',
    )
    return {"deleted": rating_id}


# ── accounts ───────────────────────────────────────────────────────────────


def _account_row(user) -> dict:
    deleted_at = getattr(user, "deleted_at", None)
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "school_year": user.school_year,
        "email_verified": user.email_verified,
        "rating_avg": user.rating_avg,
        "rating_count": user.rating_count,
        "posting_flagged": user.posting_flagged,
        "flag_reason": user.flag_reason,
        "bad_listing_streak": user.bad_listing_streak,
        "deleted_at": deleted_at.isoformat() if deleted_at else None,
    }


@router.get("/admin/users")
def list_all_users(
    response: Response,
    q: str | None = Query(default=None, max_length=120),
    deleted: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(require_admin),
):
    """Active accounts by default; `deleted=true` lists the closed ones the
    Deleted tab can restore."""
    needle = (q or "").strip()

    if db:
        query = db.table("users").select(USER_COLUMNS, count="exact")
        if deleted:
            query = query.not_.is_("deleted_at", "null")
        else:
            query = query.is_("deleted_at", "null")
        if needle:
            query = query.or_(f"email.ilike.*{needle}*,display_name.ilike.*{needle}*")
        res = query.order("display_name").range(offset, offset + limit - 1).execute()
        rows = res.data or []
        total = getattr(res, "count", None)
    else:
        rows = [
            _account_row(u)
            for u in users.values()
            if bool(getattr(u, "deleted_at", None)) == deleted
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


@router.patch("/admin/users/{user_id}/flag")
def set_user_flag(
    user_id: str,
    body: UserFlagUpdate,
    admin_id: str = Depends(require_admin),
):
    """Puts an account into review-only posting, or clears it. While flagged,
    every new listing waits in "pending" for an admin to approve it."""
    if user_id == admin_id and body.flagged:
        raise HTTPException(status_code=400, detail="You can't flag your own account")

    reason = body.reason.strip()
    fields: dict = {
        "posting_flagged": body.flagged,
        "flag_reason": reason if body.flagged else "",
    }
    if not body.flagged:
        fields["bad_listing_streak"] = 0

    if db:
        existing = db.table("users").select(USER_COLUMNS).eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="User not found")
        db.table("users").update(fields).eq("id", user_id).execute()
        row = {**existing.data[0], **fields}
    else:
        user = users.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.posting_flagged = body.flagged
        user.flag_reason = fields["flag_reason"]
        if not body.flagged:
            user.bad_listing_streak = 0
        row = _account_row(user)

    create_notification(
        user_id,
        (
            f"Your account is now under review ({reason}). New listings will wait"
            " for admin approval."
            if body.flagged
            else "Your account review is over. New listings go live normally again."
        ),
        email=False,
    )
    log_action(
        admin_id,
        "user.flag" if body.flagged else "user.unflag",
        "user",
        user_id,
        row.get("display_name", ""),
        f"Review reason: {reason}" if body.flagged else "Review flag cleared",
    )
    row["is_admin"] = is_admin_email(row.get("email"))
    row["listing_count"] = _listing_counts([user_id]).get(user_id, 0)
    return row


@router.delete("/admin/users/{user_id}")
def delete_any_user(user_id: str, admin_id: str = Depends(require_admin)):
    """Closes an account. This is a soft delete: the account can't sign in and
    its listings/requests disappear from the marketplace, but every row is
    kept so the Deleted tab can restore it. Blocked for the caller's own
    account so an admin can't lock themselves out mid-session."""
    if user_id == admin_id:
        raise HTTPException(
            status_code=400, detail="You can't close your own account from the admin panel"
        )

    now = _now_iso()
    if db:
        existing = (
            db.table("users")
            .select("id, display_name, email, deleted_at")
            .eq("id", user_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="User not found")
        user = existing.data[0]
        if user.get("deleted_at"):
            raise HTTPException(status_code=400, detail="This account is already closed")

        db.table("users").update({"deleted_at": now}).eq("id", user_id).execute()
        hidden_listings = len(
            db.table("listings")
            .select("id")
            .eq("seller_id", user_id)
            .is_("deleted_at", "null")
            .execute()
            .data
        )
        db.table("listings").update({"deleted_at": now}).eq("seller_id", user_id).is_(
            "deleted_at", "null"
        ).execute()
        hidden_requests = len(
            db.table("wanted_requests")
            .select("id")
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .execute()
            .data
        )
        db.table("wanted_requests").update({"deleted_at": now}).eq(
            "user_id", user_id
        ).is_("deleted_at", "null").execute()
        # Pending offers from a closed buyer would otherwise block a seller
        # from accepting anyone else.
        db.table("offers").update({"status": "cancelled"}).eq(
            "buyer_id", user_id
        ).eq("status", "pending").execute()
    else:
        user = users.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if getattr(user, "deleted_at", None):
            raise HTTPException(status_code=400, detail="This account is already closed")
        user.deleted_at = datetime.now(timezone.utc)
        hidden_listings = 0
        hidden_requests = 0
        for listing in listings.values():
            if listing.seller_id == user_id and getattr(listing, "deleted_at", None) is None:
                listing.deleted_at = user.deleted_at
                hidden_listings += 1
        for row in wanted_requests.values():
            if row.get("user_id") == user_id and not row.get("deleted_at"):
                row["deleted_at"] = now
                hidden_requests += 1
        for offer in offers.values():
            if offer.get("buyer_id") == user_id and offer.get("status") == "pending":
                offer["status"] = "cancelled"
        user_row = _account_row(user)

    display_name = user.get("display_name", "") if db else user_row["display_name"]
    log_action(
        admin_id,
        "user.delete",
        "user",
        user_id,
        display_name,
        f"Closed the account; hid {hidden_listings} listing(s) and {hidden_requests} request(s)",
    )
    broadcast("listings", "listing_changed", {})
    broadcast("requests", "request_changed", {})
    return {
        "deleted": user_id,
        "deleted_at": now,
        "listings_hidden": hidden_listings,
        "requests_hidden": hidden_requests,
    }


@router.post("/admin/users/{user_id}/restore")
def restore_user(user_id: str, admin_id: str = Depends(require_admin)):
    """Undoes a soft delete: the account can sign in again and its listings and
    requests reappear. Offers cancelled at close time are not reopened."""
    if db:
        existing = (
            db.table("users")
            .select(USER_COLUMNS)
            .eq("id", user_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="User not found")
        row = existing.data[0]
        if not row.get("deleted_at"):
            raise HTTPException(status_code=400, detail="This account isn't closed")

        db.table("users").update({"deleted_at": None}).eq("id", user_id).execute()
        db.table("listings").update({"deleted_at": None}).eq("seller_id", user_id).execute()
        db.table("wanted_requests").update({"deleted_at": None}).eq(
            "user_id", user_id
        ).execute()
        row["deleted_at"] = None
    else:
        user = users.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not getattr(user, "deleted_at", None):
            raise HTTPException(status_code=400, detail="This account isn't closed")
        user.deleted_at = None
        for listing in listings.values():
            if listing.seller_id == user_id:
                listing.deleted_at = None
        for request_row in wanted_requests.values():
            if request_row.get("user_id") == user_id:
                request_row.pop("deleted_at", None)
        row = _account_row(user)

    create_notification(
        user_id,
        "Your account was restored. Your listings are visible again.",
        email=False,
    )
    log_action(
        admin_id,
        "user.restore",
        "user",
        user_id,
        row.get("display_name", ""),
        "Account reopened",
    )
    row["is_admin"] = is_admin_email(row.get("email"))
    row["listing_count"] = _listing_counts([user_id]).get(user_id, 0)
    broadcast("listings", "listing_changed", {})
    broadcast("requests", "request_changed", {})
    return row


# ── audit log ──────────────────────────────────────────────────────────────


@router.get("/admin/audit")
def admin_audit(
    response: Response,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(require_admin),
):
    """Newest-first history of every admin action, with the moderator's email
    and the target's name — the record of why content or an account went."""
    rows, total = list_actions(q or "", limit, offset)
    response.headers["X-Total-Count"] = str(total)
    return rows
