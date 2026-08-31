import hashlib
import hmac
import json
import os
import random
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen

from fastapi import Header, HTTPException

PBKDF2_ITERATIONS = 600_000
CODE_TTL_MINUTES = 15
SESSION_TTL_DAYS = 30

_session_secret: str | None = None


def _get_session_secret() -> str:
    """Lazily reads SESSION_SECRET on first use rather than at import time.
    Some modules import this one before database.py runs load_dotenv(), so
    reading os.getenv() at module load could lock in a value from before
    .env was ever loaded, silently ignoring whatever's actually configured.
    Deferring the read until a token is actually created/verified — which
    only happens once every import has finished — avoids that entirely."""
    global _session_secret
    if _session_secret is None:
        secret = os.getenv("SESSION_SECRET")
        if not secret:
            # Fallback for any environment — regenerating this on every
            # restart just means existing sessions get invalidated, which is
            # a minor cost compared to the app failing to boot.
            secret = secrets.token_hex(32)
        _session_secret = secret
    return _session_secret


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt, digest = stored.split("$")
        if scheme != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iterations)
        ).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, AttributeError):
        return False


def create_session_token(user_id: str) -> str:
    """Issues a signed, stateless session token for user_id. Callers present this
    as `Authorization: Bearer <token>` on every subsequent request; verify_session_token
    is what actually authenticates them — nothing else does."""
    expires_at = int((datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)).timestamp())
    payload = f"{user_id}.{expires_at}"
    signature = hmac.new(_get_session_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def verify_session_token(token: str) -> str | None:
    """Returns the user_id embedded in a valid, unexpired token, or None."""
    try:
        user_id, expires_at, signature = token.rsplit(".", 2)
    except ValueError:
        return None
    payload = f"{user_id}.{expires_at}"
    expected = hmac.new(_get_session_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        if int(expires_at) < int(datetime.now(timezone.utc).timestamp()):
            return None
    except ValueError:
        return None
    return user_id


def require_user(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency: extracts and verifies the bearer session token,
    returning the authenticated user's id. Routes that mutate a specific user's
    data must depend on this and check the returned id against the resource
    they're touching — this only proves who's calling, not what they're allowed to touch."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    user_id = verify_session_token(authorization.removeprefix("Bearer ").strip())
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user_id


def generate_code() -> str:
    return f"{random.randint(0, 999_999):06d}"


def code_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES)


def code_is_valid(code: str, stored: str, expires: datetime | None) -> bool:
    if not stored or not expires:
        return False
    if datetime.now(timezone.utc) > expires:
        return False
    return hmac.compare_digest(code.strip(), stored)


def send_verification_email(
    to: str, code: str, subject: str | None = None, intro: str | None = None
) -> bool:
    """Sends a 6-digit code via Resend. Returns True when delivered."""
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        return False

    subject = subject or "Your NinerMarket verification code"
    intro = intro or "Enter this code to finish setting up your account. It expires in 15 minutes."

    payload = json.dumps(
        {
            "from": os.getenv("EMAIL_FROM", "NinerMarket <onboarding@resend.dev>"),
            "to": [to],
            "subject": subject,
            "html": (
                "<div style=\"font-family:Arial,sans-serif;color:#0b2418\">"
                "<h2>NinerMarket</h2>"
                f"<p style=\"font-size:18px;background:#e8f5e9;padding:16px;border-radius:8px\">{intro}</p>"
                f"<p style=\"font-size:32px;font-weight:700;letter-spacing:4px\">{code}</p>"
                "<p>If you didn't request this, you can safely ignore this email.</p>"
                "</div>"
            ),
        }
    ).encode()
    req = Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "NinerMarket/1.0",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except Exception:
        return False


def make_user_id(email: str) -> str:
    """Derives a stable user id from an email, matching the frontend helper."""
    local = email.split("@")[0].lower()
    parts = [p for p in re.split(r"[^a-z0-9]+", local) if p]
    slug = "-".join(parts).strip("-")
    return f"u-{slug}"


def verify_google_id_token(id_token: str) -> dict:
    """Verifies a Google ID token and returns its claims.

    Raises ValueError when the token is invalid, expired, or signed for a
    different audience. Certificates are fetched and cached by google-auth.
    """
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    if not client_id:
        raise ValueError("GOOGLE_CLIENT_ID is not configured")

    info = google_id_token.verify_oauth2_token(
        id_token, google_requests.Request(), client_id
    )
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Invalid token issuer")
    return info

