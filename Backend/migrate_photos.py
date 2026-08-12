"""One-time migration: re-upload any base64 data-URL photos that are stored
directly in the listings table up to Supabase Storage, then replace them with
the resulting public URLs.

Base64 photos embedded in JSON bloat every listings response by ~33%, can't be
cached by the browser or a CDN, and must fully arrive before they render —
the classic source of slow mobile load. This script makes the stored data
self-consistent with the normal upload flow (SellForm -> /photos -> Storage URL).

Safe to run repeatedly: rows whose photos are already URLs are left untouched.

Usage (from the Backend/ directory):
    python migrate_photos.py
"""

import sys

from database import db
from storage import upload_photo


def main() -> int:
    if not db:
        print("Supabase is not configured (no SUPABASE_URL / SUPABASE_KEY).")
        print("Nothing to migrate — local dev stores photos in memory only.")
        return 1

    rows = db.table("listings").select("id", "seller_id", "photos").execute().data

    migrated = 0
    failed = 0
    for row in rows:
        photos = row.get("photos") or []
        data_urls = [p for p in photos if isinstance(p, str) and p.startswith("data:image/")]
        if not data_urls:
            continue

        new_photos = []
        for photo in photos:
            if not (isinstance(photo, str) and photo.startswith("data:image/")):
                new_photos.append(photo)
                continue
            try:
                url = upload_photo(row.get("seller_id") or "migration", photo)
            except Exception as exc:  # noqa: BLE001 — report and continue
                print(f"  listing {row['id']}: failed to upload photo: {exc}")
                failed += 1
                new_photos.append(photo)
                continue
            new_photos.append(url)

        db.table("listings").update({"photos": new_photos}).eq("id", row["id"]).execute()
        migrated += 1
        print(f"  listing {row['id']}: migrated {len(data_urls)} photo(s)")

    print(f"\nDone. {migrated} listing(s) migrated, {failed} upload(s) failed.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
