from datetime import datetime
import logging
import os
from urllib.parse import quote

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from auth import (
    code_expiry,
    code_is_valid,
    create_session_token,
    generate_code,
    hash_password,
    make_user_id,
    require_user,
    send_verification_email,
    verify_google_id_token,
    verify_password,
    verify_session_token,
)
from database import db, listings, users
from models import (
    GoogleLoginRequest,
    LoginRequest,
    ResendRequest,
    SetPasswordRequest,
    User,
    UserCreate,
    UserPublic,
    VerifyRequest,
)
from ratelimit import client_ip, rate_limit
from routes.listings import SELLER_COLUMNS, _with_seller

router = APIRouter()


def _to_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        school_year=user.school_year,
        payment_methods=user.payment_methods,
        rating_avg=user.rating_avg,
        rating_count=user.rating_count,
        email_verified=user.email_verified,
        has_password=bool(user.password_hash),
    )


def _find_by_email(email: str) -> User | None:
    return next((u for u in users.values() if u.email == email), None)


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def _row_to_user(row: dict) -> User:
    expires = row.get("verification_expires")
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires.replace("Z", "+00:00"))
    return User(
        id=row["id"],
        email=row.get("email", ""),
        display_name=row.get("display_name", ""),
        school_year=row.get("school_year", ""),
        payment_methods=row.get("payment_methods") or [],
        rating_avg=row.get("rating_avg", 0.0),
        rating_count=row.get("rating_count", 0),
        password_hash=row.get("password_hash", ""),
        email_verified=row.get("email_verified", False),
        verification_code=row.get("verification_code", ""),
        verification_expires=expires,
    )


def _find_user(email: str) -> User | None:
    email = email.strip().lower()
    if db:
        res = db.table("users").select("*").eq("email", email).execute()
        return _row_to_user(res.data[0]) if res.data else None
    return _find_by_email(email)


def _save_user(user: User) -> User:
    if db:
        db.table("users").upsert(user.model_dump(mode="json")).execute()
    else:
        users[user.id] = user
    return user


@router.post("/users")
def create_user(body: UserCreate):
    email = body.email.strip().lower()
    if not email.endswith("@charlotte.edu"):
        raise HTTPException(status_code=400, detail="Must use a .charlotte.edu email")

    if db:
        by_email = db.table("users").select("id").eq("email", email).execute()
        by_id = db.table("users").select("id").eq("id", body.id).execute()
        if by_email.data or by_id.data:
            raise HTTPException(status_code=409, detail="User already exists")
    elif body.id in users or _find_by_email(email):
        raise HTTPException(status_code=409, detail="User already exists")

    code = generate_code()
    user = User(
        id=body.id,
        email=email,
        display_name=body.display_name.strip(),
        school_year=body.school_year,
        payment_methods=body.payment_methods,
        password_hash=hash_password(body.password),
        email_verified=False,
        verification_code=code,
        verification_expires=code_expiry(),
    )
    _save_user(user)

    send_verification_email(email, code)
    return {"user": _to_public(user)}


@router.post("/users/verify")
def verify_user(body: VerifyRequest, request: Request):
    email = body.email.strip().lower()
    rate_limit(f"verify:{client_ip(request)}", max_attempts=15, window_seconds=15 * 60)
    rate_limit(f"verify:{email}", max_attempts=8, window_seconds=15 * 60)

    user = _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.email_verified:
        return {"user": _to_public(user), "token": create_session_token(user.id)}
    if not code_is_valid(body.code, user.verification_code, user.verification_expires):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    user.email_verified = True
    user.verification_code = ""
    user.verification_expires = None
    _save_user(user)
    return {"user": _to_public(user), "token": create_session_token(user.id)}


@router.post("/users/resend")
def resend_code(body: ResendRequest, request: Request):
    email = body.email.strip().lower()
    rate_limit(f"resend:{client_ip(request)}", max_attempts=10, window_seconds=15 * 60)
    rate_limit(f"resend:{email}", max_attempts=3, window_seconds=15 * 60)

    user = _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.email_verified:
        return _to_public(user)

    code = generate_code()
    user.verification_code = code
    user.verification_expires = code_expiry()
    _save_user(user)
    send_verification_email(email, code)
    return {"user": _to_public(user)}


@router.post("/users/login")
def login(body: LoginRequest, request: Request):
    email = body.email.strip().lower()
    rate_limit(f"login:{client_ip(request)}", max_attempts=20, window_seconds=15 * 60)
    rate_limit(f"login:{email}", max_attempts=6, window_seconds=15 * 60)

    user = _find_user(email)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email or password")
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Email not verified")
    return {"user": _to_public(user), "token": create_session_token(user.id)}


