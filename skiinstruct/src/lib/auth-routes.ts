import type { UserRole } from "@prisma/client";

import { sanitizeRedirectPath } from "@/lib/sanitize-auth-redirect";

/** Куда отправлять после signOut, чтобы не вернуться в кабинет через редирект с главной. */
export function signOutCallbackForRole(role: UserRole | string | undefined): string {
  if (role === "INSTRUCTOR") return "/instructor/login";
  if (role === "ADMIN") return "/admin/login";
  return "/login";
}

function barePath(path: string): string {
  const p = path.split("?")[0]?.split("#")[0] ?? path;
  const noTrail = p.replace(/\/+$/, "");
  return noTrail === "" ? "/" : noTrail;
}

/** Возврат на страницу заказа после входа (см. CLIENT_BOOKING_RETURN_PATH). */
export function isClientBookingReturnPath(path: string): boolean {
  const bare = barePath(path);
  if (bare !== "/client" && bare !== "/") return false;
  const q = path.includes("?") ? path.slice(path.indexOf("?")) : "";
  return q.includes("checkout=1");
}

export function cabinetPathForRole(role: UserRole | undefined): string | null {
  if (role === "INSTRUCTOR") return "/instructor";
  if (role === "CLIENT") return "/client";
  if (role === "ADMIN") return "/admin/activity";
  return null;
}

/**
 * После входа не отправлять инструктора в /client и клиента в /instructor.
 * Явные пути своего кабинета сохраняются (в т.ч. callbackUrl).
 */
export function resolvePostLoginRedirect(
  role: UserRole | undefined,
  requested: string,
  fallback: string,
): string {
  const safe = sanitizeRedirectPath(requested, fallback);
  const cabinet = cabinetPathForRole(role);
  if (!cabinet) return safe;

  const bare = barePath(safe);

  if (isClientBookingReturnPath(safe)) {
    return safe;
  }

  if (role === "INSTRUCTOR") {
    if (
      bare === "/" ||
      bare === "/login" ||
      bare === "/register" ||
      bare.startsWith("/client") ||
      bare.startsWith("/admin")
    ) {
      return cabinet;
    }
    if (bare.startsWith("/instructor")) {
      return safe;
    }
    return cabinet;
  }

  if (role === "CLIENT") {
    if (bare === "/" || bare.startsWith("/instructor") || bare.startsWith("/admin")) {
      return cabinet;
    }
    return safe;
  }

  if (role === "ADMIN") {
    if (bare === "/" || bare.startsWith("/client") || bare.startsWith("/instructor")) {
      return cabinet;
    }
    return safe;
  }

  return safe;
}
