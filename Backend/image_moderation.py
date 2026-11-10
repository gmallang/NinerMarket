"""Image screening against the marketplace Terms of Service.

Two optional providers, picked by whichever credentials are configured:

* **Sightengine** (`SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET`) is used
  when both are set. Its nudity + WAD models cover what a campus marketplace
  actually has to block in a *photo*: nudity, weapons, alcohol and drugs. That
  matters because OpenAI's moderation does not detect alcohol, weapons or drugs
  in images at all - a bottle of vodka is neither "sexual" nor "violent", so it
  passes that model untouched. Free plan, no card required.
* **OpenAI `omni-moderation-latest`** (`OPENAI_API_KEY`) is the fallback. Free
  and key-only, but image coverage is sexual content, violence, graphic
  violence and self-harm only.

With neither configured, screening is a no-op so local dev keeps working.

Both providers fail **open**: a timeout, bad key or rate limit logs a warning
and lets the photo through rather than blocking every upload in the app. Only a
confident hit blocks, because a false positive refuses a legitimate seller's
photo outright while a miss is what the report button and the admin panel
already exist for.

This is not a child-safety control. Suspected CSAM must be treated as an
incident to preserve and report to the authorities, not as something this
module can catch; do not send suspected material to these providers.
"""

import json
import logging
import os
import uuid
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger("uvicorn.error")

# ── OpenAI fallback ────────────────────────────────────────────────────────
OPENAI_URL = "https://api.openai.com/v1/moderations"
OPENAI_DEFAULT_MODEL = "omni-moderation-latest"

# OpenAI's own per-category thresholds decide `flagged`, so this module just
# reads the booleans. That is deliberate: they are calibrated and updated with
# the model, whereas a hand-tuned score cutoff here would drift.
OPENAI_CATEGORY_LABELS: dict[str, str] = {
    "sexual": "nudity or sexual content",
    "violence": "violence or injury",
    "violence/graphic": "graphic violence",
    "self-harm": "self-harm content",
    "self-harm/instructions": "self-harm content",
    "self-harm/intent": "self-harm content",
}

# ── Sightengine (default when configured) ─────────────────────────────────
SIGHTENGINE_URL = "https://api.sightengine.com/1.0/check.json"
SIGHTENGINE_MODELS = "nudity-2.1,wad"
# Sightengine reports a 0-1 confidence per category. 0.5 errs toward letting a
# borderline product shot through; the report button and admin panel catch the
# rest. Raise it if legitimate photos start getting refused.
SIGHTENGINE_THRESHOLD = 0.5

TERMS_HINT = (
    "Listing photos must follow the NinerMarket Terms: no weapons, drugs, "
    "alcohol, nudity or graphic violence."
)


class ImageRejected(Exception):
    """A photo that is confidently against the Terms. Carries the reasons so the
    API can tell the seller which rule it broke instead of a generic failure."""

    def __init__(self, reasons: list[str]):
        self.reasons = reasons
        super().__init__(
            f"This photo can't be posted: {', '.join(reasons)}. {TERMS_HINT}"
        )


# ── provider selection ────────────────────────────────────────────────────


def _openai_key() -> str:
    return os.getenv("OPENAI_API_KEY", "").strip()


def _sightengine_credentials() -> tuple[str, str]:
    return (
        os.getenv("SIGHTENGINE_API_USER", "").strip(),
        os.getenv("SIGHTENGINE_API_SECRET", "").strip(),
    )


# ── OpenAI ────────────────────────────────────────────────────────────────


def _openai_reasons(result: dict) -> list[str]:
    """Maps a moderation result onto seller-facing Terms labels.

    `categories` holds booleans (and `null` for categories that don't apply to
    the input type), so only an explicit `True` counts. Labels are deduped
    because the three self-harm entries share one."""
    categories = result.get("categories") or {}
    reasons: list[str] = []
    for category, label in OPENAI_CATEGORY_LABELS.items():
        if categories.get(category) is True and label not in reasons:
            reasons.append(label)
    return reasons


