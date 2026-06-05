import { NextResponse } from "next/server";
import { z } from "zod";

import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeRussianPhone } from "@/lib/phone";
import { createPhoneOtpChallenge, generateSixDigitOtp } from "@/lib/phone-otp";
import { sendLoginOtpSms, shouldReturnDevOtpInApi } from "@/lib/sms/send-login-otp";

const bodySchema = z.object({
  phone: z.string().min(10).max(20),
  name: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`phone-otp:${ip}`, 8, 3600_000)) {
    return NextResponse.json({ error: "Слишком много запросов. Попробуйте позже." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Укажите номер телефона" }, { status: 400 });
  }

  const phoneNorm = normalizeRussianPhone(parsed.data.phone);
  if (!phoneNorm) {
    return NextResponse.json({ error: "Некорректный номер телефона" }, { status: 400 });
  }

  const code = generateSixDigitOtp();
  await createPhoneOtpChallenge({
    phoneNorm,
    code,
    pendingName: parsed.data.name?.trim() || null,
  });

  const sms = await sendLoginOtpSms(phoneNorm, code);
  if (!sms.ok && !shouldReturnDevOtpInApi()) {
    return NextResponse.json({ error: sms.error }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    ...(shouldReturnDevOtpInApi() ? { devCode: code } : {}),
  });
}
