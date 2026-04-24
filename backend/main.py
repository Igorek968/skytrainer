from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Literal

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="SkyTrainer API")

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


class UserRecord(BaseModel):
    email: str
    password_hash: str
    role: Role
    skills: list[Skill]
    experience_years: int
    gender: Gender
    photo_url: str
    has_license: bool | None
    reviews: list[Review] = Field(default_factory=list)


class ProfileUpdateRequest(BaseModel):
    skills: list[Skill] = Field(min_length=1)
    experience_years: int = Field(ge=0, le=80)
    gender: Gender
    photo_url: str = ""
    has_license: bool | None = None


users_db: dict[str, UserRecord] = {}


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


def get_current_user(authorization: str | None) -> UserRecord:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.replace("Bearer ", "", 1)
    payload = decode_jwt(token)
    email = payload.get("sub")
    if not email or email not in users_db:
        raise HTTPException(status_code=401, detail="User not found")
    return users_db[email]


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def to_public_user(user: UserRecord) -> dict:
    rating = round(sum(r.score for r in user.reviews) / len(user.reviews), 1) if user.reviews else 0
    return {
        "email": user.email,
        "role": user.role,
        "skills": user.skills,
        "experience_years": user.experience_years,
        "gender": user.gender,
        "photo_url": user.photo_url,
        "has_license": user.has_license if user.role == "instructor" else None,
        "rating": rating,
        "reviews": [review.model_dump() for review in user.reviews],
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/message")
def message() -> dict[str, str]:
    return {"message": "Hello from FastAPI backend"}


@app.post("/auth/register")
def register(payload: RegisterRequest) -> dict:
    if payload.email in users_db:
        raise HTTPException(status_code=409, detail="User already exists")
    if not payload.skills:
        raise HTTPException(status_code=400, detail="Select at least one skill")
    if payload.role == "instructor" and payload.has_license is None:
        raise HTTPException(status_code=400, detail="Instructor must provide license info")
    if payload.role == "user":
        payload.has_license = None

    user = UserRecord(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        skills=payload.skills,
        experience_years=payload.experience_years,
        gender=payload.gender,
        photo_url=payload.photo_url,
        has_license=payload.has_license,
    )
    users_db[user.email] = user
    token = create_jwt({"sub": user.email, "role": user.role, "skills": user.skills})
    return {"access_token": token, "token_type": "bearer", "user": to_public_user(user)}


@app.post("/auth/login")
def login(payload: LoginRequest) -> dict:
    user = users_db.get(payload.email)
    if not user or user.password_hash != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt({"sub": user.email, "role": user.role, "skills": user.skills})
    return {"access_token": token, "token_type": "bearer", "user": to_public_user(user)}


@app.get("/auth/me")
def me(authorization: str | None = Header(default=None)) -> dict:
    user = get_current_user(authorization)
    return {"user": to_public_user(user)}


@app.put("/auth/me")
def update_me(payload: ProfileUpdateRequest, authorization: str | None = Header(default=None)) -> dict:
    user = get_current_user(authorization)
    if user.role == "instructor" and payload.has_license is None:
        raise HTTPException(status_code=400, detail="Instructor must provide license info")
    if user.role == "user":
        payload.has_license = None

    user.skills = payload.skills
    user.experience_years = payload.experience_years
    user.gender = payload.gender
    user.photo_url = payload.photo_url
    user.has_license = payload.has_license
    return {"user": to_public_user(user)}


@app.post("/users/{email}/reviews")
def add_review(email: str, review: Review, authorization: str | None = Header(default=None)) -> dict:
    get_current_user(authorization)
    user = users_db.get(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.reviews.insert(0, review)
    return {"user": to_public_user(user)}


@app.get("/users/{email}/reviews")
def get_reviews(email: str) -> dict:
    user = users_db.get(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"rating": to_public_user(user)["rating"], "reviews": [r.model_dump() for r in user.reviews]}
