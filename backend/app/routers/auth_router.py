from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.models import User, Profile
from app.auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class TokenResp(BaseModel):
    token: str
    user: dict


@router.post("/register", response_model=TokenResp)
def register(req: RegisterReq, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email ja cadastrado")
    user = User(email=req.email, hashed_password=hash_password(req.password), name=req.name)
    db.add(user)
    db.commit()
    db.refresh(user)
    profile = Profile(user_id=user.id)
    db.add(profile)
    db.commit()
    token = create_token(user.id, user.email, user.is_admin)
    return {"token": token, "user": _user_dict(user)}


@router.post("/login", response_model=TokenResp)
def login(req: LoginReq, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciais invalidas")
    token = create_token(user.id, user.email, user.is_admin)
    return {"token": token, "user": _user_dict(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return _user_dict(user)


def _user_dict(user: User) -> dict:
    return {
        "id": user.id, "email": user.email, "name": user.name,
        "is_admin": user.is_admin, "onboarding_done": user.onboarding_done,
    }
