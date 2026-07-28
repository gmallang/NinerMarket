import uuid
from fastapi import APIRouter, HTTPException
from models import User
from database import users

router = APIRouter()

@router.post("/users")
def create_user(user: User):
    user.id = str(uuid.uuid4())
    users[user.id] = user
    return user

@router.get("/users/{id}")
def get_user(id: str):
    if id not in users:
        raise HTTPException(status_code=404, detail="User not found")
    return users[id]