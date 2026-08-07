from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from auth import (
    code_expiry,
    code_is_valid,
    generate_code,
    hash_password,
    send_verification_email,
    verify_password,
)
from database import db, listings, users
from models import (
    LoginRequest,
    ResendRequest,
    User,
    UserCreate,
    UserPublic,
    VerifyRequest,
)
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
    )


def _find_by_email(email: str) -> User | None:
    return next((u for u in users.values() if u.email == email), None)


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

    dev_code = "" if send_verification_email(email, code) else code
    return {"user": _to_public(user), "dev_code": dev_code}


@router.post("/users/verify")
def verify_user(body: VerifyRequest):
    email = body.email.strip().lower()
    user = _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.email_verified:
        return _to_public(user)
    if not code_is_valid(body.code, user.verification_code, user.verification_expires):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    user.email_verified = True
    user.verification_code = ""
    user.verification_expires = None
    _save_user(user)
    return _to_public(user)


@router.post("/users/resend")
def resend_code(body: ResendRequest):
    email = body.email.strip().lower()
    user = _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.email_verified:
        return _to_public(user)

    code = generate_code()
    user.verification_code = code
    user.verification_expires = code_expiry()
    _save_user(user)
    dev_code = "" if send_verification_email(email, code) else code
    return {"user": _to_public(user), "dev_code": dev_code}


@router.post("/users/login")
def login(body: LoginRequest):
    email = body.email.strip().lower()
    user = _find_user(email)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email or password")
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Email not verified")
    return _to_public(user)


@router.get("/users/{id}")
def get_user(id: str):
    if db:
        data = db.table("users").select("*").eq("id", id).execute()
        if not data.data:
            raise HTTPException(status_code=404, detail="User not found")
        return _to_public(_row_to_user(data.data[0]))

    if id not in users:
        raise HTTPException(status_code=404, detail="User not found")
    return _to_public(users[id])


@router.patch("/users/{id}")
def update_user(id: str, updates: dict):
    allowed = {"display_name", "school_year", "payment_methods", "email_verified"}
    clean = {k: v for k, v in updates.items() if k in allowed}

    if db:
        existing = db.table("users").select("id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="User not found")
        db.table("users").update(clean).eq("id", id).execute()
        updated = db.table("users").select("*").eq("id", id).execute().data[0]
        return _to_public(_row_to_user(updated))

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
