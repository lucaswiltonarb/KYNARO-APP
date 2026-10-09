from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.models import User, Profile
from app.auth import get_current_user
import json, os, uuid
from pathlib import Path
from datetime import date

router = APIRouter(prefix="/api/profile", tags=["profile"])

UPLOADS_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    goal: Optional[str] = None
    activity_level: Optional[str] = None
    body_fat_pct: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    water_pct: Optional[float] = None
    bone_mass_kg: Optional[float] = None
    bmr: Optional[float] = None
    visceral_fat: Optional[int] = None
    medical_notes: Optional[str] = None
    injuries: Optional[str] = None
    protein_preference: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    measurements: Optional[dict] = None
    meal_times: Optional[dict] = None


class WaterReq(BaseModel):
    date: str
    liters: float


class OnboardingReq(BaseModel):
    name: str
    age: int
    gender: str
    height_cm: float
    weight_kg: float
    goal: str
    activity_level: str
    protein_preference: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    injuries: Optional[str] = None
    target_weight: Optional[float] = None
    onboarding: Optional[dict] = None  # todas as respostas do onboarding (experiência, local, equipamentos, foco...)


@router.get("")
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Perfil nao encontrado")
    return _profile_dict(p)


@router.put("")
def update_profile(data: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Perfil nao encontrado")
    update_data = data.model_dump(exclude_none=True)
    new_name = update_data.pop('name', None)
    for field, val in update_data.items():
        setattr(p, field, val)
    if new_name:
        user_obj = db.query(User).filter(User.id == user.id).first()
        user_obj.name = new_name
        db.add(user_obj)
    db.commit()
    db.refresh(p)
    name = new_name or user.name
    d = _profile_dict(p)
    d["name"] = name
    return d


@router.post("/onboarding")
def complete_onboarding(data: OnboardingReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not p:
        p = Profile(user_id=user.id)
        db.add(p)
    for field, val in data.model_dump(exclude_none=True).items():
        if field == "name":
            user.name = val
        elif hasattr(p, field):
            setattr(p, field, val)
    p.weight_history = [{"date": str(date.today()), "weight": data.weight_kg}]
    user.onboarding_done = True
    db.commit()
    return {"ok": True}


@router.post("/weight")
def log_weight(weight: float, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Profile).filter(Profile.user_id == user.id).first()
    history = p.weight_history or []
    history.append({"date": str(date.today()), "weight": weight})
    p.weight_history = history
    p.weight_kg = weight
    db.commit()
    return {"ok": True}


async def _save_upload(file: UploadFile, user_id: int) -> str:
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    content = await file.read()
    with open(UPLOADS_DIR / filename, "wb") as f:
        f.write(content)
    return filename


@router.post("/avatar")
async def upload_avatar(file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    filename = await _save_upload(file, user.id)
    p = db.query(Profile).filter(Profile.user_id == user.id).first()
    p.avatar_url = f"/uploads/{filename}"
    db.commit()
    return {"url": p.avatar_url}


@router.put("/water")
def set_water(data: WaterReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Profile).filter(Profile.user_id == user.id).first()
    p.water_log = {**(p.water_log or {}), data.date: round(max(0, min(data.liters, 10)), 2)}
    db.commit()
    return {"date": data.date, "liters": p.water_log[data.date]}


@router.post("/photo")
async def upload_photo(file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    filename = await _save_upload(file, user.id)
    p = db.query(Profile).filter(Profile.user_id == user.id).first()
    photos = p.progress_photos or []
    photos.append({"date": str(date.today()), "url": f"/uploads/{filename}"})
    p.progress_photos = photos
    db.commit()
    return {"url": f"/uploads/{filename}"}


def _profile_dict(p: Profile) -> dict:
    return {
        "age": p.age, "gender": p.gender, "height_cm": p.height_cm,
        "weight_kg": p.weight_kg, "goal": p.goal, "activity_level": p.activity_level,
        "body_fat_pct": p.body_fat_pct, "muscle_mass_kg": p.muscle_mass_kg,
        "water_pct": p.water_pct, "bone_mass_kg": p.bone_mass_kg,
        "bmr": p.bmr, "visceral_fat": p.visceral_fat,
        "medical_notes": p.medical_notes, "injuries": p.injuries,
        "protein_preference": p.protein_preference,
        "dietary_restrictions": p.dietary_restrictions,
        "measurements": p.measurements, "progress_photos": p.progress_photos,
        "weight_history": p.weight_history,
        "avatar_url": p.avatar_url, "meal_times": p.meal_times, "water_log": p.water_log,
        "target_weight": p.target_weight, "onboarding": p.onboarding,
    }