def _openai_check(raw: bytes, content_type: str, api_key: str) -> dict | None:
    """One moderation call. Returns the single result object, or None (and
    logs) on any failure - a bad key, a rate limit and a provider outage all
    resolve to "couldn't tell", which the caller treats as allowed."""
    import base64

    model = os.getenv("OPENAI_MODERATION_MODEL", "").strip() or OPENAI_DEFAULT_MODEL
    data_url = f"data:{content_type};base64,{base64.b64encode(raw).decode('ascii')}"
    body = json.dumps(
        {
            "model": model,
            "input": [{"type": "image_url", "image_url": {"url": data_url}}],
        }
    ).encode()

    request = Request(
        OPENAI_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=6) as response:
            payload = json.loads(response.read())
    except HTTPError as exc:
        logger.warning("image moderation HTTP %s: %s", exc.code, exc.reason)
        return None
    except (URLError, TimeoutError):
        logger.exception("image moderation request failed")
        return None
    except ValueError:
        logger.warning("image moderation returned non-JSON")
        return None

    results = payload.get("results") if isinstance(payload, dict) else None
    if not results or not isinstance(results[0], dict):
        logger.warning("image moderation returned no results")
        return None
    return results[0]


# ── Sightengine ───────────────────────────────────────────────────────────


def _multipart(
    fields: dict[str, str], file_field: str, filename: str, data: bytes, content_type: str
) -> tuple[bytes, str]:
    boundary = f"----NinerMarket{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n".encode()
        )
    chunks.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; '
        f'filename="{filename}"\r\nContent-Type: {content_type}\r\n\r\n'.encode()
    )
    chunks.append(data)
    chunks.append(f"\r\n--{boundary}--\r\n".encode())
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def _probability(block) -> float:
    """Reads Sightengine's `{prob: 0..1}` block, treating junk as zero."""
    try:
        return float((block or {}).get("prob") or 0)
    except (TypeError, ValueError):
        return 0.0


def _sightengine_reasons(payload: dict) -> list[str]:
    """Maps a Sightengine `nudity-2.1` + `wad` response onto Terms labels."""
    threshold = SIGHTENGINE_THRESHOLD
    reasons: list[str] = []

    nudity = payload.get("nudity") or {}
    explicit = max(
        _probability({"prob": nudity.get(key)})
        for key in ("sexual_activity", "sexual_display", "erotica")
    )
    if explicit >= threshold:
        reasons.append("nudity or sexual content")
    if _probability(payload.get("weapon")) >= threshold:
        reasons.append("weapons")
    if _probability(payload.get("alcohol")) >= threshold:
        reasons.append("alcohol")
    if _probability(payload.get("drugs")) >= threshold:
        reasons.append("drugs or drug paraphernalia")
    return reasons


def _sightengine_check(
    raw: bytes, content_type: str, api_user: str, api_secret: str
) -> dict | None:
    """One Sightengine call, returning the raw success payload or None."""
    body, content_type_header = _multipart(
        {
            "models": SIGHTENGINE_MODELS,
            "api_user": api_user,
            "api_secret": api_secret,
        },
        "media",
        "photo",
        raw,
        content_type,
    )
    request = Request(
        SIGHTENGINE_URL,
        data=body,
        headers={
            "Content-Type": content_type_header,
            "User-Agent": "NinerMarket/1.0",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read())
    except HTTPError as exc:
        logger.warning("sightengine moderation HTTP %s: %s", exc.code, exc.reason)
        return None
    except (URLError, TimeoutError):
        logger.exception("sightengine moderation request failed")
        return None
    except ValueError:
        logger.warning("sightengine moderation returned non-JSON")
        return None

    if not isinstance(payload, dict) or payload.get("status") != "success":
        logger.warning("sightengine moderation failed: %s", (payload or {}).get("error"))
        return None
    return payload


# ── public API ────────────────────────────────────────────────────────────


def find_image_violations(raw: bytes, content_type: str) -> list[str]:
    """Terms categories this image appears to violate, or `[]` when it looks
    clean, screening isn't configured, or the provider couldn't be reached."""
    api_user, api_secret = _sightengine_credentials()
    if api_user and api_secret:
        payload = _sightengine_check(raw, content_type, api_user, api_secret)
        return _sightengine_reasons(payload) if payload else []

    api_key = _openai_key()
    if not api_key:
        return []
    result = _openai_check(raw, content_type, api_key)
    return _openai_reasons(result) if result else []


def screen_image(raw: bytes, content_type: str) -> None:
    """Raises ImageRejected when a photo is confidently against the Terms.
    Called before anything is written to storage, so a blocked image is never
    uploaded anywhere."""
    reasons = find_image_violations(raw, content_type)
    if reasons:
        raise ImageRejected(reasons)
