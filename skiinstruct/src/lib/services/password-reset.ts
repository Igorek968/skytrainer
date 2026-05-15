import crypto from "crypto";

function toBase64Url(s: string): string {
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Длинный URL-safe токен для ссылки.
 * Сохраняем только хеш, сырой токен уходит пользователю.
 */
export function generatePasswordResetToken(): string {
  const buf = crypto.randomBytes(32); // ~256 бит энтропии
  return toBase64Url(buf.toString("base64"));
}

export function getPasswordResetBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  );
}

/**
 * Отправка email через внешний вебхук (чтобы не тащить SMTP/провайдер в код).
 *
 * Ожидается, что ваш сервис обработает POST JSON:
 * { to, subject, text, html }
 */
export async function trySendPasswordResetEmail(params: {
  to: string;
  resetLink: string;
}): Promise<boolean> {
  const webhookUrl = process.env.PASSWORD_RESET_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) return false;

  const subject = process.env.PASSWORD_RESET_EMAIL_SUBJECT?.trim() ?? "SkiInstruct: восстановление пароля";
  const from = process.env.PASSWORD_RESET_EMAIL_FROM?.trim() ?? "SkiInstruct <no-reply@skiinstruct.local>";

  const resetCode = params.resetLink;
  const text = `Здравствуйте! Используйте ссылку для восстановления пароля:\n${resetCode}\n\nСсылка действительна ограниченное время.`;
  const html = `<p>Здравствуйте!</p><p>Используйте ссылку для восстановления пароля:</p><p><a href="${resetCode}">${resetCode}</a></p><p>Ссылка действительна ограниченное время.</p>`;

  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: params.to,
        from,
        subject,
        text,
        html,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

