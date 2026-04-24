from __future__ import annotations

import base64
from contextlib import asynccontextmanager
from pathlib import Path
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Literal

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from storage import Storage


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://skytrainer:skytrainer@db:5432/skytrainer",
)

storage = Storage(DATABASE_URL)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await storage.connect()
    try:
        yield
    finally:
        await storage.close()


app = FastAPI(title="SkyTrainer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_SECRET = "skytrainer-secret"
JWT_ALG = "HS256"
JWT_TTL_SECONDS = 60 * 60 * 24
MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

Skill = Literal["snowboard", "ski"]
Role = Literal["instructor", "user"]
Gender = Literal["male", "female", "other"]


class Review(BaseModel):
    author: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=1000)
    score: int = Field(ge=1, le=5)


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=255)
    role: Role
    skills: list[Skill]
    experience_years: int = Field(ge=0, le=80)
    gender: Gender
    photo_url: str = ""
    has_license: bool | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdateRequest(BaseModel):
    skills: list[Skill] = Field(min_length=1)
    experience_years: int = Field(ge=0, le=80)
    gender: Gender
    photo_url: str = ""
    has_license: bool | None = None


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(f"{data}{padding}")


def _sign(message: str) -> str:
    digest = hmac.new(JWT_SECRET.encode(), message.encode(), hashlib.sha256).digest()
    return _b64url_encode(digest)


def create_jwt(payload: dict) -> str:
    header = {"alg": JWT_ALG, "typ": "JWT"}
    now = int(time.time())
    body = {**payload, "iat": now, "exp": now + JWT_TTL_SECONDS}
    header_encoded = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    body_encoded = _b64url_encode(json.dumps(body, separators=(",", ":")).encode())
    signature = _sign(f"{header_encoded}.{body_encoded}")
    return f"{header_encoded}.{body_encoded}.{signature}"


def decode_jwt(token: str) -> dict:
    try:
        header_encoded, body_encoded, signature = token.split(".")
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token format") from exc

    expected = _sign(f"{header_encoded}.{body_encoded}")
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid token signature")

    body = json.loads(_b64url_decode(body_encoded))
    if int(body.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=401, detail="Token expired")
    return body


def get_storage() -> Storage:
    if storage.users is None:
        raise HTTPException(status_code=503, detail="Storage is not initialized")
    return storage


async def get_current_user(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.replace("Bearer ", "", 1)
    payload = decode_jwt(token)
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = await get_storage().users.get_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def to_public_user(user: dict) -> dict:
    raw_reviews = user.get("reviews", [])
    reviews = [r for r in raw_reviews if isinstance(r, dict) and isinstance(r.get("score"), (int, float))]
    rating = round(sum(r["score"] for r in reviews) / len(reviews), 1) if reviews else 0
    return {
        "email": user["email"],
        "role": user["role"],
        "skills": user["skills"],
        "experience_years": user["experience_years"],
        "gender": user["gender"],
        "photo_url": user["photo_url"],
        "has_license": user["has_license"] if user["role"] == "instructor" else None,
        "rating": rating,
        "reviews": reviews,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/message")
def message() -> dict[str, str]:
    return {"message": "Hello from FastAPI backend"}


@app.post("/uploads/photo")
async def upload_photo(file: UploadFile = File(...)) -> dict:
    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type. Use JPG, PNG, or WEBP.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(content) > MAX_PHOTO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large. Max size is 5 MB.")

    extension = ALLOWED_PHOTO_TYPES[file.content_type]
    filename = f"{secrets.token_hex(16)}{extension}"
    file_path = UPLOADS_DIR / filename
    file_path.write_bytes(content)
    return {"photo_url": f"/uploads/{filename}"}


@app.post("/auth/register")
async def register(payload: RegisterRequest) -> dict:
    users_repo = get_storage().users
    existing_user = await users_repo.get_by_email(payload.email)
    if existing_user:
        raise HTTPException(status_code=409, detail="User already exists")
    if not payload.skills:
        raise HTTPException(status_code=400, detail="Select at least one skill")
    if payload.role == "instructor" and payload.has_license is None:
        raise HTTPException(status_code=400, detail="Instructor must provide license info")
    if payload.role == "user":
        payload.has_license = None

    user = await users_repo.create_user(
        {
            "email": payload.email,
            "password_hash": hash_password(payload.password),
            "role": payload.role,
            "skills": payload.skills,
            "experience_years": payload.experience_years,
            "gender": payload.gender,
            "photo_url": payload.photo_url,
            "has_license": payload.has_license,
            "reviews": [],
        }
    )
    token = create_jwt({"sub": user["email"], "role": user["role"], "skills": user["skills"]})
    return {"access_token": token, "token_type": "bearer", "user": to_public_user(user)}


@app.post("/auth/login")
async def login(payload: LoginRequest) -> dict:
    user = await get_storage().users.get_by_email(payload.email)
    if not user or user["password_hash"] != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt({"sub": user["email"], "role": user["role"], "skills": user["skills"]})
    return {"access_token": token, "token_type": "bearer", "user": to_public_user(user)}


@app.get("/auth/me")
async def me(authorization: str | None = Header(default=None)) -> dict:
    user = await get_current_user(authorization)
    return {"user": to_public_user(user)}


@app.put("/auth/me")
async def update_me(payload: ProfileUpdateRequest, authorization: str | None = Header(default=None)) -> dict:
    user = await get_current_user(authorization)
    if user["role"] == "instructor" and payload.has_license is None:
        raise HTTPException(status_code=400, detail="Instructor must provide license info")
    if user["role"] == "user":
        payload.has_license = None

    updated_user = await get_storage().users.update_profile(
        email=user["email"],
        skills=payload.skills,
        experience_years=payload.experience_years,
        gender=payload.gender,
        photo_url=payload.photo_url,
        has_license=payload.has_license,
    )
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": to_public_user(updated_user)}


@app.post("/users/{email}/reviews")
async def add_review(email: str, review: Review, authorization: str | None = Header(default=None)) -> dict:
    await get_current_user(authorization)
    user = await get_storage().users.add_review(email=email, review=review.model_dump())
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": to_public_user(user)}


@app.get("/users/{email}/reviews")
async def get_reviews(email: str) -> dict:
    user = await get_storage().users.get_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"rating": to_public_user(user)["rating"], "reviews": user["reviews"]}


@app.get("/instructors/free")
async def free_instructors() -> dict:
    users_repo = get_storage().users
    instructors = await users_repo.list_instructors()
    return {"instructors": [to_public_user(user) for user in instructors]}


app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
