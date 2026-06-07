import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sha256Hex } from "@/lib/services/password-reset";

const requestSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  // Подтверждение обычно идёт по ссылке “анонимно”.
  // (Авторизация не обязательна.)

  const ip = clientIp(req.headers);
  if (!rateLimit(`password-reset:confirm:${ip}`, 6, 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { token, newPassword } = parsed.data;
  const tokenHash = sha256Hex(token);
  const now = new Date();

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, role: true } } },
  });

  if (!record?.user?.id) {
    return NextResponse.json({ error: "Ссылка недействительна" }, { status: 400 });
  }
  if (record.usedAt) {
    return NextResponse.json({ error: "Ссылка уже использована" }, { status: 400 });
  }
  if (record.expiresAt < now) {
    return NextResponse.json({ error: "Ссылка просрочена" }, { status: 400 });
  }

  const passwordHash = await hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });
    await tx.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt: now },
    });
    // Чтобы повторное использование токена было невозможно, удаляем остальные токены пользователя.
    await tx.passwordResetToken.deleteMany({
      where: { userId: record.userId, tokenHash: { not: tokenHash } },
    });
  });

  return NextResponse.json({ ok: true, role: record.user.role });
}

