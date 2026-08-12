import base64
import mimetypes
import uuid

from database import db

BUCKET = "listing-photos"
MAX_BYTES = 6 * 1024 * 1024  # frontend already caps original files at 5MB; this is headroom
ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

_bucket_ready = False


def _ensure_bucket() -> None:
    global _bucket_ready
    if _bucket_ready:
        return
    existing = {b.id for b in db.storage.list_buckets()}
    if BUCKET not in existing:
        db.storage.create_bucket(
            BUCKET,
            options={
                "public": True,
                "file_size_limit": MAX_BYTES,
                "allowed_mime_types": ALLOWED_MIME_TYPES,
            },
        )
    _bucket_ready = True


def upload_photo(user_id: str, data_url: str) -> str:
    """Decodes a `data:image/...;base64,...` URL and uploads it to Supabase
    Storage, returning a public URL. Falls back to returning the original data
    URL unchanged when Supabase isn't configured (local dev)."""
    if not data_url.startswith("data:image/"):
        raise ValueError("Only image uploads are allowed")

    header, _, encoded = data_url.partition(",")
    content_type = header[len("data:") :].split(";")[0]
    if content_type not in ALLOWED_MIME_TYPES:
        raise ValueError("Unsupported image type")

    try:
        raw = base64.b64decode(encoded)
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid image data") from exc
    if len(raw) > MAX_BYTES:
        raise ValueError("Image is too large")

    if not db:
        return data_url

    _ensure_bucket()
    ext = mimetypes.guess_extension(content_type) or ".jpg"
    path = f"{user_id}/{uuid.uuid4()}{ext}"
    db.storage.from_(BUCKET).upload(path, raw, {"content-type": content_type})
    return db.storage.from_(BUCKET).get_public_url(path)


def ensure_photo_url(user_id: str, photo: str) -> str:
    """Returns a photo as a storage URL, uploading base64 data-URL photos on
    the way. Regular URLs (and the local-dev fallback) pass through unchanged,
    so base64 blobs never end up persisted in the listings table."""
    if photo.startswith("data:image/"):
        return upload_photo(user_id, photo)
    return photo
