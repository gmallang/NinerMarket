from fastapi import APIRouter, HTTPException

from database import db, users
from models import User

router = APIRouter()


@router.post("/users")
def create_user(user: User):
    if not user.email.endswith("@charlotte.edu"):
        raise HTTPException(status_code=400, detail="Must use a .charlotte.edu email")

    if db:
        existing = db.table("users").select("id").eq("id", user.id).execute()
        if existing.data:
            raise HTTPException(status_code=409, detail="User already exists")
        data = db.table("users").insert(user.model_dump(mode="json")).execute()
        return data.data[0]

    if user.id in users:
        raise HTTPException(status_code=409, detail="User already exists")
    users[user.id] = user
    return user


@router.get("/users/{id}")
def get_user(id: str):
    if db:
        data = db.table("users").select("*").eq("id", id).execute()
        if not data.data:
            raise HTTPException(status_code=404, detail="User not found")
        return data.data[0]

    if id not in users:
        raise HTTPException(status_code=404, detail="User not found")
    return users[id]
