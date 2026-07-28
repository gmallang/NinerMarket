from uuid
from fastapi import APIRouter, HTTPException
from models import Listing
from database import listings

router = APIRouter()

@router.post("/listings")
def create_listing(listing: Listing):
    listing.id = str(uuid.uuid4())
    listings[listing.id] = listing
    return listing

@router.get("/listings/{id}")
def get_listing(id: str):
    if id not in listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listings[id]