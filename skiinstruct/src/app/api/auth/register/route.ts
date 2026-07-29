import { NextResponse } from "next/server";

import { createClientUser } from "@/lib/client-registration";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

/** Публичная регистрация клиента по email (роль CLIENT). */
export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`register:${ip}`, 12, 3600_000)) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const passwordConfirm = typeof b.passwordConfirm === "string" ? b.passwordConfirm : undefined;
  const name = typeof b.name === "string" ? b.name : undefined;
  const captchaToken = typeof b.captchaToken === "string" ? b.captchaToken : "";

  if (email && !rateLimit(`register:${ip}:${email}`, 6, 3600_000)) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 });
  }
  const humanOk = await verifyTurnstileToken(captchaToken, ip);
  if (!humanOk) {
    return NextResponse.json({ error: "Подтвердите, что вы не робот." }, { status: 400 });
  }

  const result = await createClientUser({ email, password, passwordConfirm, name });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, email: result.email });
}
