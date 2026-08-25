import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  REFERRAL_COOKIE_MAX_AGE_DAYS,
  REFERRAL_COOKIE_NAME,
  REFERRAL_EXTENDED_ATTRIBUTION_CODES,
  REFERRAL_EXTENDED_ATTRIBUTION_EMAILS,
  REFERRAL_PROGRAM_END_DATE,
} from "@/lib/legal-config";

export { REFERRAL_COOKIE_NAME, REFERRAL_COOKIE_MAX_AGE_DAYS };

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (code.length < 3 || code.length > 40) return null;
  return code;
}

export function referralProgramEndsAtMs(): number {
  return Date.parse(`${REFERRAL_PROGRAM_END_DATE}T23:59:59+03:00`);
}

export function hasExtendedReferralAttribution(opts: {
  code?: string | null;
  email?: string | null;
}): boolean {
  const code = normalizeReferralCode(opts.code);
  if (code && (REFERRAL_EXTENDED_ATTRIBUTION_CODES as readonly string[]).includes(code)) {
    return true;
  }
  const email = opts.email?.trim().toLowerCase();
  if (email && (REFERRAL_EXTENDED_ATTRIBUTION_EMAILS as readonly string[]).includes(email)) {
    return true;
  }
  return false;
}

export function referralCookieMaxAgeSec(code?: string | null): number {
  if (hasExtendedReferralAttribution({ code })) {
    const endsAt = referralProgramEndsAtMs();
    if (!Number.isFinite(endsAt)) return REFERRAL_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
    return Math.max(60, Math.floor((endsAt - Date.now()) / 1000));
  }
  return REFERRAL_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
}

export function referralCookieHelpText(opts?: {
  code?: string | null;
  email?: string | null;
  programEndsAt?: string | null;
}): string {
  if (hasExtendedReferralAttribution({ code: opts?.code, email: opts?.email })) {
    const ends =
      opts?.programEndsAt != null
        ? new Date(opts.programEndsAt).toLocaleDateString("ru-RU")
        : new Date(referralProgramEndsAtMs()).toLocaleDateString("ru-RU");
    return `Для вашей ссылки переход учитывается до окончания программы (${ends}), а не 30 дней.`;
  }
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
  const code = referralCodeFromRequest(req);
  if (!code) return res;

  res.cookies.set(REFERRAL_COOKIE_NAME, code, {
    maxAge: referralCookieMaxAgeSec(code),
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: useSecureReferralCookie(),
  });
  return res;
}

/** Код из хвоста пути: /landings/prichodi/ник, /landings/uchenik/ник, /register/ник. */
export function referralCodeFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const path = pathname.replace(/\/+$/, "") || "/";
  const hire = path.match(/^\/landings\/prichodi\/([^/]+)$/i);
  if (hire?.[1]) return normalizeReferralCode(hire[1]);
  const uchenik = path.match(/^\/landings\/uchenik\/([^/]+)$/i);
  if (uchenik?.[1]) return normalizeReferralCode(uchenik[1]);
  const reg = path.match(/^\/register\/([^/]+)$/i);
  if (reg?.[1]) return normalizeReferralCode(reg[1]);
  return null;
}

/** Код из ?ref= или из хвоста пути: /landings/prichodi/ник, /landings/uchenik/ник, /register/ник. */
export function referralCodeFromRequest(req: NextRequest): string | null {
  const fromQuery = normalizeReferralCode(req.nextUrl.searchParams.get("ref"));
  if (fromQuery) return fromQuery;
  return referralCodeFromPathname(req.nextUrl.pathname);
}
