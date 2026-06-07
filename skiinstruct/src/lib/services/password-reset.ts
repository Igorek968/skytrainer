import crypto from "crypto";
import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
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

export function buildPasswordResetEnterLink(rawToken: string): string {
  const base = getPasswordResetBaseUrl().replace(/\/+$/, "");
  return `${base}/api/auth/password-reset/enter?token=${encodeURIComponent(rawToken)}&next=reset`;
}

export type PasswordResetUser = {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  image: string | null;
};

/** Проверяет ссылку из письма (токен ещё не использован для смены пароля). */
export async function validatePasswordResetToken(
  rawToken: string,
): Promise<{ ok: true; user: PasswordResetUser } | { ok: false }> {
  const token = rawToken.trim();
  if (token.length < 20) return { ok: false };

  const tokenHash = sha256Hex(token);
  const now = new Date();
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, email: true, role: true, name: true, image: true } },
    },
  });

  if (!record?.user?.id) return { ok: false };
  if (record.usedAt) return { ok: false };
  if (record.expiresAt < now) return { ok: false };

  return { ok: true, user: record.user };
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

