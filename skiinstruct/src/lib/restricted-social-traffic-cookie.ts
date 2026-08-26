import type { NextRequest, NextResponse } from "next/server";

import { REFERRAL_COOKIE_MAX_AGE_DAYS } from "@/lib/legal-config";
import {
  TRAFFIC_SOURCE_COOKIE_NAME,
  detectRestrictedSocial,
  parseRestrictedSocialId,
} from "@/lib/restricted-social-traffic";

function useSecureTrafficCookie(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!url) return true;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return true;
  }
}

/** First-touch cookie с Referer / UA (in-app Instagram). */
export function attachRestrictedTrafficCookie(req: NextRequest, res: NextResponse): NextResponse {
  if (parseRestrictedSocialId(req.cookies.get(TRAFFIC_SOURCE_COOKIE_NAME)?.value)) return res;
  const detected = detectRestrictedSocial({
    referer: req.headers.get("referer") ?? req.headers.get("referrer"),
    userAgent: req.headers.get("user-agent"),
  });
  if (!detected) return res;
  res.cookies.set(TRAFFIC_SOURCE_COOKIE_NAME, detected.id, {
    maxAge: REFERRAL_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: useSecureTrafficCookie(),
  });
  return res;
}
