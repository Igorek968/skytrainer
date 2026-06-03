import crypto from "crypto";

import {
  buildPasswordResetEmailContent,
  isPasswordResetEmailConfigured,
  passwordResetEmailDefaults,
  sendPasswordResetEmailViaSmtp,
  sendPasswordResetEmailViaWebhook,
} from "@/lib/services/password-reset-email";

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

/** Письмо на email пользователя: SMTP (Beget) или webhook. */
export async function trySendPasswordResetEmail(params: {
  to: string;
  resetLink: string;
}): Promise<boolean> {
  const { from, subject } = passwordResetEmailDefaults();
  const { text, html } = buildPasswordResetEmailContent(params.resetLink);
  const payload = { to: params.to, from, subject, text, html };

  if (await sendPasswordResetEmailViaSmtp(payload)) return true;
  if (await sendPasswordResetEmailViaWebhook(payload)) return true;
  return false;
}

export { isPasswordResetEmailConfigured };

