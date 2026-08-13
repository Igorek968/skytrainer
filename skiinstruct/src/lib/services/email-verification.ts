import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import {
  isPasswordResetEmailConfigured,
  passwordResetEmailDefaults,
  sendPasswordResetEmailViaSmtp,
  sendPasswordResetEmailViaWebhook,
} from "@/lib/services/password-reset-email";
import { getPasswordResetBaseUrl } from "@/lib/services/password-reset";
import { getPublicProductName } from "@/shared/lib/product";

const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function toBase64Url(s: string): string {
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateEmailVerificationToken(): string {
  return toBase64Url(crypto.randomBytes(32).toString("base64"));
}

export async function createEmailVerificationToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const raw = generateEmailVerificationToken();
  const tokenHash = sha256Hex(raw);
  const expires = new Date(Date.now() + VERIFY_TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier: normalized } });
  await prisma.verificationToken.create({
    data: { identifier: normalized, token: tokenHash, expires },
  });

  return raw;
}

export async function verifyEmailToken(
  rawToken: string,
): Promise<{ ok: true; email: string; loginToken: string } | { ok: false }> {
  const tokenHash = sha256Hex(rawToken.trim());
  const row = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
  if (!row || row.expires.getTime() < Date.now()) {
    if (row) await prisma.verificationToken.delete({ where: { token: tokenHash } }).catch(() => undefined);
    return { ok: false };
  }

  // Не трогаем одноразовые токены авто-входа после подтверждения
  if (row.identifier.startsWith("email-login:")) {
    return { ok: false };
  }

  const email = row.identifier.trim().toLowerCase();
  await prisma.user.updateMany({
    where: { email: { equals: email, mode: "insensitive" } },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { token: tokenHash } });

  const loginRaw = generateEmailVerificationToken();
  const loginHash = sha256Hex(loginRaw);
  const loginId = `email-login:${email}`;
  await prisma.verificationToken.deleteMany({ where: { identifier: loginId } });
  await prisma.verificationToken.create({
    data: {
      identifier: loginId,
      token: loginHash,
      expires: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  return { ok: true, email, loginToken: loginRaw };
}

/** Одноразовый вход после клика по ссылке подтверждения email (письма открываются без сессии). */
export async function consumeEmailLoginToken(
  rawToken: string,
): Promise<{ ok: true; userId: string; email: string; role: string } | { ok: false }> {
  const tokenHash = sha256Hex(rawToken.trim());
  const row = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
  if (!row || row.expires.getTime() < Date.now()) {
    if (row) await prisma.verificationToken.delete({ where: { token: tokenHash } }).catch(() => undefined);
    return { ok: false };
  }
  if (!row.identifier.startsWith("email-login:")) {
    return { ok: false };
  }
  const email = row.identifier.slice("email-login:".length).trim().toLowerCase();
  await prisma.verificationToken.delete({ where: { token: tokenHash } }).catch(() => undefined);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, role: true, name: true, image: true },
  });
  if (!user) return { ok: false };
  return { ok: true, userId: user.id, email: user.email, role: user.role };
}

export function buildEmailVerificationLink(rawToken: string): string {
  const base = getPasswordResetBaseUrl().replace(/\/+$/, "");
  return `${base}/verify-email?token=${encodeURIComponent(rawToken)}`;
}

export async function sendEmailVerification(email: string): Promise<boolean> {
  if (!isPasswordResetEmailConfigured()) return false;
  const raw = await createEmailVerificationToken(email);
  const link = buildEmailVerificationLink(raw);
  const { from } = passwordResetEmailDefaults();
  const appName = getPublicProductName();
  const subject = `${appName}: подтвердите email`;
  const text = [
    "Здравствуйте!",
    "",
    `Вы указали этот email на ${appName}. Чтобы открыть кабинет и полный доступ, подтвердите адрес:`,
    link,
    "",
    "Ссылка действует 48 часов. Если вы не регистрировались — просто удалите письмо.",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="ru">
<body style="font-family:sans-serif;line-height:1.5;color:#111">
  <p>Здравствуйте!</p>
  <p>Вы указали этот email на <strong>${appName}</strong>. Подтвердите адрес — после этого откроется кабинет.</p>
  <p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#027676;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Подтвердить email</a></p>
  <p style="font-size:13px;color:#555">Или скопируйте ссылку:<br/><a href="${link}">${link}</a></p>
  <p style="font-size:13px;color:#555">Ссылка действует 48 часов. Если вы не регистрировались — удалите это письмо.</p>
</body>
</html>`;

  const payload = { to: email, from, subject, text, html };
  if (await sendPasswordResetEmailViaSmtp(payload)) return true;
  if (await sendPasswordResetEmailViaWebhook(payload)) return true;
  return false;
}

export function isEmailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION === "1";
}

export const EMAIL_NOT_VERIFIED_MESSAGE =
  "Подтвердите email по ссылке из письма. Без этого оплата и важные действия недоступны.";

/**
 * Если REQUIRE_EMAIL_VERIFICATION=1 и у пользователя emailVerified пустой — вернуть текст ошибки.
 * Иначе null.
 */
export async function assertUserEmailVerified(userId: string): Promise<string | null> {
  if (!isEmailVerificationRequired()) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  if (!user) return "Пользователь не найден";
  if (user.emailVerified) return null;
  return EMAIL_NOT_VERIFIED_MESSAGE;
}

