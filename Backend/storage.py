import base64
import io
import mimetypes
import uuid

from database import db

BUCKET = "listing-photos"
MAX_BYTES = 6 * 1024 * 1024  # frontend already caps original files at 5MB; this is headroom
ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

THUMB_MAX_DIMENSION = 400
THUMB_QUALITY = 72
# Long-lived cache so browsers/CDNs reuse photos instead of re-downloading them
# on every visit (Supabase's default object cache is only 1 hour).
CACHE_CONTROL = "public, max-age=31536000, immutable"

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


def _make_thumb(raw: bytes) -> tuple[bytes, str] | None:
    """Downscales an image to a small WebP thumbnail (longest edge <= 400px).

    Returns (bytes, mime-type), or None when Pillow can't process the image
    (e.g. animated GIFs, which we pass through untouched). WebP keeps alpha
    for PNGs and is far smaller than JPEG for photo tiles."""
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(raw))
        if getattr(img, "format", "").upper() == "GIF":
            return None
        img.thumbnail((THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION))
        if img.mode in ("RGBA", "LA", "PA"):
            has_alpha = True
        elif img.mode == "P" and "transparency" in img.info:
            has_alpha = True
        else:
            has_alpha = False
        img = img.convert("RGBA" if has_alpha else "RGB")
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=THUMB_QUALITY)
        return buf.getvalue(), "image/webp"
    except Exception:
        # Pillow missing or the format is unsupported — degrade gracefully.
        return None


def _put(path: str, raw: bytes, content_type: str) -> str:
    db.storage.from_(BUCKET).upload(
        path,
        raw,
        {
            "content-type": content_type,
            "cache-control": CACHE_CONTROL,
        },
    )
    return db.storage.from_(BUCKET).get_public_url(path)


def upload_photo(user_id: str, data_url: str) -> dict:
    """Decodes a `data:image/...;base64,...` URL and uploads it to Supabase
    Storage as a WebP-friendly master plus a small generated thumbnail,
    returning `{"url", "thumb_url"}`. Falls back to returning the original
    data URL unchanged (for both fields) when Supabase isn't configured
    (local dev)."""
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
        return {"url": data_url, "thumb_url": data_url}

    _ensure_bucket()
    ext = mimetypes.guess_extension(content_type) or ".jpg"
    url = _put(f"{user_id}/{uuid.uuid4()}{ext}", raw, content_type)

    thumb_url = url
    thumb = _make_thumb(raw)
    if thumb:
        thumb_bytes, thumb_mime = thumb
        thumb_url = _put(f"{user_id}/{uuid.uuid4()}.webp", thumb_bytes, thumb_mime)

    return {"url": url, "thumb_url": thumb_url}


def ensure_photo_url(user_id: str, photo: str) -> dict:
    """Returns a photo as `{"url", "thumb_url"}` pairs, uploading base64
    data-URL photos on the way. Regular URLs pass through unchanged (with the
    URL standing in for the thumb), so base64 blobs never end up persisted in
    the listings table."""
    if photo.startswith("data:image/"):
        return upload_photo(user_id, photo)
    return {"url": photo, "thumb_url": photo}
