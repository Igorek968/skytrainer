import nodemailer, { type Transporter } from "nodemailer";

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
  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "uTrainer";
  return {
    from:
      process.env.PASSWORD_RESET_EMAIL_FROM?.trim() ||
      process.env.SMTP_FROM?.trim() ||
      `${appName} <noreply@localhost>`,
    subject:
      process.env.PASSWORD_RESET_EMAIL_SUBJECT?.trim() ||
      `${appName}: восстановление пароля`,
  };
}

function smtpConfigFromEnv(): {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
} | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim() ?? process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;

  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? Number(portRaw) : 465;
  const secure =
    process.env.SMTP_SECURE === "0" || process.env.SMTP_SECURE === "false"
      ? false
      : port === 465 || process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true" || !portRaw;

  return { host, port: Number.isFinite(port) ? port : 465, secure, user, pass };
}

let cachedTransporter: Transporter | null = null;
let cachedKey = "";

function getSmtpTransporter(): Transporter | null {
  const cfg = smtpConfigFromEnv();
  if (!cfg) return null;

  const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
  if (cachedTransporter && cachedKey === key) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  cachedKey = key;
  return cachedTransporter;
}

/** Отправка через SMTP (Beget и др.). */
export async function sendPasswordResetEmailViaSmtp(payload: PasswordResetEmailPayload): Promise<boolean> {
  const transport = getSmtpTransporter();
  if (!transport) return false;

  try {
    await transport.sendMail({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[password-reset] SMTP send failed:", msg);
    if (msg.includes("535") || /invalid login/i.test(msg)) {
      console.error(
        "[password-reset] Проверьте пароль ящика в Beget (Почта → noreply@utrainer.ru) и SKIINSTRUCT_SMTP_PASSWORD в .env.qa",
      );
    }
    return false;
  }
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
