from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.database import init_db
from app.routers import auth_router, profile_router, nutrition_router, workout_router, admin_router, exercises_router, challenges_router
from app.auth import hash_password
from app.database import SessionLocal
from app.models.models import User, Profile

app = FastAPI(title="FitCoach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(profile_router.router)
app.include_router(nutrition_router.router)
app.include_router(workout_router.router)
app.include_router(admin_router.router)
app.include_router(exercises_router.router)
app.include_router(challenges_router.router)

uploads_dir = Path(__file__).parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.on_event("startup")
def startup():
    init_db()
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == "admin@fitcoach.com").first():
            admin = User(
                email="admin@fitcoach.com",
                hashed_password=hash_password("admin123"),
                name="Administrador",
                is_admin=True,
                onboarding_done=True,
            )
            db.add(admin)
            db.flush()
            db.add(Profile(user_id=admin.id))
            db.commit()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}
