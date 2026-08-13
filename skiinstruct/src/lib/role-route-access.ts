import type { UserRole } from "@prisma/client";

import { cabinetPathForRole } from "@/lib/auth-routes";

export function roleHomePath(role: UserRole): string {
  return cabinetPathForRole(role) ?? "/login";
}

export function loginPathForRole(role: UserRole): string {
  if (role === "ADMIN" || role === "MODERATOR") return "/admin/login";
  if (role === "INSTRUCTOR") return "/instructor/login";
  return "/login";
}

/** Разделы клиента только для роли CLIENT (заказы, записи на мероприятия). */
export const CLIENT_AUTH_REQUIRED_PREFIXES = ["/client/orders", "/client/registrations", "/client/referral"] as const;

export function isClientAuthRequiredPath(pathname: string): boolean {
  return CLIENT_AUTH_REQUIRED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isInstructorPanelPath(pathname: string): boolean {
  return (
    pathname.startsWith("/instructor") &&
    pathname !== "/instructor/login" &&
    pathname !== "/instructor/apply" &&
    !pathname.startsWith("/landings/")
  );
}

export function isAdminPanelPath(pathname: string): boolean {
  return pathname.startsWith("/admin") && pathname !== "/admin/login";
}

export function isAdminFinancePagePath(pathname: string): boolean {
  return pathname === "/admin/finance" || pathname.startsWith("/admin/finance/");
}

export function clientAuthLoginRedirect(pathname: string): string {
  const returnPath = encodeURIComponent(pathname);
  return `/login?callbackUrl=${returnPath}`;
}
