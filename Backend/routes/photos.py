from fastapi import APIRouter, Depends, HTTPException

from auth import require_user
from models import PhotoUploadRequest
from ratelimit import rate_limit
from storage import upload_photo

router = APIRouter()


@router.post("/photos")
def upload(body: PhotoUploadRequest, user_id: str = Depends(require_user)):
    # Every call decodes and re-encodes with Pillow and writes two storage
    # objects, so an unthrottled loop spends CPU and the 1 GB bucket.
    rate_limit(f"photo:{user_id}", max_attempts=60, window_seconds=3600)
    try:
        result = upload_photo(user_id, body.data_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result
