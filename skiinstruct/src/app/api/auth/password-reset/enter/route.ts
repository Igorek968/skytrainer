import { NextResponse } from "next/server";

import { absoluteAppUrl } from "@/lib/app-origin";
import { cabinetPathForRole } from "@/lib/auth-routes";
import { passwordResetTokenSignInNoRedirect } from "@/lib/credentials-sign-in-core";
import { validatePasswordResetToken } from "@/lib/services/password-reset";

function invalidLinkRedirect(req: Request): NextResponse {
  const url = absoluteAppUrl("/reset-password", req);
  url.searchParams.set("error", "invalid");
  return NextResponse.redirect(url);
}

/**
 * Старые письма ведут сюда. Сессию ставим best-effort:
 * даже если Credentials signIn падает, при валидном токене открываем форму смены пароля.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) return invalidLinkRedirect(req);

  const validation = await validatePasswordResetToken(token);
  if (!validation.ok) return invalidLinkRedirect(req);

  const signedIn = await passwordResetTokenSignInNoRedirect(token);
  if (!signedIn.ok) {
    console.warn("[password-reset] enter: token OK, session failed:", signedIn.error);
  }

  const next = url.searchParams.get("next")?.trim();
  if (next === "reset" || !signedIn.ok) {
    const resetUrl = absoluteAppUrl("/reset-password", req);
    resetUrl.searchParams.set("token", token);
    if (signedIn.ok) resetUrl.searchParams.set("signedIn", "1");
    return NextResponse.redirect(resetUrl);
  }

  const home = cabinetPathForRole(validation.user.role) ?? "/login";
  return NextResponse.redirect(absoluteAppUrl(home, req));
}
