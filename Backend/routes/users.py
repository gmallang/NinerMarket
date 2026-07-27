from fastapi import APIRouter
from models import User
from database import users

router = APIRouter()

@router.post("/users")
def create_user(user: User):
    users[user.id] = user
    return user

@router.get("/users/{id}")
def get_user(id: str):
    return users[id]