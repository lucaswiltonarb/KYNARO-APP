from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.models.models import User, Profile, Workout, WorkoutCheckin, WorkoutSession
from app.auth import get_current_user
from app.services.ai_service import ai_generate
from datetime import date, timedelta, datetime, timezone
import json

router = APIRouter(prefix="/api/workout", tags=["workout"])

SYSTEM_PROMPT = """Voce e um personal trainer brasileiro com certificacao CREF.
Gere planos de treino em portugues brasileiro.
Responda SEMPRE em JSON valido, sem markdown, sem texto extra.
Use exercicios reais com series, repeticoes e descanso.
Considere lesoes e restricoes do aluno."""


@router.get("/plan")
def get_current_plan(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(Workout).filter(Workout.user_id == user.id).order_by(Workout.id.desc()).first()
    if not plan:
        return {"plan": None}
    return {"plan": {"id": plan.id, "week_start": plan.week_start, "data": plan.plan_data}}


@router.post("/generate")
async def generate_plan(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile or not profile.goal:
        raise HTTPException(status_code=400, detail="Complete seu perfil primeiro")

    goals_map = {
        "perder_peso": "emagrecimento e queima de gordura",
        "ganhar_massa": "hipertrofia muscular",
        "manter": "condicionamento geral",
        "definir": "definicao muscular",
    }
    goal_desc = goals_map.get(profile.goal, profile.goal)
    ob = profile.onboarding or {}
    days = ob.get("days_per_week") or 5
    extra = "\n".join(f"- {label}: {val}" for label, val in [
        ("Experiencia com treino de forca", ob.get("experience_label")),
        ("Local de treino", ob.get("location_label")),
        ("Equipamentos disponiveis (use SOMENTE estes)", ", ".join(ob.get("equipment") or []) or None),
        ("Regioes de foco", ", ".join(ob.get("focus") or []) or None),
        ("Duracao desejada por treino", ob.get("duration_label")),
        ("Meta de peso", f"{profile.target_weight} kg" if profile.target_weight else None),
    ] if val)

    prompt = f"""Crie uma grade semanal com EXATAMENTE {days} dias de treino (os demais dias como descanso) para:
- Objetivo: {goal_desc}
- Peso: {profile.weight_kg}kg, Altura: {profile.height_cm}cm, Idade: {profile.age} anos
- Genero: {profile.gender}
- Nivel: {profile.activity_level}
- Lesoes/restricoes: {profile.injuries or 'nenhuma'}
{extra}
Ajuste o numero de exercicios e series para caber na duracao desejada e evite sobrecarregar as areas com lesao.

Responda SOMENTE com este JSON:
{{
  "split": "ABC",
  "days": [
    {{
      "day": "Segunda",
      "name": "Treino A - Peito e Triceps",
      "muscle_groups": ["Peito", "Triceps"],
      "exercises": [
        {{"name": "Supino reto com barra", "sets": 4, "reps": "8-12", "rest_sec": 90, "engine_id": null}},
        {{"name": "Crucifixo com halteres", "sets": 3, "reps": "12-15", "rest_sec": 60, "engine_id": null}},
        {{"name": "Flexao de bracos", "sets": 3, "reps": "ate a falha", "rest_sec": 60, "engine_id": "push_up"}}
      ]
    }},
    {{
      "day": "Sabado",
      "name": "Descanso",
      "muscle_groups": [],
      "exercises": []
    }}
  ]
}}

IMPORTANTE: se o exercicio tem correspondente na engine de analise, use o engine_id correspondente.
Engine IDs disponiveis: bicep_curl, calf_raise, deadlift, glute_bridge, hammer_curl, high_knees,
jumping_jack, lateral_raise, leg_raise, lunge, mountain_climber, plank, push_up, shoulder_press,
side_lunge, squat, tricep_dip, wall_sit"""

    raw = await ai_generate(db, prompt, SYSTEM_PROMPT)

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        data = json.loads(raw[start:end])
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=500, detail="Erro ao processar resposta da IA. Tente novamente.")

    monday = date.today() - timedelta(days=date.today().weekday())
    plan = Workout(user_id=user.id, week_start=str(monday), plan_data=data)
    db.add(plan)
    db.commit()
    db.refresh(plan)

    return {"plan": {"id": plan.id, "week_start": plan.week_start, "data": plan.plan_data}}


class CheckinReq(BaseModel):
    workout_id: Optional[int] = None
    session_id: Optional[int] = None
    day_name: str
    exercises_done: list
    notes: Optional[str] = None
    duration_min: Optional[int] = None


class SessionReq(BaseModel):
    id: Optional[int] = None
    date: str
    day_idx: int
    day_name: str
    workout_id: Optional[int] = None
    state: dict
    events: List[dict] = []


def _now():
    return datetime.now(timezone.utc)


def _stamp(events):
    return [{"type": e.get("type"), "detail": e.get("detail"), "at": _now().isoformat()} for e in events]


def _session_dict(s: WorkoutSession) -> dict:
    return {"id": s.id, "date": s.date, "day_idx": s.day_idx, "day_name": s.day_name, "workout_id": s.workout_id,
            "status": s.status, "state": s.state, "events": s.events or [], "checkin_id": s.checkin_id,
            "started_at": s.started_at and s.started_at.isoformat(), "updated_at": s.updated_at and s.updated_at.isoformat(),
            "finished_at": s.finished_at and s.finished_at.isoformat()}


@router.get("/sessions")
def list_sessions(date: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(WorkoutSession).filter(WorkoutSession.user_id == user.id, WorkoutSession.date == date).all()
    return [_session_dict(s) for s in rows]


@router.put("/session")
def save_session(data: SessionReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(WorkoutSession).filter(WorkoutSession.user_id == user.id)
    s = q.filter(WorkoutSession.id == data.id).first() if data.id else q.filter(
        WorkoutSession.date == data.date, WorkoutSession.day_idx == data.day_idx,
        WorkoutSession.status == "em_andamento").first()
    if s and s.status != "em_andamento":
        raise HTTPException(status_code=409, detail="Este treino já foi finalizado")
    if not s:
        s = WorkoutSession(user_id=user.id, date=data.date, day_idx=data.day_idx, day_name=data.day_name,
                           workout_id=data.workout_id, status="em_andamento", events=[])
        db.add(s)
    s.state = data.state
    s.updated_at = _now()
    if data.events:
        s.events = (s.events or []) + _stamp(data.events)
    db.commit()
    db.refresh(s)
    return _session_dict(s)


@router.post("/checkin")
def checkin(data: CheckinReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = WorkoutCheckin(
        user_id=user.id, workout_id=data.workout_id, date=str(date.today()),
        day_name=data.day_name, exercises_done=data.exercises_done,
        notes=data.notes, duration_min=data.duration_min,
    )
    db.add(c)
    db.flush()
    if data.session_id:
        s = db.query(WorkoutSession).filter(WorkoutSession.id == data.session_id, WorkoutSession.user_id == user.id).first()
        if s:
            s.status = "finalizado"
            s.finished_at = _now()
            s.updated_at = s.finished_at
            s.checkin_id = c.id
            s.events = (s.events or []) + _stamp([{"type": "finalizado", "detail": f"{data.duration_min} min"}])
    db.commit()
    return {"ok": True, "id": c.id}


@router.get("/checkins")
def get_checkins(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    checkins = db.query(WorkoutCheckin).filter(
        WorkoutCheckin.user_id == user.id
    ).order_by(WorkoutCheckin.id.desc()).limit(30).all()
    return [{"id": c.id, "date": c.date, "day_name": c.day_name,
             "exercises_done": c.exercises_done, "duration_min": c.duration_min} for c in checkins]


@router.get("/history")
def workout_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plans = db.query(Workout).filter(Workout.user_id == user.id).order_by(Workout.id.desc()).limit(10).all()
    return [{"id": p.id, "week_start": p.week_start} for p in plans]
