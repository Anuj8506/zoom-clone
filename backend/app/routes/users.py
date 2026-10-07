from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.user import UserResponse

router = APIRouter(prefix="/users", tags=["Demo user"])


@router.get("/me", response_model=UserResponse)
def current_demo_user(db: Session = Depends(get_db)):
    return db.get(User, 1)
