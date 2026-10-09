from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    onboarding_done = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    meal_plans = relationship("MealPlan", back_populates="user", cascade="all, delete-orphan")
    workouts = relationship("Workout", back_populates="user", cascade="all, delete-orphan")
    checkins = relationship("WorkoutCheckin", back_populates="user", cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    age = Column(Integer)
    gender = Column(String)
    height_cm = Column(Float)
    weight_kg = Column(Float)
    goal = Column(String)  # perder_peso, ganhar_massa, manter, definir
    activity_level = Column(String)  # sedentario, leve, moderado, intenso
    body_fat_pct = Column(Float)
    muscle_mass_kg = Column(Float)
    water_pct = Column(Float)
    bone_mass_kg = Column(Float)
    bmr = Column(Float)
    visceral_fat = Column(Integer)
    medical_notes = Column(Text)
    injuries = Column(Text)
    protein_preference = Column(String)  # frango, carne, peixe, ovo, vegano
    dietary_restrictions = Column(Text)
    measurements = Column(JSON)  # {chest, waist, hip, arm, thigh, calf}
    progress_photos = Column(JSON)  # [{date, url}]
    weight_history = Column(JSON)  # [{date, weight}]
    avatar_url = Column(String)
    meal_times = Column(JSON)  # {cafe, lanche1, almoco, lanche2, jantar, ceia}
    water_log = Column(JSON)  # {"YYYY-MM-DD": litros}
    target_weight = Column(Float)
    onboarding = Column(JSON)  # respostas completas do onboarding

    user = relationship("User", back_populates="profile")


class MealPlan(Base):
    __tablename__ = "meal_plans"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_start = Column(String, nullable=False)
    plan_data = Column(JSON, nullable=False)  # {days: [{meals: [{name, foods, macros}]}]}
    grocery_list = Column(JSON)
    recipes = Column(JSON)
    grocery_checked = Column(JSON)  # [nomes dos itens comprados]
    day_recipes = Column(JSON)  # {"Quarta": [{meal_idx, name, prep_min, ingredients, steps, tip}]}
    total_calories = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="meal_plans")


class Workout(Base):
    __tablename__ = "workouts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_start = Column(String, nullable=False)
    plan_data = Column(JSON, nullable=False)  # {days: [{name, exercises: [{name, sets, reps, rest}]}]}
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="workouts")


class WorkoutCheckin(Base):
    __tablename__ = "workout_checkins"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    workout_id = Column(Integer, ForeignKey("workouts.id"))
    date = Column(String, nullable=False)
    day_name = Column(String)
    exercises_done = Column(JSON)  # [{name, sets_done, reps_done, form_score}]
    notes = Column(Text)
    duration_min = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="checkins")


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    workout_id = Column(Integer, ForeignKey("workouts.id"))
    checkin_id = Column(Integer, ForeignKey("workout_checkins.id"))
    date = Column(String, nullable=False)
    day_idx = Column(Integer, nullable=False)
    day_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="em_andamento")  # em_andamento, finalizado
    state = Column(JSON)  # {current, restUntil, start, sets: [[{done, skipped, reps, kg}]]}
    events = Column(JSON)  # [{type, at, detail}]
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    finished_at = Column(DateTime)


class MealLog(Base):
    __tablename__ = "meal_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    meal_plan_id = Column(Integer, ForeignKey("meal_plans.id"))
    date = Column(String, nullable=False)
    meal_idx = Column(Integer, nullable=False)
    meal_name = Column(String, nullable=False)
    mode = Column(String, nullable=False)  # conforme, ajustada, foto, pulada
    eaten_at = Column(DateTime)  # momento em que a refeição foi registrada
    planned_calories = Column(Integer)
    calories = Column(Integer)
    macros = Column(JSON)  # {p, c, g}
    foods = Column(JSON)  # [str]
    photo_url = Column(String)
    ai_analysis = Column(JSON)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DietExpense(Base):
    __tablename__ = "diet_expenses"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    meal_plan_id = Column(Integer, ForeignKey("meal_plans.id"))
    date = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    store = Column(String)
    items_count = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Challenge(Base):
    __tablename__ = "challenges"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    scoring = Column(String, nullable=False, default="dias")  # dias, treinos, minutos
    invite_code = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ChallengeMember(Base):
    __tablename__ = "challenge_members"
    id = Column(Integer, primary_key=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ChallengeMessage(Base):
    __tablename__ = "challenge_messages"
    id = Column(Integer, primary_key=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class CameraSession(Base):
    __tablename__ = "camera_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    exercise = Column(String, nullable=False)
    source = Column(String, nullable=False)  # camera, video, servidor
    reps = Column(Integer, default=0)
    left_reps = Column(Integer)
    right_reps = Column(Integer)
    hold_seconds = Column(Float)
    form_score = Column(Integer)
    duration_sec = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AdminSettings(Base):
    __tablename__ = "admin_settings"
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text, nullable=False)
