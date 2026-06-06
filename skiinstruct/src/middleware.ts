import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";
import { guardApiRequest } from "@/lib/api-middleware-guard";
import {
  isAdminPanelPath,
  isClientAuthRequiredPath,
  isInstructorPanelPath,
  roleHomePath,
} from "@/lib/role-route-access";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";

/**
 * Проверка «вошёл / не вошёл» и разделение кабинетов по роли из JWT.
 * Роль в JWT обновляется из БД в callbacks.jwt (auth.ts) при каждом запросе.
 */
function httpsRedirect(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || host.includes("localhost") || host.startsWith("127.0.0.1")) return null;
  const proto = req.headers.get("x-forwarded-proto");
  if (proto && proto !== "https") {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }
  return null;
}

export default NextAuth(authConfig).auth((req) => {
  const pathname = req.nextUrl.pathname.replace(/\/+$/, "") || "/";

  const forceHttps = httpsRedirect(req);
  if (forceHttps) return forceHttps;

  if (pathname.startsWith("/api")) {
    const apiBlock = guardApiRequest(req, req.auth);
    if (apiBlock) return apiBlock;
    return NextResponse.next();
  }

  if (pathname === "/instructor/login" || pathname === "/admin/login") {
    return NextResponse.next();
  }

  /** Анкета только со страницы входа («Стать инструктором»); прямой заход с шапки — на login. */
  if (pathname === "/instructor/apply") {
    const allowApply =
      req.nextUrl.searchParams.get("new") === "1" ||
      req.nextUrl.searchParams.get("register") === "1";
    if (!allowApply) {
      return NextResponse.redirect(new URL("/instructor/login", req.nextUrl.origin));
    }
  }

  /** Карта и заказ — для гостей и для инструкторов/админов «как клиент». */
  const isClientBookingHome = pathname === "/client" || pathname === "/client/";
  const isPublicInstructorReviewsBrowse = pathname.startsWith("/instructors/");
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
    isPublicInstructorReviewsBrowse ||
    isPublicLegal
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/reset-password") || pathname.startsWith("/verify-email")) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginPath = pathname.startsWith("/admin")
      ? "/admin/login"
      : pathname.startsWith("/instructor")
        ? "/instructor/login"
        : "/login";
    const url = new URL(loginPath, req.nextUrl.origin);
    const returnPath = `${pathname}${req.nextUrl.search}`;
    url.searchParams.set("callbackUrl", returnPath);
    return NextResponse.redirect(url);
  }

  const role = req.auth.user?.role as UserRole | undefined;
  const roleHome = role ? roleHomePath(role) : "/login";

  if (isAdminPanelPath(pathname) && role !== "ADMIN") {
    return NextResponse.redirect(new URL(roleHome, req.nextUrl.origin));
  }
  if (isInstructorPanelPath(pathname) && role !== "INSTRUCTOR") {
    return NextResponse.redirect(new URL(roleHome, req.nextUrl.origin));
  }
  if (isClientAuthRequiredPath(pathname) && role !== "CLIENT") {
    return NextResponse.redirect(new URL(roleHome, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*|sw\\.js).*)"],
};
