from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.models import User, Profile, MealPlan, MealLog, DietExpense
from app.auth import get_current_user
from app.services.ai_service import ai_generate, ai_vision
from app.routers.profile_router import UPLOADS_DIR
from datetime import date, timedelta, datetime, timezone
import json, uuid

router = APIRouter(prefix="/api/nutrition", tags=["nutrition"])

SYSTEM_PROMPT = """Voce e um nutricionista esportivo brasileiro experiente.
Gere planos alimentares em portugues brasileiro.
Responda SEMPRE em JSON valido, sem markdown, sem texto extra.
Use medidas brasileiras (colher de sopa, xicara, gramas).
Receitas devem ser CONCISAS: maximo 4 passos, ingredientes com quantidades."""


@router.get("/plan")
def get_current_plan(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(MealPlan).filter(MealPlan.user_id == user.id).order_by(MealPlan.id.desc()).first()
    if not plan:
        return {"plan": None}
    return {"plan": {"id": plan.id, "week_start": plan.week_start, "data": plan.plan_data,
                      "grocery_list": plan.grocery_list, "recipes": plan.recipes,
                      "grocery_checked": plan.grocery_checked or [], "day_recipes": plan.day_recipes or {},
                      "total_calories": plan.total_calories}}


def _latest_plan(db: Session, user_id: int) -> MealPlan:
    plan = db.query(MealPlan).filter(MealPlan.user_id == user_id).order_by(MealPlan.id.desc()).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Nenhum plano alimentar")
    return plan


@router.post("/recipes/{day}")
async def day_recipes(day: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = _latest_plan(db, user.id)
    cached = (plan.day_recipes or {}).get(day)
    if cached:
        return {"day": day, "recipes": cached}
    day_data = next((d for d in (plan.plan_data or []) if d.get("day") == day), None)
    if not day_data or not day_data.get("meals"):
        raise HTTPException(status_code=404, detail="Dia sem refeições no plano")
    meals = "\n".join(f'{i}. {m.get("name")} ({m.get("calories")} kcal): {", ".join(m.get("foods") or [])}'
                      for i, m in enumerate(day_data["meals"]))
    prompt = f"""Crie uma receita prática para CADA refeição de {day}, usando exatamente os alimentos previstos:
{meals}
Regras: ingredientes com quantidades em medidas brasileiras; no máximo 5 passos curtos; tempo realista.
Para refeições simples (ex.: shake, fruta), dê um preparo rápido mesmo assim.
Responda SOMENTE com JSON válido, sem markdown:
{{"recipes": [{{"meal_idx": 0, "name": "Omelete de espinafre", "prep_min": 10,
"ingredients": ["3 ovos", "1 xícara de espinafre"], "steps": ["Bata os ovos.", "..."], "tip": "dica curta opcional"}}]}}"""
    raw = await ai_generate(db, prompt, SYSTEM_PROMPT)
    if raw.startswith("[ERRO]"):
        raise HTTPException(status_code=502, detail=raw[6:].strip())
    try:
        recipes = json.loads(raw[raw.find("{"):raw.rfind("}") + 1])["recipes"]
    except (json.JSONDecodeError, ValueError, KeyError):
        raise HTTPException(status_code=502, detail="A IA retornou uma resposta inválida. Tente novamente.")
    plan.day_recipes = {**(plan.day_recipes or {}), day: recipes}
    db.commit()
    return {"day": day, "recipes": recipes}


class ExpenseReq(BaseModel):
    date: str
    amount: float
    store: Optional[str] = None
    items_count: Optional[int] = None


def _expense_dict(e: DietExpense) -> dict:
    return {"id": e.id, "date": e.date, "amount": e.amount, "store": e.store, "items_count": e.items_count,
            "meal_plan_id": e.meal_plan_id}


@router.get("/expenses")
def list_expenses(start: str = "0000-00-00", end: str = "9999-99-99", user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(DietExpense).filter(DietExpense.user_id == user.id, DietExpense.date >= start,
                                        DietExpense.date <= end).order_by(DietExpense.date.desc(), DietExpense.id.desc()).all()
    return [_expense_dict(e) for e in rows]


@router.post("/expenses")
def add_expense(data: ExpenseReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not 0 < data.amount < 100000:
        raise HTTPException(status_code=400, detail="Informe um valor válido")
    plan = db.query(MealPlan).filter(MealPlan.user_id == user.id).order_by(MealPlan.id.desc()).first()
    e = DietExpense(user_id=user.id, meal_plan_id=plan and plan.id, date=data.date, amount=round(data.amount, 2),
                    store=(data.store or "").strip() or None, items_count=data.items_count)
    db.add(e)
    db.commit()
    db.refresh(e)
    return _expense_dict(e)


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(DietExpense).filter(DietExpense.id == expense_id, DietExpense.user_id == user.id).delete()
    db.commit()
    return {"ok": True}


MEAL_MODES = {"conforme", "ajustada", "foto", "pulada"}
NUTRI_JSON = "Responda SOMENTE com JSON valido, sem markdown."


class MealLogReq(BaseModel):
    date: str
    meal_idx: int
    meal_name: str
    mode: str
    planned_calories: Optional[int] = None
    calories: Optional[int] = None
    macros: Optional[dict] = None
    foods: list = []
    photo_url: Optional[str] = None
    ai_analysis: Optional[dict] = None


class EstimateReq(BaseModel):
    meal_name: str = ""
    foods: list[str]


def _log_dict(l: MealLog) -> dict:
    return {"id": l.id, "date": l.date, "meal_idx": l.meal_idx, "meal_name": l.meal_name, "mode": l.mode,
            "planned_calories": l.planned_calories, "calories": l.calories, "macros": l.macros, "foods": l.foods or [],
            "photo_url": l.photo_url, "ai_analysis": l.ai_analysis,
            "eaten_at": l.eaten_at and l.eaten_at.replace(tzinfo=timezone.utc).isoformat(),
            "updated_at": l.updated_at and l.updated_at.isoformat()}


def _ai_json(raw: str) -> dict:
    if raw.startswith("[ERRO]"):
        raise HTTPException(status_code=502, detail=raw[6:].strip())
    try:
        data = json.loads(raw[raw.find("{"):raw.rfind("}") + 1])
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=502, detail="A IA retornou uma resposta inválida. Tente novamente.")
    if data.get("error"):
        raise HTTPException(status_code=422, detail=data["error"])
    m = data.get("macros") or {}
    data["calories"] = int(round(float(data.get("calories") or 0)))
    data["macros"] = {k: int(round(float(m.get(k) or 0))) for k in ("p", "c", "g")}
    return data


@router.get("/logs")
def list_logs(start: str, end: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(MealLog).filter(MealLog.user_id == user.id, MealLog.date >= start, MealLog.date <= end).all()
    return [_log_dict(l) for l in rows]


@router.put("/log")
def save_log(data: MealLogReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.mode not in MEAL_MODES:
        raise HTTPException(status_code=400, detail="Tipo de registro inválido")
    plan = db.query(MealPlan).filter(MealPlan.user_id == user.id).order_by(MealPlan.id.desc()).first()
    q = db.query(MealLog).filter(MealLog.user_id == user.id, MealLog.date == data.date)
    l = q.filter(MealLog.meal_idx == data.meal_idx).first()
    if not l:
        if data.date > str(date.today()):
            raise HTTPException(status_code=400, detail="Não é possível registrar refeições de dias futuros")
        if q.filter(MealLog.meal_idx < data.meal_idx).count() < data.meal_idx:
            raise HTTPException(status_code=409, detail="Registre as refeições anteriores primeiro")
        l = MealLog(user_id=user.id, date=data.date, meal_idx=data.meal_idx, eaten_at=datetime.now(timezone.utc))
        db.add(l)
    for k, v in data.model_dump(exclude={"date", "meal_idx"}).items():
        setattr(l, k, v)
    l.meal_plan_id = plan and plan.id
    l.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(l)
    return _log_dict(l)


@router.delete("/log")
def delete_log(date: str, meal_idx: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(MealLog).filter(MealLog.user_id == user.id, MealLog.date == date)
    if q.filter(MealLog.meal_idx > meal_idx).count():
        raise HTTPException(status_code=409, detail="Desfaça primeiro as refeições registradas depois desta")
    q.filter(MealLog.meal_idx == meal_idx).delete()
    db.commit()
    return {"ok": True}


@router.post("/estimate")
async def estimate_meal(data: EstimateReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    foods = [f.strip() for f in data.foods if f.strip()]
    if not foods:
        raise HTTPException(status_code=400, detail="Informe ao menos um alimento")
    prompt = f"""Estime calorias e macronutrientes da refeição "{data.meal_name}" com estes alimentos e quantidades:
{chr(10).join('- ' + f for f in foods)}
Quando a quantidade não for informada, assuma uma porção típica brasileira.
{NUTRI_JSON} Formato: {{"calories": 520, "macros": {{"p": 32, "c": 55, "g": 18}}}}"""
    return _ai_json(await ai_generate(db, prompt, SYSTEM_PROMPT))


@router.post("/analyze-photo")
async def analyze_photo(file: UploadFile = File(...), meal_name: str = Form(""), planned: str = Form(""),
                        user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Envie uma imagem")
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Imagem muito grande (máx. 8 MB)")
    prompt = f"""Analise a foto deste prato. Refeição: "{meal_name or 'não informada'}". Plano previsto: {planned or 'não informado'}.
Identifique cada alimento visível, estime a porção (em gramas ou unidades caseiras) e as calorias de cada um.
Some o total e estime os macronutrientes em gramas (p=proteína, c=carboidrato, g=gordura).
Se a imagem não mostrar comida, responda {{"error": "Não identifiquei comida na foto. Tente outra imagem."}}.
{NUTRI_JSON} Formato:
{{"foods": [{{"name": "Arroz branco", "qty": "150 g", "calories": 195}}], "calories": 620,
"macros": {{"p": 35, "c": 70, "g": 18}}, "confidence": "alta|media|baixa", "notes": "observação curta opcional"}}"""
    analysis = _ai_json(await ai_vision(db, prompt, SYSTEM_PROMPT, content, file.content_type))
    filename = f"{user.id}_meal_{uuid.uuid4().hex[:10]}.{file.content_type.split('/')[-1].replace('jpeg', 'jpg')}"
    (UPLOADS_DIR / filename).write_bytes(content)
    return {"photo_url": f"/uploads/{filename}", "analysis": analysis}


class ShoppingReq(BaseModel):
    checked: list[str]


@router.put("/shopping")
def set_shopping(data: ShoppingReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(MealPlan).filter(MealPlan.user_id == user.id).order_by(MealPlan.id.desc()).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Nenhum plano alimentar")
    plan.grocery_checked = data.checked
    db.commit()
    return {"checked": plan.grocery_checked}


@router.post("/generate")
async def generate_plan(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile or not profile.goal:
        raise HTTPException(status_code=400, detail="Complete seu perfil primeiro")

    goals_map = {
        "perder_peso": "perda de gordura com deficit calorico moderado",
        "ganhar_massa": "hipertrofia com superavit calorico controlado",
        "manter": "manutencao de peso e saude",
        "definir": "definicao muscular com deficit leve e proteina alta",
    }
    goal_desc = goals_map.get(profile.goal, profile.goal)

    prompt = f"""Crie um cardapio semanal (segunda a domingo) para:
- Objetivo: {goal_desc}
- Peso: {profile.weight_kg}kg, Altura: {profile.height_cm}cm, Idade: {profile.age} anos
- Genero: {profile.gender}
- Nivel de atividade: {profile.activity_level}
- Preferencia de proteina: {profile.protein_preference or 'sem preferencia'}
- Restricoes: {profile.dietary_restrictions or 'nenhuma'}

Responda SOMENTE com este JSON:
{{
  "total_calories": 2000,
  "macros": {{"proteina_g": 150, "carb_g": 200, "gordura_g": 70}},
  "days": [
    {{
      "day": "Segunda",
      "meals": [
        {{"name": "Cafe da manha", "foods": ["2 ovos mexidos", "1 fatia pao integral", "1 banana"], "calories": 350, "macros": {{"p": 20, "c": 40, "g": 12}}}}
      ]
    }}
  ],
  "grocery_list": [{{"item": "Ovos", "qty": "12 unidades"}}, {{"item": "Banana", "qty": "7 unidades"}}],
  "recipes": [
    {{"name": "Frango grelhado com legumes", "ingredients": ["200g peito de frango", "1 abobrinha", "sal e pimenta"], "steps": ["Tempere o frango", "Grelhe 5min cada lado", "Corte a abobrinha e grelhe junto"]}}
  ]
}}"""

    raw = await ai_generate(db, prompt, SYSTEM_PROMPT)

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        data = json.loads(raw[start:end])
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=500, detail="Erro ao processar resposta da IA. Tente novamente.")

    monday = date.today() - timedelta(days=date.today().weekday())
    plan = MealPlan(
        user_id=user.id, week_start=str(monday),
        plan_data=data.get("days", []),
        grocery_list=data.get("grocery_list", []),
        recipes=data.get("recipes", []),
        total_calories=data.get("total_calories"),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    return {"plan": {"id": plan.id, "week_start": plan.week_start, "data": plan.plan_data,
                      "grocery_list": plan.grocery_list, "recipes": plan.recipes,
                      "total_calories": plan.total_calories}}


@router.get("/history")
def meal_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plans = db.query(MealPlan).filter(MealPlan.user_id == user.id).order_by(MealPlan.id.desc()).limit(10).all()
    return [{"id": p.id, "week_start": p.week_start, "total_calories": p.total_calories} for p in plans]
