import { NextResponse } from "next/server";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { sendEmailVerification } from "@/lib/services/email-verification";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`resend-verify:${ip}`, 5, 3600_000)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const auth = await requireClientSession();
  if (isApiErrorResponse(auth)) return auth;

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
