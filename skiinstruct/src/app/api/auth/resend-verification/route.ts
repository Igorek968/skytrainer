import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAuthSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { sendEmailVerification } from "@/lib/services/email-verification";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Повторная отправка письма подтверждения — клиент и инструктор. */
export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`resend-verify:${ip}`, 5, 3600_000)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const auth = await requireAuthSession();
  if (isApiErrorResponse(auth)) return auth;

  if (auth.role !== "CLIENT" && auth.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Недоступно для этой роли" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const sent = await sendEmailVerification(user.email);
  if (!sent) {
    return NextResponse.json({ error: "SMTP не настроен для отправки писем" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
