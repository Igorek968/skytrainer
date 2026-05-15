import { createHash, randomInt, timingSafeEqual } from "crypto";

import { prisma } from "@/lib/prisma";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 8;

function pepper(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "skiinstruct-phone-otp-dev";
}

export function hashPhoneOtp(phoneNorm: string, code: string): string {
  const normalizedCode = code.replace(/\s/g, "");
  return createHash("sha256")
    .update(`${pepper()}\n${phoneNorm}\n${normalizedCode}`)
    .digest("hex");
}

export function verifyPhoneOtpHash(phoneNorm: string, code: string, storedHash: string): boolean {
  const next = hashPhoneOtp(phoneNorm, code);
  try {
    const a = Buffer.from(next, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function generateSixDigitOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function createPhoneOtpChallenge(input: {
  phoneNorm: string;
  code: string;
  pendingName: string | null;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const codeHash = hashPhoneOtp(input.phoneNorm, input.code);
  await prisma.phoneOtpChallenge.upsert({
    where: { phoneNorm: input.phoneNorm },
    create: {
      phoneNorm: input.phoneNorm,
      codeHash,
      pendingName: input.pendingName,
      expiresAt,
      verifyAttempts: 0,
    },
    update: {
      codeHash,
      pendingName: input.pendingName,
      expiresAt,
      verifyAttempts: 0,
    },
  });
}

export type ConsumePhoneOtpResult =
  | { ok: true; pendingName: string | null }
  | { ok: false; reason: "not_found" | "expired" | "locked" | "bad_code" };

/**
 * Проверяет код и при успехе удаляет challenge. При неверном коде увеличивает счётчик попыток.
 */
export async function consumePhoneOtpIfValid(
  phoneNorm: string,
  code: string,
): Promise<ConsumePhoneOtpResult> {
  const row = await prisma.phoneOtpChallenge.findUnique({
    where: { phoneNorm },
  });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.phoneOtpChallenge.delete({ where: { phoneNorm } }).catch(() => undefined);
    return { ok: false, reason: "expired" };
  }
  if (row.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
    await prisma.phoneOtpChallenge.delete({ where: { phoneNorm } }).catch(() => undefined);
    return { ok: false, reason: "locked" };
  }

  const valid = verifyPhoneOtpHash(phoneNorm, code, row.codeHash);
  if (!valid) {
    await prisma.phoneOtpChallenge.update({
      where: { phoneNorm },
      data: { verifyAttempts: { increment: 1 } },
    });
    return { ok: false, reason: "bad_code" };
  }

  const pendingName = row.pendingName;
  await prisma.phoneOtpChallenge.delete({ where: { phoneNorm } });
  return { ok: true, pendingName };
}
