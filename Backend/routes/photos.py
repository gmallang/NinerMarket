from fastapi import APIRouter, Depends, HTTPException

from auth import require_user
from models import PhotoUploadRequest
from storage import upload_photo

router = APIRouter()


@router.post("/photos")
def upload(body: PhotoUploadRequest, user_id: str = Depends(require_user)):
    try:
        url = upload_photo(user_id, body.data_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"url": url}
