import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { REFERRAL_COOKIE_MAX_AGE_DAYS, REFERRAL_COOKIE_NAME } from "@/lib/legal-config";

export { REFERRAL_COOKIE_NAME, REFERRAL_COOKIE_MAX_AGE_DAYS };

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (code.length < 3 || code.length > 40) return null;
  return code;
}

export function referralCookieMaxAgeSec(): number {
  return REFERRAL_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
}

export function referralCookieHelpText(): string {
  return `Ссылка действует ${REFERRAL_COOKIE_MAX_AGE_DAYS} дней с первого перехода.`;
}

function useSecureReferralCookie(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!url) return true;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return true;
  }
}

export function attachReferralCookie(req: NextRequest, res: NextResponse): NextResponse {
  const code = normalizeReferralCode(req.nextUrl.searchParams.get("ref"));
  if (!code) return res;

  res.cookies.set(REFERRAL_COOKIE_NAME, code, {
    maxAge: referralCookieMaxAgeSec(),
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: useSecureReferralCookie(),
  });
  return res;
}
