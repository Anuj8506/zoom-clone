from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_settings
from app.config import Settings
from app.schemas.auth import AuthResponse, SignupRequest, LoginRequest
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Accounts"])


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    return auth_service.signup(db, payload, settings)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    return auth_service.login(db, payload, settings)
