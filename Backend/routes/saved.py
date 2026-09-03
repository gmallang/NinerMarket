from fastapi import APIRouter, Depends, HTTPException

from auth import require_user
from database import db, listings, saved

router = APIRouter()


def _saved_ids(user_id: str) -> list[str]:
    """Returns the listing ids the user has saved. In-memory saved is a dict of
    user_id -> set of ids; Supabase stores one row per (user, listing) pair."""
    if db:
        rows = db.table("saved_listings").select("listing_id").eq("user_id", user_id).execute()
        return [r["listing_id"] for r in rows.data]
    return sorted(saved.get(user_id, set()))


def _toggle(user_id: str, listing_id: str, should_save: bool) -> list[str]:
    """Ensures the listing is either saved (True) or not saved (False) for the
    user, returning the resulting full list of saved ids. Idempotent — saving
    something already saved (or unsaving something absent) is a no-op."""
    if db:
        existing = (
            db.table("saved_listings")
            .select("user_id")
            .eq("user_id", user_id)
            .eq("listing_id", listing_id)
            .execute()
        )
        present = bool(existing.data)
        if should_save and not present:
            db.table("saved_listings").insert(
                {"user_id": user_id, "listing_id": listing_id}
            ).execute()
        elif not should_save and present:
            db.table("saved_listings").delete().eq("user_id", user_id).eq(
                "listing_id", listing_id
            ).execute()
        return _saved_ids(user_id)

    ids = saved.setdefault(user_id, set())
    if should_save:
        ids.add(listing_id)
    else:
        ids.discard(listing_id)
    return sorted(ids)


@router.get("/users/{user_id}/saved")
def list_saved(user_id: str, caller_id: str = Depends(require_user)):
    """Returns the ids of everything the user has saved, newest-first by save
    order. Only the account owner can read their own saved list."""
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only view your own saved items")
    return _saved_ids(user_id)


@router.post("/users/{user_id}/saved")
def save_listing(user_id: str, body: dict, caller_id: str = Depends(require_user)):
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only save items for yourself")
    listing_id = body.get("listing_id") or ""
    if not listing_id:
        raise HTTPException(status_code=400, detail="listing_id is required")

    exists = listings.get(listing_id) if not db else None
    if db:
        res = db.table("listings").select("id").eq("id", listing_id).execute()
        found = bool(res.data)
    else:
        found = exists is not None
    if not found:
        raise HTTPException(status_code=404, detail="Listing not found")

    return _toggle(user_id, listing_id, True)


@router.delete("/users/{user_id}/saved/{listing_id}")
def unsave_listing(user_id: str, listing_id: str, caller_id: str = Depends(require_user)):
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only unsave items for yourself")
    return _toggle(user_id, listing_id, False)


@router.put("/users/{user_id}/saved")
def replace_saved(user_id: str, body: dict, caller_id: str = Depends(require_user)):
    """Replaces the full saved set, used to sync a client's local (previously
    localStorage-backed) saved ids up to the server on first login."""
    if caller_id != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own saved items")
    ids = {i for i in (body.get("listing_ids") or []) if isinstance(i, str)}
    if db:
        db.table("saved_listings").delete().eq("user_id", user_id).execute()
        if ids:
            db.table("saved_listings").insert(
                [{"user_id": user_id, "listing_id": i} for i in ids]
            ).execute()
        return _saved_ids(user_id)
    saved[user_id] = set(ids)
    return sorted(ids)
