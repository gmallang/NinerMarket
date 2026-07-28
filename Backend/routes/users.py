from fastapi import APIRouter
from models import User
from database import db, users

router = APIRouter()

@router.post("/users")
def create_user(user: User):
    if not user.email.endswith("@charlotte.edu"):
        return {"error": "Must use a .charlotte.edu email"}
    
    if db:
        return db.table("users").insert(user.dict()).execute()
    
    if user.id in users:
        return {"error": "User already exists"}
    users[user.id] = user
    return user

@router.get("/users/{id}")
def get_user(id: str):
    if db:
        return db.table("users").select("*").eq("id", id).execute()
    
    if id not in users:
        return {"error": "User not found"}
    return users[id]