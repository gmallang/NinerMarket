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
    pickup_location: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Rating(BaseModel):
    id: str = ""
    rater_id: str
    ratee_id: str
    listing_id: str
    stars: int = Field(ge=1, le=5)
    comment: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NotificationCreate(BaseModel):
    text: str
    listing_id: str = ""


class PhotoUploadRequest(BaseModel):
    data_url: str


class OpenThreadRequest(BaseModel):
    listing_id: str


class SendMessageRequest(BaseModel):
    text: str
