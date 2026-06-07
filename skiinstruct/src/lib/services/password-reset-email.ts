import nodemailer from "nodemailer";

export type PasswordResetEmailPayload = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
};

export function buildPasswordResetEmailContent(resetLink: string): { text: string; html: string } {
  const text = [
    "Здравствуйте!",
    "",
    "Вы запросили восстановление пароля. Перейдите по ссылке:",
    resetLink,
    "",
    "Ссылка действительна 1 час. Если вы не запрашивали сброс — проигнорируйте письмо.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="ru">
<body style="font-family:sans-serif;line-height:1.5;color:#111">
  <p>Здравствуйте!</p>
  <p>Вы запросили восстановление пароля для аккаунта в сервисе. Нажмите кнопку:</p>
  <p><a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Сбросить пароль</a></p>
  <p style="font-size:13px;color:#555">Или скопируйте ссылку: <a href="${resetLink}">${resetLink}</a></p>
  <p style="font-size:13px;color:#555">Ссылка действительна 1 час. Если вы не запрашивали сброс — удалите это письмо.</p>
</body>
</html>`;

  return { text, html };
}

export function passwordResetEmailDefaults(): { from: string; subject: string } {
  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "UTrainer";
  return {
    from:
      process.env.PASSWORD_RESET_EMAIL_FROM?.trim() ||
      process.env.SMTP_FROM?.trim() ||
      `${appName} <noreply@localhost>`,
    subject:
      process.env.PASSWORD_RESET_EMAIL_SUBJECT?.trim() ||
      "восстановление пароля на UTrainer",
  };
}

/** Убирает кавычки из значений .env: PASSWORD="secret" → secret */
function envSecret(value: string | undefined): string {
  const v = value?.trim() ?? "";
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function smtpConfigFromEnv(): {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  requireTLS?: boolean;
} | null {
  const host = process.env.SMTP_HOST?.trim() ?? "smtp.beget.com";
  const user = envSecret(process.env.SMTP_USER);
  const pass = envSecret(process.env.SMTP_PASSWORD) || envSecret(process.env.SMTP_PASS);
  if (!user || !pass) return null;

  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? Number(portRaw) : 465;
  const secure =
    process.env.SMTP_SECURE === "0" || process.env.SMTP_SECURE === "false"
      ? false
      : port === 465 || process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true" || !portRaw;

  const requireTLS = !secure && (port === 587 || port === 2525);

  return {
    host,
    port: Number.isFinite(port) ? port : 465,
    secure,
    user,
    pass,
    ...(requireTLS ? { requireTLS: true } : {}),
  };
}

const BEGET_SMTP_FALLBACK_PORTS: Array<{ port: number; secure: boolean; requireTLS?: boolean }> = [
  { port: 465, secure: true },
  { port: 2525, secure: false, requireTLS: true },
];

/** Отправка через SMTP (Beget и др.). При ошибке на 465 пробует 2525 (Beget). */
export async function sendPasswordResetEmailViaSmtp(payload: PasswordResetEmailPayload): Promise<boolean> {
  const base = smtpConfigFromEnv();
  if (!base) return false;

  const attempts =
    base.host.includes("beget.com")
      ? BEGET_SMTP_FALLBACK_PORTS.map((p) => ({ ...base, ...p }))
      : [base];

  for (const cfg of attempts) {
    try {
      const transport = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        requireTLS: cfg.requireTLS,
        auth: { user: cfg.user, pass: cfg.pass },
      });
      await transport.sendMail({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        text: { content: payload.text, charset: "utf-8" },
        html: { content: payload.html, charset: "utf-8" },
        headers: {
          "Content-Type": 'text/html; charset="UTF-8"',
        },
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[password-reset] SMTP ${cfg.host}:${cfg.port} failed:`, msg);
      if (msg.includes("535") || /invalid login/i.test(msg)) {
        console.error(
          "[password-reset] Логин/пароль SMTP: полный email и пароль ящика из Beget (веб-почта = тот же пароль).",
        );
      }
    }
  }
  return false;
}

/** Отправка через внешний webhook (legacy). */
export async function sendPasswordResetEmailViaWebhook(payload: PasswordResetEmailPayload): Promise<boolean> {
  const webhookUrl = process.env.PASSWORD_RESET_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) return false;

  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: payload.to,
        from: payload.from,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      }),
    });
    return r.ok;
  } catch (e) {
    console.error("[password-reset] webhook failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

export function isPasswordResetEmailConfigured(): boolean {
  return Boolean(smtpConfigFromEnv() || process.env.PASSWORD_RESET_EMAIL_WEBHOOK_URL?.trim());
}
