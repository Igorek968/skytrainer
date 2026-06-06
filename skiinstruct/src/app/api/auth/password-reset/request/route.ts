import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  generatePasswordResetToken,
  getPasswordResetBaseUrl,
  sha256Hex,
  isPasswordResetEmailConfigured,
  trySendPasswordResetEmail,
} from "@/lib/services/password-reset";

const requestSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`password-reset:request:${ip}`, 6, 60_000)) {
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

  const email = parsed.data.email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });

  // Не раскрываем существование аккаунтов.
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = generatePasswordResetToken();
  const tokenHash = sha256Hex(token);

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
  });

  const baseUrl = getPasswordResetBaseUrl();
  const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const sent = await trySendPasswordResetEmail({ to: email, resetLink });
  if (!sent && process.env.NODE_ENV === "production") {
    console.error(
      "[password-reset] письмо не отправлено: задайте SMTP_HOST, SMTP_USER, SMTP_PASSWORD (Beget) или PASSWORD_RESET_EMAIL_WEBHOOK_URL",
    );
  }
  const allowDebugLink =
    process.env.NODE_ENV !== "production" &&
    (process.env.SKIINSTRUCT_PASSWORD_RESET_DEBUG === "1" ||
      (!isPasswordResetEmailConfigured() && !sent));
  const debugToken = !sent && allowDebugLink ? token : undefined;

  return NextResponse.json({ ok: true, sent, debugToken, resetLink: debugToken ? resetLink : undefined });
}

