import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAuthSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { assertRussianEmail } from "@/lib/russian-email";
import { sendEmailVerification } from "@/lib/services/email-verification";

const bodySchema = z.object({
  email: z.string().trim().email("Укажите корректный email").max(254),
});

/**
 * Смена email, пока адрес ещё не подтверждён (окно после регистрации).
 * Клиент — любой валидный email; инструктор — только российские домены.
 */
export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`change-unverified-email:${ip}`, 8, 3600_000)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const auth = await requireAuthSession();
  if (isApiErrorResponse(auth)) return auth;

  if (auth.role !== "CLIENT" && auth.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Недоступно для этой роли" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Укажите корректный email" },
      { status: 400 },
    );
  }

  const nextEmail = parsed.data.email.trim().toLowerCase();

  if (auth.role === "INSTRUCTOR") {
    const ruErr = assertRussianEmail(nextEmail);
    if (ruErr) {
      return NextResponse.json({ error: ruErr }, { status: 400 });
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (user.emailVerified) {
    return NextResponse.json(
      { error: "Email уже подтверждён — сменить его здесь нельзя" },
      { status: 400 },
    );
  }

  const current = user.email.trim().toLowerCase();
  if (nextEmail === current) {
    return NextResponse.json({ error: "Это уже ваш текущий email" }, { status: 400 });
  }

  const taken = await prisma.user.findFirst({
    where: {
      email: { equals: nextEmail, mode: "insensitive" },
      NOT: { id: user.id },
    },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ error: "Этот email уже занят" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.verificationToken.deleteMany({
      where: {
        OR: [{ identifier: current }, { identifier: nextEmail }, { identifier: `email-login:${current}` }],
      },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { email: nextEmail, emailVerified: null },
    });
  });

  const sent = await sendEmailVerification(nextEmail);
  if (!sent) {
    return NextResponse.json(
      {
        ok: true,
        email: nextEmail,
        warning: "Email сохранён, но письмо не отправлено — проверьте SMTP или нажмите «Выслать ещё раз»",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, email: nextEmail });
}
