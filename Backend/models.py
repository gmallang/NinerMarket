from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, Field

ShortStr = Annotated[str, Field(max_length=60)]
PhotoUrl = Annotated[str, Field(max_length=2000)]
# A sanity ceiling, not a business rule - high enough for a legitimate pricey
# item (furniture sets, a used car) and low enough to catch the obviously-
# wrong price a typo or a spam listing tends to produce (e.g. the $150,000
# "car" that had to be removed by hand).
PRICE_MAX = 50_000


# A generous cap, not a strict format check - the handler already validates
# the @charlotte.edu suffix; this just stops someone POSTing a multi-KB
# string into a field that's stored, indexed, and emailed to.
_EMAIL_MAX = 254


class User(BaseModel):
    id: str
    email: str
    display_name: str
    school_year: str = ""
    payment_methods: list[str] = []
    rating_avg: float = 0.0
    rating_count: int = 0
    password_hash: str = ""
    email_verified: bool = False
    verification_code: str = ""
    verification_expires: datetime | None = None
    password_reset_code: str = ""
    password_reset_expires: datetime | None = None
    # Set automatically after three consecutive listings need moderator action,
    # or by an admin. While true, every new listing starts as "pending" and
    # waits for admin approval before it is visible to other students.
    posting_flagged: bool = False
    flag_reason: str = ""
    bad_listing_streak: int = 0
    # Soft delete: set when an admin closes the account. The row (and every
    # child row) stays put so the account can be restored.
    deleted_at: datetime | None = None


class UserFlagUpdate(BaseModel):
    """Admin toggle for review-only posting. `reason` is shown to the seller
    and in the admin panel; it is ignored when clearing the flag."""

    flagged: bool
    reason: str = Field(default="", max_length=200)


class UserCreate(BaseModel):
    # Always "u-" + the email's local part, lowercased with non-alphanumerics
    # collapsed to hyphens - see makeUserId in the frontend. The pattern
    # rejects anything else a direct API call might try to set as its id.
    id: str = Field(pattern=r"^u-[a-z0-9-]+$", max_length=64)
    email: str = Field(max_length=_EMAIL_MAX)
    display_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    school_year: str = Field(default="", max_length=40)
    payment_methods: list[ShortStr] = Field(default=[], max_length=10)


class UserPublic(BaseModel):
    id: str
    email: str
    display_name: str
    school_year: str = ""
    payment_methods: list[str] = []
    rating_avg: float = 0.0
    rating_count: int = 0
    email_verified: bool = False
    has_password: bool = False
    is_admin: bool = False


class UserUpdate(BaseModel):
    """Allow-list for PATCH /users/{id}. This used to take a bare dict, which
    accepted any key at any length - the three fields the profile screen
    actually edits, each capped the same way as UserCreate."""

    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    school_year: str | None = Field(default=None, max_length=40)
    payment_methods: list[ShortStr] | None = Field(default=None, max_length=10)


class LoginRequest(BaseModel):
    email: str = Field(max_length=_EMAIL_MAX)
    password: str = Field(max_length=128)


class GoogleLoginRequest(BaseModel):
    id_token: str = Field(max_length=4096)


class SetPasswordRequest(BaseModel):
    id_token: str | None = Field(default=None, max_length=4096)
    password: str = Field(min_length=8, max_length=128)


class VerifyRequest(BaseModel):
    email: str = Field(max_length=_EMAIL_MAX)
    code: str = Field(max_length=10)


class ResendRequest(BaseModel):
    email: str = Field(max_length=_EMAIL_MAX)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(max_length=_EMAIL_MAX)


class ResetPasswordRequest(BaseModel):
    email: str = Field(max_length=_EMAIL_MAX)
    code: str = Field(max_length=10)
    password: str = Field(min_length=8, max_length=128)


class Listing(BaseModel):
    id: str = ""
    seller_id: str
    name: str = Field(min_length=1, max_length=120)
    price: float = Field(ge=0, le=PRICE_MAX)
    category: str = Field(max_length=40)
    condition: str = Field(max_length=40)
    description: str = Field(default="", max_length=2000)
    status: str = "active"
    flag_reason: str = Field(default="", max_length=200)
    photos: list[PhotoUrl] = Field(default=[], max_length=10)
    photos_small: list[PhotoUrl] = Field(default=[], max_length=10)
    pickup_location: str = Field(min_length=1, max_length=120)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sold_at: datetime | None = None
    # Server-owned moderation field: hidden while the seller's account is
    # closed. Never accepted from a request body (see ListingUpdate).
    deleted_at: datetime | None = None


class ListingUpdate(BaseModel):
    """Explicit allow-list for PATCH /listings/{id}. id, seller_id, flag_reason,
    photos_small, created_at, and sold_at are all server-derived/moderation-
    owned - deliberately absent here rather than merely stripped, so a bare
    dict payload can't inject them (or any other unknown field)."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    price: float | None = Field(default=None, ge=0, le=PRICE_MAX)
    category: str | None = Field(default=None, max_length=40)
    condition: str | None = Field(default=None, max_length=40)
    description: str | None = Field(default=None, max_length=2000)
    pickup_location: str | None = Field(default=None, min_length=1, max_length=120)
    photos: list[PhotoUrl] | None = Field(default=None, max_length=10)
    # Moderation is the only thing allowed to set "flagged" - see
    # _apply_moderation, which re-derives it from the (possibly just-edited)
    # text regardless of what's requested here.
    status: Literal["active", "sold"] | None = None


class Rating(BaseModel):
    id: str = ""
    rater_id: str
    ratee_id: str
    listing_id: str
    stars: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReportRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=120)
    details: str = Field(default="", max_length=500)


class OfferCreate(BaseModel):
    price: float = Field(gt=0, le=PRICE_MAX)


class WantedRequestCreate(BaseModel):
    """A "Looking For" post. Kept separate from Listing on purpose: a request
    has no price/condition and carries a budget range and an expiry instead."""

    title: str = Field(min_length=3, max_length=120)
    category: str = Field(min_length=1, max_length=40)
    description: str = Field(min_length=1, max_length=2000)
    budget_min: float | None = Field(default=None, ge=0, le=PRICE_MAX)
    budget_max: float | None = Field(default=None, ge=0, le=PRICE_MAX)
    preferred_location: str = Field(default="", max_length=120)
    photos: list[PhotoUrl] = Field(default=[], max_length=10)
    expires_at: datetime | None = None


class WantedRequestUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    category: str | None = Field(default=None, min_length=1, max_length=40)
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    budget_min: float | None = Field(default=None, ge=0, le=PRICE_MAX)
    budget_max: float | None = Field(default=None, ge=0, le=PRICE_MAX)
    preferred_location: str | None = Field(default=None, max_length=120)
    photos: list[PhotoUrl] | None = Field(default=None, max_length=10)
    expires_at: datetime | None = None
    status: str | None = None


class NotificationCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    listing_id: str = Field(default="", max_length=100)


class PhotoUploadRequest(BaseModel):
    # storage.py's upload_photo base64-decodes the whole string into memory
    # before it ever checks the real 6MB image-size limit - this caps the
    # request body itself first (6MB raw inflates to ~8MB of base64 text).
    data_url: str = Field(max_length=9_000_000)


class OpenThreadRequest(BaseModel):
    other_user_id: str | None = Field(default=None, max_length=100)
    listing_id: str = Field(max_length=100)


class SendMessageRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class MarkReadRequest(BaseModel):
    last_read_msg_id: int | None = None
