from fastapi import APIRouter
from models import Listing
from database import listings

router = APIRouter()

@router.post("/listings")
def create_listing(listing: Listing):
    listings[listing.id] = listing
    return listing

@router.get("/listings/{id}")
def get_listing(id: str):
    return listings[id]