import hashlib
import hmac
import json
import os
import random
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen

PBKDF2_ITERATIONS = 600_000
CODE_TTL_MINUTES = 15


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


def send_verification_email(to: str, code: str) -> bool:
    """Sends the 6-digit code via Resend. Returns True when delivered."""
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        return False

    payload = json.dumps(
        {
            "from": "NinerMarket <onboarding@resend.dev>",
            "to": [to],
            "subject": "Your NinerMarket verification code",
            "html": (
                "<div style=\"font-family:Arial,sans-serif;color:#0b2418\">"
                "<h2>Verify your NinerMarket account</h2>"
                f"<p>Your verification code is:</p>"
                f"<p style=\"font-size:32px;font-weight:700;letter-spacing:4px\">{code}</p>"
                "<p>Enter this code to finish setting up your account. It expires in 15 minutes.</p>"
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
