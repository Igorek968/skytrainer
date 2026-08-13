import type { UserRole } from "@prisma/client";

/** Роли с доступом в админ-панель (админ + модератор). */
export const ADMIN_STAFF_ROLES = ["ADMIN", "MODERATOR"] as const;
export type AdminStaffRole = (typeof ADMIN_STAFF_ROLES)[number];

export function isAdminStaffRole(role: string | null | undefined): role is AdminStaffRole {
  return role === "ADMIN" || role === "MODERATOR";
}

export function isFullAdminRole(role: string | null | undefined): role is "ADMIN" {
  return role === "ADMIN";
}

/** Разделы и API только для полного админа (финансы / выплаты). */
export const ADMIN_FINANCE_PAGE_PREFIXES = ["/admin/finance"] as const;

export const ADMIN_FINANCE_API_PREFIXES = [
  "/api/admin/payout-requests",
  "/api/admin/referral-payout-requests",
] as const;

export function isAdminFinancePagePath(pathname: string): boolean {
  return ADMIN_FINANCE_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isAdminFinanceApiPath(pathname: string): boolean {
  return ADMIN_FINANCE_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function adminStaffRoleLabel(role: UserRole | string): string {
  if (role === "MODERATOR") return "Модератор";
  if (role === "ADMIN") return "Администратор";
  return role;
}
