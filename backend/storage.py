from __future__ import annotations

import json
from typing import Any

import asyncpg


class UsersRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def create_table(self) -> None:
        query = """
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            skills JSONB NOT NULL,
            experience_years INTEGER NOT NULL,
            gender TEXT NOT NULL,
            photo_url TEXT NOT NULL DEFAULT '',
            has_license BOOLEAN,
            reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
        async with self._pool.acquire() as conn:
            await conn.execute(query)

    async def get_by_email(self, email: str) -> dict[str, Any] | None:
        query = """
        SELECT
            email,
            password_hash,
            role,
            skills,
            experience_years,
            gender,
            photo_url,
            has_license,
            reviews
        FROM users
        WHERE email = $1;
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, email)
        return self._normalize_row(row)

    async def create_user(self, user: dict[str, Any]) -> dict[str, Any]:
        query = """
        INSERT INTO users (
            email,
            password_hash,
            role,
            skills,
            experience_years,
            gender,
            photo_url,
            has_license,
            reviews
        )
        VALUES (
            $1,
            $2,
            $3,
            $4::jsonb,
            $5,
            $6,
            $7,
            $8,
            $9::jsonb
        )
        RETURNING
            email,
            password_hash,
            role,
            skills,
            experience_years,
            gender,
            photo_url,
            has_license,
            reviews;
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                user["email"],
                user["password_hash"],
                user["role"],
                json.dumps(user["skills"]),
                user["experience_years"],
                user["gender"],
                user["photo_url"],
                user["has_license"],
                json.dumps(user.get("reviews", [])),
            )
        if row is None:
            raise RuntimeError("Failed to create user")
        return self._normalize_row(row)

    async def update_profile(
        self,
        *,
        email: str,
        skills: list[str],
        experience_years: int,
        gender: str,
        photo_url: str,
        has_license: bool | None,
    ) -> dict[str, Any] | None:
        query = """
        UPDATE users
        SET
            skills = $2::jsonb,
            experience_years = $3,
            gender = $4,
            photo_url = $5,
            has_license = $6,
            updated_at = NOW()
        WHERE email = $1
        RETURNING
            email,
            password_hash,
            role,
            skills,
            experience_years,
            gender,
            photo_url,
            has_license,
            reviews;
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                email,
                json.dumps(skills),
                experience_years,
                gender,
                photo_url,
                has_license,
            )
        return self._normalize_row(row)

    async def add_review(self, *, email: str, review: dict[str, Any]) -> dict[str, Any] | None:
        query = """
        UPDATE users
        SET
            reviews = $2::jsonb || reviews,
            updated_at = NOW()
        WHERE email = $1
        RETURNING
            email,
            password_hash,
            role,
            skills,
            experience_years,
            gender,
            photo_url,
            has_license,
            reviews;
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, email, json.dumps([review]))
        return self._normalize_row(row)

    @staticmethod
    def _normalize_row(row: asyncpg.Record | None) -> dict[str, Any] | None:
        if row is None:
            return None
        data = dict(row)
        data["skills"] = UsersRepository._normalize_json_array(data.get("skills"))
        data["reviews"] = UsersRepository._normalize_json_array(data.get("reviews"))
        return data

    @staticmethod
    def _normalize_json_array(value: Any) -> list[Any]:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                return []
            return parsed if isinstance(parsed, list) else []
        return []


class Storage:
    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._pool: asyncpg.Pool | None = None
        self.users: UsersRepository | None = None

    async def connect(self) -> None:
        self._pool = await asyncpg.create_pool(dsn=self._dsn, min_size=1, max_size=10)
        self.users = UsersRepository(self._pool)
        await self.users.create_table()

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None
            self.users = None
