from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.user import UserResponse
from app.dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["Demo user"])


@router.get("/me", response_model=UserResponse)
def current_demo_user(user: User = Depends(get_current_user)):
    return user
