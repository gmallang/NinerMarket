class User(BaseModel):
   id: str
   email: str
   display_name: str
   rating_avg: float = 0.0
   rating_count: int = 0


class Listing(BaseModel):
   id: str
   seller_id: str
   name: str
   price: float
   category: str
   condition: str
   description: str
   status: str
   photos: list[str] = []
   pickup_location: str
   created_at: datetime


class Rating(BaseModel):
   id: str
   rater_id: str
   ratee_id: str
   listing_id: str
   stars: int
   comment: str = ""
