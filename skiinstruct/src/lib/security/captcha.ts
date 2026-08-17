type SmartCaptchaValidateResponse = {
  status?: string;
  message?: string;
  host?: string;
};

const VALIDATE_URL = "https://smartcaptcha.cloud.yandex.ru/validate";

function serverKey(): string {
  return process.env.SMARTCAPTCHA_SERVER_KEY?.trim() || "";
}

function clientKeyConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY?.trim());
}

/**
 * Капча обязательна, если задан серверный ключ Яндекс SmartCaptcha
 * или CAPTCHA_REQUIRED / SMARTCAPTCHA_REQUIRED=1.
 * Без ключей — пропускаем (сайт не блокируем).
 */
export function isCaptchaEnforced(): boolean {
  if (process.env.ALLOW_SKIP_CAPTCHA === "1" || process.env.ALLOW_SKIP_TURNSTILE === "1") {
    return false;
  }
  if (serverKey()) return true;
  if (process.env.CAPTCHA_REQUIRED === "1" || process.env.SMARTCAPTCHA_REQUIRED === "1") {
    return true;
  }
  if (clientKeyConfigured() && !serverKey()) return true;
  return false;
}

/** Токен из FormData: Яндекс пишет smart-token, наши формы — captchaToken. */
export function captchaTokenFromFormData(formData: FormData): string {
  const a = String(formData.get("captchaToken") ?? "").trim();
  if (a) return a;
  return String(formData.get("smart-token") ?? "").trim();
}

/**
 * Проверка Яндекс SmartCaptcha.
 * При HTTP-ошибке validate (по доке Яндекса) — пропускаем, чтобы не ломать сайт.
 */
export async function verifyCaptchaToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<boolean> {
  const secret = serverKey();
  if (!secret) {
    if (isCaptchaEnforced()) {
      console.error("[smartcaptcha] SMARTCAPTCHA_SERVER_KEY missing — rejecting (fail-closed)");
      return false;
    }
    return true;
  }

  const trimmed = token?.trim() || "";
  if (!trimmed) return false;

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("token", trimmed);
    if (remoteIp?.trim() && remoteIp !== "unknown") {
      form.set("ip", remoteIp.trim());
    }

    const res = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });

    // Документация Яндекса: при сбое validate лучше не блокировать пользователя.
    if (!res.ok) {
      console.error("[smartcaptcha] validate HTTP", res.status);
      return true;
    }

    const json = (await res.json().catch(() => null)) as SmartCaptchaValidateResponse | null;
    return json?.status === "ok";
  } catch (e) {
    console.error("[smartcaptcha] validate error", e);
    return true;
  }
}

/** @deprecated alias — старые импорты Turnstile */
export const isTurnstileEnforced = isCaptchaEnforced;
/** @deprecated alias */
export const verifyTurnstileToken = verifyCaptchaToken;
