import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ResolvedApiSession = {
  session: Session;
  userId: string;
  role: UserRole;
};

export function isApiErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

/** Роль всегда из БД (JWT в cookie может устареть после смены роли или входа с другого кабинета). */
export async function resolveUserRole(
  userId: string,
  roleFromSession?: UserRole | null,
): Promise<UserRole | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return row?.role ?? roleFromSession ?? null;
}

export async function requireAuthSession(): Promise<ResolvedApiSession | NextResponse> {
  const session = await auth();
  const userId = session?.user?.id?.trim();
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
  }

  const role = await resolveUserRole(userId, session.user.role);
  if (!role) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 403 });
  }

  return { session, userId, role };
}

function instructorForbiddenMessage(role: UserRole): string {
  if (role === "ADMIN") {
    return "Сейчас вы вошли как администратор. Выйдите и войдите как инструктор: /instructor/login";
  }
  if (role === "CLIENT") {
    return "Сейчас вы вошли как клиент. Войдите как инструктор: /instructor/login";
  }
  return "Нет доступа к кабинету инструктора";
}

export async function requireInstructorSession(): Promise<ResolvedApiSession | NextResponse> {
  const resolved = await requireAuthSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const profile = await prisma.instructorProfile.findUnique({
    where: { userId: resolved.userId },
    select: { userId: true },
  });
  if (!profile) {
    return NextResponse.json(
      { error: "Профиль инструктора не найден. Подайте заявку на /instructor/apply" },
      { status: 404 },
    );
  }

  if (resolved.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: instructorForbiddenMessage(resolved.role) }, { status: 403 });
  }
  return resolved;
}

export async function requireAdminSession(): Promise<ResolvedApiSession | NextResponse> {
  const resolved = await requireAuthSession();
  if (isApiErrorResponse(resolved)) return resolved;
  if (resolved.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Нет прав администратора. Войдите через /admin/login" },
      { status: 403 },
    );
  }
  return resolved;
}

function clientForbiddenMessage(role: UserRole): string {
  if (role === "INSTRUCTOR") {
    return "Сейчас вы вошли как инструктор. Выйдите и войдите как клиент: /login";
  }
  if (role === "ADMIN") {
    return "Сейчас вы вошли как администратор. Выйдите и войдите как клиент: /login";
  }
  return "Создавать заказы могут только клиенты";
}

export async function requireClientSession(): Promise<ResolvedApiSession | NextResponse> {
  const resolved = await requireAuthSession();
  if (isApiErrorResponse(resolved)) return resolved;
  if (resolved.role !== "CLIENT") {
    return NextResponse.json({ error: clientForbiddenMessage(resolved.role) }, { status: 403 });
  }
  return resolved;
}

/** Для публичной ленты мероприятий: только id клиента, без обязательного входа. */
export async function resolveOptionalClientUserId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id?.trim();
  if (!userId) return null;
  const role = await resolveUserRole(userId, session?.user?.role);
  return role === "CLIENT" ? userId : null;
}
