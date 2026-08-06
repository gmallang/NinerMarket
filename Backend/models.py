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


class Listing(BaseModel):
    id: str = ""
    seller_id: str
    name: str
    price: float = Field(ge=0)
    category: str
    condition: str
    description: str
    status: str = "active"
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


class CheckoutRequest(BaseModel):
    listing_id: str
    success_url: str
    cancel_url: str
