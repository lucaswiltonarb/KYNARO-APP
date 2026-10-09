import secrets
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models.models import User, Profile, WorkoutCheckin, Challenge, ChallengeMember, ChallengeMessage

router = APIRouter(prefix="/api/challenges", tags=["challenges"])

SCORING = {"dias": "Dias ativos", "treinos": "Treinos", "minutos": "Minutos"}
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class ChallengeReq(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: str
    end_date: str
    scoring: str = "dias"


class JoinReq(BaseModel):
    code: str


class MessageReq(BaseModel):
    text: str


def _iso(dt):
    return dt and dt.replace(tzinfo=timezone.utc).isoformat()


def _status(c: Challenge) -> str:
    t = str(date.today())
    return "em_breve" if t < c.start_date else "encerrado" if t > c.end_date else "ativo"


def _people(db: Session, ids) -> dict:
    users = {u.id: u for u in db.query(User).filter(User.id.in_(ids))}
    avatars = {p.user_id: p.avatar_url for p in db.query(Profile).filter(Profile.user_id.in_(ids))}
    return {i: {"id": i, "name": users[i].name, "avatar_url": avatars.get(i)} for i in ids if i in users}


def _member_ids(db: Session, cid: int) -> list[int]:
    return [m.user_id for m in db.query(ChallengeMember).filter(ChallengeMember.challenge_id == cid)]


def _get(db: Session, cid: int, user: User) -> Challenge:
    c = db.query(Challenge).filter(Challenge.id == cid).first()
    if not c or not db.query(ChallengeMember).filter(ChallengeMember.challenge_id == cid, ChallengeMember.user_id == user.id).first():
        raise HTTPException(status_code=404, detail="Desafio não encontrado")
    return c


def _leaderboard(db: Session, c: Challenge) -> list[dict]:
    ids = _member_ids(db, c.id)
    people = _people(db, ids)
    rows = db.query(WorkoutCheckin).filter(WorkoutCheckin.user_id.in_(ids), WorkoutCheckin.date >= c.start_date,
                                           WorkoutCheckin.date <= c.end_date).all()
    stats = {i: {"days": set(), "workouts": 0, "minutes": 0, "last": None} for i in ids}
    for r in rows:
        s = stats[r.user_id]
        s["days"].add(r.date)
        s["workouts"] += 1
        s["minutes"] += r.duration_min or 0
        s["last"] = max(s["last"] or r.date, r.date)
    board = []
    for i in ids:
        if i not in people:
            continue
        s = stats[i]
        pts = {"dias": len(s["days"]), "treinos": s["workouts"], "minutos": s["minutes"]}[c.scoring]
        board.append({**people[i], "points": pts, "days": len(s["days"]), "workouts": s["workouts"],
                      "minutes": s["minutes"], "last_checkin": s["last"]})
    board.sort(key=lambda x: (-x["points"], x["name"].lower()))
    for n, b in enumerate(board):
        b["rank"] = board[n - 1]["rank"] if n and board[n - 1]["points"] == b["points"] else n + 1
    return board


def _summary(db: Session, c: Challenge, user: User, board=None) -> dict:
    board = board if board is not None else _leaderboard(db, c)
    me = next((b for b in board if b["id"] == user.id), None)
    return {"id": c.id, "name": c.name, "description": c.description, "start_date": c.start_date, "end_date": c.end_date,
            "scoring": c.scoring, "scoring_label": SCORING[c.scoring], "invite_code": c.invite_code,
            "status": _status(c), "is_owner": c.owner_id == user.id, "members_count": len(board),
            "my_rank": me and me["rank"], "my_points": me and me["points"],
            "leader": board[0] if board and board[0]["points"] > 0 else None}


@router.get("")
def my_challenges(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ids = [m.challenge_id for m in db.query(ChallengeMember).filter(ChallengeMember.user_id == user.id)]
    items = [_summary(db, c, user) for c in db.query(Challenge).filter(Challenge.id.in_(ids))]
    order = {"ativo": 0, "em_breve": 1, "encerrado": 2}
    return sorted(items, key=lambda x: (order[x["status"]], x["end_date"]))


@router.post("")
def create_challenge(data: ChallengeReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = data.name.strip()
    if not 2 <= len(name) <= 60:
        raise HTTPException(status_code=400, detail="Dê um nome de 2 a 60 caracteres ao desafio")
    if data.scoring not in SCORING:
        raise HTTPException(status_code=400, detail="Tipo de pontuação inválido")
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="A data final deve ser depois da inicial")
    if data.end_date < str(date.today()):
        raise HTTPException(status_code=400, detail="O desafio não pode terminar no passado")
    code = "".join(secrets.choice(CODE_CHARS) for _ in range(6))
    while db.query(Challenge).filter(Challenge.invite_code == code).first():
        code = "".join(secrets.choice(CODE_CHARS) for _ in range(6))
    c = Challenge(owner_id=user.id, name=name, description=(data.description or "").strip() or None,
                  start_date=data.start_date, end_date=data.end_date, scoring=data.scoring, invite_code=code)
    db.add(c)
    db.flush()
    db.add(ChallengeMember(challenge_id=c.id, user_id=user.id))
    db.commit()
    return _summary(db, c, user)


@router.get("/preview/{code}")
def preview(code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.query(Challenge).filter(Challenge.invite_code == code.strip().upper()).first()
    if not c:
        raise HTTPException(status_code=404, detail="Código de convite inválido")
    joined = db.query(ChallengeMember).filter(ChallengeMember.challenge_id == c.id, ChallengeMember.user_id == user.id).first()
    owner = db.query(User).filter(User.id == c.owner_id).first()
    return {"id": c.id, "name": c.name, "description": c.description, "start_date": c.start_date, "end_date": c.end_date,
            "scoring_label": SCORING[c.scoring], "status": _status(c), "members_count": len(_member_ids(db, c.id)),
            "owner_name": owner and owner.name, "joined": bool(joined)}


@router.post("/join")
def join(data: JoinReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.query(Challenge).filter(Challenge.invite_code == data.code.strip().upper()).first()
    if not c:
        raise HTTPException(status_code=404, detail="Código de convite inválido")
    if _status(c) == "encerrado":
        raise HTTPException(status_code=400, detail="Este desafio já foi encerrado")
    if not db.query(ChallengeMember).filter(ChallengeMember.challenge_id == c.id, ChallengeMember.user_id == user.id).first():
        db.add(ChallengeMember(challenge_id=c.id, user_id=user.id))
        db.add(ChallengeMessage(challenge_id=c.id, user_id=user.id, text="entrou no desafio 👋"))
        db.commit()
    return _summary(db, c, user)


@router.get("/{cid}")
def detail(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _get(db, cid, user)
    board = _leaderboard(db, c)
    return {**_summary(db, c, user, board), "leaderboard": board}


@router.get("/{cid}/feed")
def feed(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _get(db, cid, user)
    ids = _member_ids(db, c.id)
    people = _people(db, ids)
    rows = db.query(WorkoutCheckin).filter(WorkoutCheckin.user_id.in_(ids), WorkoutCheckin.date >= c.start_date,
                                           WorkoutCheckin.date <= c.end_date).order_by(WorkoutCheckin.id.desc()).limit(60).all()
    return [{"id": r.id, "user": people.get(r.user_id), "date": r.date, "day_name": r.day_name,
             "duration_min": r.duration_min, "exercises": len(r.exercises_done or []), "created_at": _iso(r.created_at)}
            for r in rows if r.user_id in people]


@router.get("/{cid}/messages")
def messages(cid: int, after: int = 0, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _get(db, cid, user)
    q = db.query(ChallengeMessage).filter(ChallengeMessage.challenge_id == cid, ChallengeMessage.id > after)
    rows = list(reversed(q.order_by(ChallengeMessage.id.desc()).limit(100).all()))
    people = _people(db, list({m.user_id for m in rows}))
    return [{"id": m.id, "user": people.get(m.user_id), "text": m.text, "created_at": _iso(m.created_at)} for m in rows]


@router.post("/{cid}/messages")
def send_message(cid: int, data: MessageReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _get(db, cid, user)
    text = data.text.strip()
    if not text or len(text) > 500:
        raise HTTPException(status_code=400, detail="A mensagem deve ter de 1 a 500 caracteres")
    m = ChallengeMessage(challenge_id=cid, user_id=user.id, text=text)
    db.add(m)
    db.commit()
    return {"id": m.id, "user": _people(db, [user.id]).get(user.id), "text": m.text, "created_at": _iso(m.created_at)}


@router.delete("/{cid}/leave")
def leave(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _get(db, cid, user)
    if c.owner_id == user.id:
        raise HTTPException(status_code=400, detail="Você criou este desafio. Exclua-o em vez de sair.")
    db.query(ChallengeMember).filter(ChallengeMember.challenge_id == cid, ChallengeMember.user_id == user.id).delete()
    db.commit()
    return {"ok": True}


@router.delete("/{cid}")
def delete_challenge(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _get(db, cid, user)
    if c.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Só quem criou pode excluir o desafio")
    db.query(ChallengeMessage).filter(ChallengeMessage.challenge_id == cid).delete()
    db.query(ChallengeMember).filter(ChallengeMember.challenge_id == cid).delete()
    db.delete(c)
    db.commit()
    return {"ok": True}