@router.post("/users/google")
def google_login(body: GoogleLoginRequest, request: Request):
    """Signs in with a Google ID token. The token must be cryptographically
    signed by Google and belong to a verified @charlotte.edu account."""
    import logging

    logger = logging.getLogger("uvicorn.error")
    rate_limit(f"google:{client_ip(request)}", max_attempts=30, window_seconds=15 * 60)
    logger.info(
        "google_login: client_id=%s token_len=%s",
        os.getenv("GOOGLE_CLIENT_ID", "")[:12] or "(unset)",
        len(body.id_token),
    )
    try:
        info = verify_google_id_token(body.id_token)
    except ValueError as exc:
        logger.warning("google_login: token rejected: %s", exc)
        raise HTTPException(status_code=401, detail=f"Invalid or expired Google session: {exc}")
    except Exception as exc:
        logger.exception("google_login: unexpected failure")
        raise HTTPException(
            status_code=500,
            detail=f"Google verification failed ({type(exc).__name__}): {exc}",
        )

    email = (info.get("email") or "").strip().lower()
    if not email.endswith("@charlotte.edu"):
        raise HTTPException(
            status_code=403, detail="NinerMarket is for @charlotte.edu accounts only"
        )
    if not info.get("email_verified"):
        raise HTTPException(status_code=403, detail="Your Google email is not verified")

    user = _find_user(email)
    if user:
        user.email_verified = True
        user.display_name = user.display_name or (info.get("name") or email.split("@")[0])
        _save_user(user)
        return {"user": _to_public(user), "token": create_session_token(user.id)}

    created = User(
        id=make_user_id(email),
        email=email,
        display_name=(info.get("name") or email.split("@")[0]).strip(),
        email_verified=True,
    )
    _save_user(created)
    return {"user": _to_public(created), "token": create_session_token(created.id)}


@router.post("/users/google/callback")
async def google_callback(request: Request):
    """Handles Google's redirect-mode login_uri POST. Google sends the ID token
    as application/x-www-form-urlencoded (field `credential`); we verify it,
    sign the user in, and bounce the browser back to the frontend with a fresh
    session token in the URL fragment. The fragment never travels to a server."""
    logger = logging.getLogger("uvicorn.error")
    rate_limit(f"google:{client_ip(request)}", max_attempts=30, window_seconds=15 * 60)
    form = await request.form()
    credential = (form.get("credential") or "").strip()

    def _back(suffix: str) -> RedirectResponse:
        return RedirectResponse(f"{_frontend_url()}/login#{suffix}", status_code=302)

    if not credential:
        return _back("nm_error=missing_credential")

    try:
        info = verify_google_id_token(credential)
    except Exception as exc:
        logger.warning("google_callback: token rejected: %s", exc)
        return _back(f"nm_error={quote(str(exc))}")

    email = (info.get("email") or "").strip().lower()
    if not email.endswith("@charlotte.edu"):
        return _back("nm_error=not-a-charlotte-email")
    if not info.get("email_verified"):
        return _back("nm_error=email-not-verified")

    user = _find_user(email)
    if user:
        user.email_verified = True
        user.display_name = user.display_name or (info.get("name") or email.split("@")[0])
        _save_user(user)
    else:
        user = User(
            id=make_user_id(email),
            email=email,
            display_name=(info.get("name") or email.split("@")[0]).strip(),
            email_verified=True,
        )
        _save_user(user)

    return _back(f"nm_token={create_session_token(user.id)}")


@router.post("/users/password")
def set_password(body: SetPasswordRequest, authorization: str | None = Header(default=None)):
    """Sets a password on an existing account so the user can also sign in with
    email + password. Authenticates via a fresh Google ID token (popup flow) or
    an active session token (redirect flow)."""
    logger = logging.getLogger("uvicorn.error")
    if body.id_token:
        try:
            info = verify_google_id_token(body.id_token)
        except ValueError as exc:
            logger.warning("set_password: token rejected: %s", exc)
            raise HTTPException(status_code=401, detail="Invalid or expired Google session")
        except Exception as exc:
            logger.exception("set_password: unexpected failure")
            raise HTTPException(
                status_code=500,
                detail=f"Google verification failed ({type(exc).__name__}): {exc}",
            )

        email = (info.get("email") or "").strip().lower()
        if not email.endswith("@charlotte.edu"):
            raise HTTPException(
                status_code=403, detail="NinerMarket is for @charlotte.edu accounts only"
            )
    else:
        user_id = None
        if authorization and authorization.startswith("Bearer "):
            user_id = verify_session_token(authorization.removeprefix("Bearer ").strip())
        if not user_id:
            raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        email = user.email

    user = _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(body.password)
    _save_user(user)
    return _to_public(user)


def get_user_by_id(id: str) -> User | None:
    """Internal lookup returning the full User model. Never expose this directly
    to the client — use _to_public()."""
    if db:
        data = db.table("users").select("*").eq("id", id).execute()
        return _row_to_user(data.data[0]) if data.data else None
    return users.get(id)


@router.get("/users/me")
def me(user_id: str = Depends(require_user)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _to_public(user)


@router.get("/users/{id}")
def get_user(id: str):
    user = get_user_by_id(id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _to_public(user)


@router.patch("/users/{id}")
def update_user(id: str, updates: dict, caller_id: str = Depends(require_user)):
    if caller_id != id:
        raise HTTPException(status_code=403, detail="You can only edit your own profile")

    allowed = {"display_name", "school_year", "payment_methods"}
    clean = {k: v for k, v in updates.items() if k in allowed}

    if db:
        existing = db.table("users").select("id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="User not found")
        updated = db.table("users").update(clean).eq("id", id).execute()
        return _to_public(_row_to_user(updated.data[0]))

    if id not in users:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in clean.items():
        setattr(users[id], key, value)
    return _to_public(users[id])


@router.get("/users/{id}/listings")
def get_user_listings(id: str, status: str | None = Query(default=None)):
    if db:
        query = db.table("listings").select("*").eq("seller_id", id)
        if status:
            query = query.eq("status", status)
        rows = query.execute().data

        seller = None
        sres = db.table("users").select(SELLER_COLUMNS).eq("id", id).execute()
        if sres.data:
            seller = sres.data[0]
        for row in rows:
            row["seller"] = seller
        return rows

    results = [l for l in listings.values() if l.seller_id == id]
    if status:
        results = [l for l in results if l.status == status]
    return [_with_seller(l) for l in results]
