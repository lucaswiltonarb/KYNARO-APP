from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.models import User, AdminSettings
from app.auth import require_admin, hash_password
from app.services.ai_service import AVAILABLE_MODELS, get_setting, set_setting

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "email": u.email, "name": u.name, "is_admin": u.is_admin,
             "onboarding_done": u.onboarding_done, "created_at": str(u.created_at)} for u in users]


class ToggleAdminReq(BaseModel):
    user_id: int
    is_admin: bool


@router.post("/users/toggle-admin")
def toggle_admin(req: ToggleAdminReq, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    user.is_admin = req.is_admin
    db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Nao pode deletar a si mesmo")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    db.delete(user)
    db.commit()
    return {"ok": True}


@router.get("/settings")
def get_settings(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return {
        "ai_provider": get_setting(db, "ai_provider") or "openai",
        "ai_model": get_setting(db, "ai_model") or "gpt-4o-mini",
        "openai_api_key": _mask(get_setting(db, "openai_api_key")),
        "anthropic_api_key": _mask(get_setting(db, "anthropic_api_key")),
        "gemini_api_key": _mask(get_setting(db, "gemini_api_key")),
    }


@router.get("/models")
def get_models():
    return AVAILABLE_MODELS


class SettingsUpdate(BaseModel):
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None


@router.put("/settings")
def update_settings(data: SettingsUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if data.ai_provider:
        set_setting(db, "ai_provider", data.ai_provider)
    if data.ai_model:
        set_setting(db, "ai_model", data.ai_model)
    if data.openai_api_key and not data.openai_api_key.startswith("***"):
        set_setting(db, "openai_api_key", data.openai_api_key)
    if data.anthropic_api_key and not data.anthropic_api_key.startswith("***"):
        set_setting(db, "anthropic_api_key", data.anthropic_api_key)
    if data.gemini_api_key and not data.gemini_api_key.startswith("***"):
        set_setting(db, "gemini_api_key", data.gemini_api_key)
    return {"ok": True}


def _mask(val: str | None) -> str:
    if not val:
        return ""
    return val[:4] + "***" + val[-4:] if len(val) > 8 else "***"
