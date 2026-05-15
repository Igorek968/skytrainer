/**
 * Отправка SMS с кодом входа. Подключение:
 * - Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (E.164, напр. +15551234567)
 * - Или POST JSON на SMS_WEBHOOK_URL: { "to": "+79991234567", "text": "..." }
 *
 * Режим без реальной SMS (код в JSON ответа send-code и в toast на клиенте):
 * - SMS_OTP_MOCK=1 — всегда, даже в production (только для отладки на стенде)
 * - SMS_OTP_DEBUG=1 / true — то же
 * - NODE_ENV=development — мок (код в ответе), даже если в .env стоит SMS_OTP_DEBUG=0
 * Чтобы в development слать настоящие SMS: задайте SMS_OTP_REQUIRE_REAL=1 и настройте TWILIO_* или SMS_WEBHOOK_URL.
 *
 * Если SMS не настроен и NODE_ENV не production — тоже мок (удобно для next start / локальной сборки).
 */

function toE164Ru(phoneNorm11: string): string {
  if (phoneNorm11.length === 11 && phoneNorm11.startsWith("7")) return `+${phoneNorm11}`;
  return `+${phoneNorm11}`;
}

async function sendViaTwilio(to: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!sid || !token || !from) return { ok: false, error: "Twilio не настроен" };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", from);
  form.set("Body", body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: t.slice(0, 200) || `Twilio HTTP ${res.status}` };
  }
  return { ok: true };
}

async function sendViaWebhook(to: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const hook = process.env.SMS_WEBHOOK_URL?.trim();
  if (!hook) return { ok: false, error: "SMS_WEBHOOK_URL не задан" };
  const res = await fetch(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, text: body }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: t.slice(0, 200) || `Webhook HTTP ${res.status}` };
  }
  return { ok: true };
}

export type SendLoginOtpSmsOutcome =
  | { ok: true; channel: "twilio" | "webhook" | "none" }
  | { ok: false; channel: "twilio" | "webhook" | "config"; error: string };

function envTruthy(v: string | undefined): boolean {
  return v === "1" || v === "true" || v === "yes";
}

function envFalsy(v: string | undefined): boolean {
  return v === "0" || v === "false" || v === "no";
}

export function hasSmsProviderConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() || process.env.SMS_WEBHOOK_URL?.trim());
}

/**
 * Не вызывать SMS-шлюз; код вернуть в ответе send-code (отладка / локальный запуск без Twilio).
 */
export function shouldReturnDevOtpInApi(): boolean {
  if (process.env.SMS_OTP_REQUIRE_REAL === "1") return false;
  if (envTruthy(process.env.SMS_OTP_MOCK)) return true;
  if (envTruthy(process.env.SMS_OTP_DEBUG)) return true;
  if (process.env.NODE_ENV === "development") return true;
  if (envFalsy(process.env.SMS_OTP_DEBUG)) return false;
  if (process.env.NODE_ENV !== "production" && !hasSmsProviderConfigured()) return true;
  return false;
}

export async function sendLoginOtpSms(phoneNorm11: string, code: string): Promise<SendLoginOtpSmsOutcome> {
  const to = toE164Ru(phoneNorm11);
  const body = `SkiInstruct: код входа ${code}. Действует 10 минут.`;

  if (shouldReturnDevOtpInApi()) {
    return { channel: "none", ok: true };
  }

  if (process.env.TWILIO_ACCOUNT_SID?.trim()) {
    const r = await sendViaTwilio(to, body);
    return r.ok ? { channel: "twilio", ok: true } : { channel: "twilio", ok: false, error: r.error };
  }

  if (process.env.SMS_WEBHOOK_URL?.trim()) {
    const r = await sendViaWebhook(to, body);
    return r.ok ? { channel: "webhook", ok: true } : { channel: "webhook", ok: false, error: r.error };
  }

  return {
    ok: false,
    channel: "config",
    error:
      "SMS не настроен: задайте TWILIO_* или SMS_WEBHOOK_URL; на localhost без провайдера код в API; иначе SMS_OTP_MOCK=1.",
  };
}
