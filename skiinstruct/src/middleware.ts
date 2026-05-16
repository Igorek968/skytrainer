import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

/**
 * Page routes only. API routes call `auth()` и роли из Node.
 * Здесь только edge-безопасный конфиг (без Prisma) — см. auth.config.ts.
 */
export default NextAuth(authConfig).auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login") {
    if (!req.auth) return NextResponse.next();
    if (req.auth.user?.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin/activity", req.nextUrl));
    }
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  const isPublicClientHome =
    (pathname === "/client" || pathname === "/client/") && !req.auth;
  const isPublicInstructorReviewsBrowse = pathname.startsWith("/instructors/");
  const isPublicOferta = pathname === "/oferta" || pathname.startsWith("/oferta/");
  const publicPaths = ["/", "/login", "/register", "/instructor/login", "/instructor/apply"];
  if (
    publicPaths.includes(pathname) ||
    isPublicClientHome ||
    isPublicInstructorReviewsBrowse ||
    isPublicOferta
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/reset-password")) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginPath = pathname.startsWith("/admin")
      ? "/admin/login"
      : pathname.startsWith("/instructor")
        ? "/instructor/login"
        : "/login";
    const url = new URL(loginPath, req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = req.auth.user?.role;
  if (!role) {
    const loginPath = pathname.startsWith("/admin")
      ? "/admin/login"
      : pathname.startsWith("/instructor")
        ? "/instructor/login"
        : "/login";
    const url = new URL(loginPath, req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/client") && role !== "CLIENT") {
    if (role === "INSTRUCTOR") return NextResponse.redirect(new URL("/instructor", req.nextUrl));
    if (role === "ADMIN") return NextResponse.redirect(new URL("/admin/activity", req.nextUrl));
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  if (pathname.startsWith("/instructor") && role !== "INSTRUCTOR") {
    if (role === "CLIENT") return NextResponse.redirect(new URL("/client", req.nextUrl));
    if (role === "ADMIN") return NextResponse.redirect(new URL("/admin/activity", req.nextUrl));
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*|sw\\.js).*)"],
};
