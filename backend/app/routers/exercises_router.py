import json
import subprocess
import sys
import uuid
from pathlib import Path
import yaml
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import CameraSession

ENGINE_PATH = Path(__file__).parent.parent.parent.parent / "engine"
if str(ENGINE_PATH) not in sys.path:
    sys.path.insert(0, str(ENGINE_PATH))

from exercises.loader import get_available_exercises, get_exercise_info, get_all_exercises_info, DEFINITIONS_DIR
from app.auth import get_current_user
from app.models.models import User
from app.routers.profile_router import UPLOADS_DIR

router = APIRouter(prefix="/api/exercises", tags=["exercises"])

ENGINE_PY = ENGINE_PATH / "venv" / "bin" / "python"
ANALYSIS_DIR = UPLOADS_DIR / "analysis"
ANALYSIS_DIR.mkdir(exist_ok=True)
MAX_VIDEO = 150 * 1024 * 1024


def _check(name: str):
    if name not in get_available_exercises():
        raise HTTPException(status_code=404, detail="Exercício não encontrado")


@router.get("")
def list_exercises(user: User = Depends(get_current_user)):
    return get_all_exercises_info()


@router.get("/analysis/{job}")
def analysis_status(job: str, user: User = Depends(get_current_user)):
    if not job.startswith(f"{user.id}_") or not job.replace("_", "").isalnum():
        raise HTTPException(status_code=404, detail="Análise não encontrada")
    path = ANALYSIS_DIR / f"{job}.json"
    if not path.exists():
        return {"status": "queued", "progress": 0}
    try:
        data = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return {"status": "processing", "progress": 0}
    if data.get("status") in ("completed", "error"):
        for f in ANALYSIS_DIR.glob(f"{job}_in.*"):
            f.unlink(missing_ok=True)
    data.pop("output_video", None)
    if data.get("status") == "completed":
        data["output_video"] = f"/uploads/analysis/{job}.mp4"
    return data


@router.get("/{name}")
def get_exercise(name: str, user: User = Depends(get_current_user)):
    info = get_exercise_info(name)
    if not info:
        return {"error": "Exercicio nao encontrado"}
    return info


@router.get("/{name}/definition")
def get_definition(name: str, user: User = Depends(get_current_user)):
    _check(name)
    return yaml.safe_load((DEFINITIONS_DIR / f"{name}.yaml").read_text(encoding="utf-8"))


class CameraSessionReq(BaseModel):
    source: str
    reps: int = 0
    left_reps: Optional[int] = None
    right_reps: Optional[int] = None
    hold_seconds: Optional[float] = None
    form_score: Optional[int] = None
    duration_sec: Optional[int] = None


@router.post("/{name}/sessions")
def save_camera_session(name: str, data: CameraSessionReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check(name)
    if data.source not in ("camera", "video", "servidor"):
        raise HTTPException(status_code=400, detail="Origem inválida")
    s = CameraSession(user_id=user.id, exercise=name, **data.model_dump())
    db.add(s)
    db.commit()
    return {"id": s.id}


@router.post("/{name}/analyze")
async def analyze_video(name: str, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    _check(name)
    if not (file.content_type or "").startswith("video/"):
        raise HTTPException(status_code=400, detail="Envie um arquivo de vídeo")
    if not ENGINE_PY.exists():
        raise HTTPException(status_code=503, detail="Motor de análise não instalado no servidor")
    content = await file.read()
    if len(content) > MAX_VIDEO:
        raise HTTPException(status_code=413, detail="Vídeo muito grande (máx. 150 MB)")
    job = f"{user.id}_{uuid.uuid4().hex[:12]}"
    src = ANALYSIS_DIR / f"{job}_in{Path(file.filename or 'v.mp4').suffix or '.mp4'}"
    src.write_bytes(content)
    # ponytail: um processo por vídeo, sem fila; adicionar fila se muitos usuários enviarem ao mesmo tempo
    subprocess.Popen([str(ENGINE_PY), "video_processor.py", str(src), name,
                      str(ANALYSIS_DIR / f"{job}.json"), str(ANALYSIS_DIR / f"{job}.mp4")],
                     cwd=str(ENGINE_PATH), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    return {"job": job}
