import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";
import { guardApiRequest } from "@/lib/api-middleware-guard";
import {
  isAdminPanelPath,
  isClientAuthRequiredPath,
  isInstructorPanelPath,
  roleHomePath,
} from "@/lib/role-route-access";
import { attachReferralCookie } from "@/lib/referral-cookie";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";

/**
 * Проверка «вошёл / не вошёл» и разделение кабинетов по роли из JWT.
 * Роль в JWT обновляется из БД в callbacks.jwt (auth.ts) при каждом запросе.
 */
function configuredSiteUsesHttps(): boolean {
  const raw =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (!raw) return true; // прод по умолчанию https
  try {
    const host = new URL(raw).hostname;
    if (host === "localhost" || host === "127.0.0.1") return false;
    return true;
  } catch {
    return true;
  }
}

/** Локальная сеть / Cloudflare quick tunnel — без принудительного https→AUTH_URL. */
function isDevAccessHost(hostHeader: string): boolean {
  const host = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
  if (host.endsWith(".trycloudflare.com")) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

function httpsRedirect(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (!configuredSiteUsesHttps()) return null;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || isDevAccessHost(host)) return null;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto && proto !== "https") {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    // nextUrl может брать host из AUTH_URL — оставляем host запроса
    url.host = host;
    return NextResponse.redirect(url, 308);
  }
  return null;
}

function withRefCookie(req: NextRequest, res: NextResponse): NextResponse {
  return attachReferralCookie(req, res);
}

/**
 * Origin для редиректов: Host запроса, не AUTH_URL.
 * Иначе при AUTH_URL=прод localhost:3001 уезжает на твойтренер.рф.
 */
function requestOrigin(req: NextRequest): string {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  if (!host) return req.nextUrl.origin;
  const protoHeader = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    protoHeader ||
    (isDevAccessHost(host) ? "http" : configuredSiteUsesHttps() ? "https" : "http");
  return `${proto}://${host}`;
}

function redirectTo(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, requestOrigin(req)));
}

export default NextAuth(authConfig).auth((req) => {
  const pathname = req.nextUrl.pathname.replace(/\/+$/, "") || "/";

  const forceHttps = httpsRedirect(req);
  if (forceHttps) return withRefCookie(req, forceHttps);

  if (pathname.startsWith("/api")) {
    const apiBlock = guardApiRequest(req, req.auth);
    if (apiBlock) return withRefCookie(req, apiBlock);
    return withRefCookie(req, NextResponse.next());
  }

  if (pathname === "/instructor/login" || pathname === "/admin/login") {
    return withRefCookie(req, NextResponse.next());
  }

  /** Анкета только со страницы входа («Стать инструктором»); прямой заход с шапки — на login. */
  if (pathname === "/instructor/apply") {
    const allowApply =
      req.nextUrl.searchParams.get("new") === "1" ||
      req.nextUrl.searchParams.get("register") === "1";
    if (!allowApply) {
      return withRefCookie(req, redirectTo(req, "/instructor/login"));
    }
  }

  /** Карта и заказ — для гостей и для инструкторов/админов «как клиент». */
  const isClientBookingHome = pathname === "/client" || pathname === "/client/";
  const isPublicInstructorBrowse = pathname.startsWith("/instructors/");
  const isPublicSeoLandings = pathname.startsWith("/gorod/") || pathname.startsWith("/sport/");
  const isPublicLegal =
    pathname === "/oferta" ||
    pathname.startsWith("/oferta/") ||
    pathname === "/oferta-instructor" ||
    pathname.startsWith("/oferta-instructor/") ||
    pathname === "/privacy" ||
    pathname.startsWith("/privacy/") ||
    pathname === "/returns" ||
    pathname.startsWith("/returns/") ||
    pathname === "/requisites" ||
    pathname.startsWith("/requisites/") ||
    pathname === "/support" ||
    pathname.startsWith("/support/");
  const publicPaths = ["/", "/login", "/register", "/instructor/login", "/instructor/apply"];
  if (
    publicPaths.includes(pathname) ||
    isClientBookingHome ||
    isPublicInstructorBrowse ||
    isPublicSeoLandings ||
    isPublicLegal
  ) {
    return withRefCookie(req, NextResponse.next());
  }

  if (pathname.startsWith("/reset-password") || pathname.startsWith("/verify-email")) {
    return withRefCookie(req, NextResponse.next());
  }

  if (!req.auth) {
    const loginPath = pathname.startsWith("/admin")
      ? "/admin/login"
      : pathname.startsWith("/instructor")
        ? "/instructor/login"
        : "/login";
    const url = new URL(loginPath, requestOrigin(req));
    const returnPath = `${pathname}${req.nextUrl.search}`;
    url.searchParams.set("callbackUrl", returnPath);
    return withRefCookie(req, NextResponse.redirect(url));
  }

  const role = req.auth.user?.role as UserRole | undefined;
  const roleHome = role ? roleHomePath(role) : "/login";

  if (isAdminPanelPath(pathname) && role !== "ADMIN") {
    return withRefCookie(req, redirectTo(req, roleHome));
  }
  if (isInstructorPanelPath(pathname) && role !== "INSTRUCTOR") {
    return withRefCookie(req, redirectTo(req, roleHome));
  }
  if (isClientAuthRequiredPath(pathname) && role !== "CLIENT") {
    return withRefCookie(req, redirectTo(req, roleHome));
  }

  return withRefCookie(req, NextResponse.next());
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*|sw\\.js).*)"],
};
