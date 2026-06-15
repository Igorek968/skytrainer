import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import {
  buildPasswordResetEmailContent,
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

export async function verifyEmailToken(rawToken: string): Promise<{ ok: true; email: string } | { ok: false }> {
  const tokenHash = sha256Hex(rawToken.trim());
  const row = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
  if (!row || row.expires.getTime() < Date.now()) {
    if (row) await prisma.verificationToken.delete({ where: { token: tokenHash } }).catch(() => undefined);
    return { ok: false };
  }

  await prisma.user.updateMany({
    where: { email: { equals: row.identifier, mode: "insensitive" } },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { token: tokenHash } });
  return { ok: true, email: row.identifier };
}

export function buildEmailVerificationLink(rawToken: string): string {
  const base = getPasswordResetBaseUrl().replace(/\/+$/, "");
  return `${base}/verify-email?token=${encodeURIComponent(rawToken)}`;
}

export async function sendEmailVerification(email: string): Promise<boolean> {
  if (!isPasswordResetEmailConfigured()) return false;
  const raw = await createEmailVerificationToken(email);
  const link = buildEmailVerificationLink(raw);
  const { from, subject: defaultSubject } = passwordResetEmailDefaults();
  const appName = getPublicProductName();
  const subject = `${appName}: подтвердите email`;
  const { text: baseText, html: baseHtml } = buildPasswordResetEmailContent(link);
  const text = baseText.replace("восстановление пароля", "подтверждение email").replace("Сбросить пароль", "Подтвердить email");
  const html = baseHtml
    .replace("восстановление пароля", "подтверждение email")
    .replace("Сбросить пароль", "Подтвердить email")
    .replace("сброс —", "письмо —");

  const payload = { to: email, from, subject: defaultSubject.includes("восстановление") ? subject : subject, text, html };
  if (await sendPasswordResetEmailViaSmtp(payload)) return true;
  if (await sendPasswordResetEmailViaWebhook(payload)) return true;
  return false;
}

export function isEmailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION === "1";
}
