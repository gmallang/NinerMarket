from datetime import datetime, timezone

from pydantic import BaseModel, Field


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


class UserCreate(BaseModel):
    id: str
    email: str
    display_name: str
    password: str
    school_year: str = ""
    payment_methods: list[str] = []


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


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    id_token: str


class SetPasswordRequest(BaseModel):
    id_token: str | None = None
    password: str = Field(min_length=8)


class VerifyRequest(BaseModel):
    email: str
    code: str


class ResendRequest(BaseModel):
    email: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    password: str = Field(min_length=8)


class Listing(BaseModel):
    id: str = ""
    seller_id: str
    name: str
    price: float = Field(ge=0)
    category: str
    condition: str
    description: str
    status: str = "active"
    flag_reason: str = ""
    photos: list[str] = []
    photos_small: list[str] = []
    pickup_location: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sold_at: datetime | None = None


class Rating(BaseModel):
    id: str = ""
    rater_id: str
    ratee_id: str
    listing_id: str
    stars: int = Field(ge=1, le=5)
    comment: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReportRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=120)
    details: str = Field(default="", max_length=500)


class OfferCreate(BaseModel):
    price: float = Field(gt=0)


class WantedRequestCreate(BaseModel):
    """A "Looking For" post. Kept separate from Listing on purpose: a request
    has no price/condition and carries a budget range and an expiry instead."""

    title: str = Field(min_length=3, max_length=120)
    category: str = Field(min_length=1, max_length=40)
    description: str = Field(min_length=1, max_length=2000)
    budget_min: float | None = Field(default=None, ge=0)
    budget_max: float | None = Field(default=None, ge=0)
    preferred_location: str = Field(default="", max_length=120)
    photos: list[str] = []
    expires_at: datetime | None = None


class WantedRequestUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    category: str | None = Field(default=None, min_length=1, max_length=40)
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    budget_min: float | None = Field(default=None, ge=0)
    budget_max: float | None = Field(default=None, ge=0)
    preferred_location: str | None = Field(default=None, max_length=120)
    photos: list[str] | None = None
    expires_at: datetime | None = None
    status: str | None = None


class NotificationCreate(BaseModel):
    text: str
    listing_id: str = ""


class PhotoUploadRequest(BaseModel):
    data_url: str


class OpenThreadRequest(BaseModel):
    other_user_id: str | None = None
    listing_id: str


class SendMessageRequest(BaseModel):
    text: str


class MarkReadRequest(BaseModel):
    last_read_msg_id: int | None = None
