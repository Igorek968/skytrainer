import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { cabinetPathForRole, resolvePostLoginRedirect } from "@/lib/auth-routes";
import { prisma } from "@/lib/prisma";
import { sanitizeRedirectPath } from "@/lib/sanitize-auth-redirect";

/** Роль из БД (актуальнее JWT в cookie после смены кабинета). */
export async function getDbRoleForSession(): Promise<{
  userId: string;
  role: UserRole;
} | null> {
  const session = await auth();
  const userId = session?.user?.id?.trim();
  if (!userId) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!dbUser) return null;

  return { userId, role: dbUser.role };
}

/**
 * Если пользователь уже вошёл с нужной ролью — сразу в кабинет (не показывать форму входа).
 * Другие роли не редиректим: на странице входа можно сменить аккаунт.
 */
export async function redirectWhenAlreadyLoggedIn(
  expectedRole: UserRole,
  requestedReturn?: string | null,
): Promise<void> {
  const row = await getDbRoleForSession();
  if (!row || row.role !== expectedRole) return;

  const fallback = cabinetPathForRole(expectedRole) ?? "/";
  const target = requestedReturn?.trim()
    ? resolvePostLoginRedirect(
        expectedRole,
        sanitizeRedirectPath(requestedReturn, fallback),
        fallback,
      )
    : fallback;

  redirect(target);
}

/** Редирект в кабинет по роли из БД (для layout кабинетов). */
export async function redirectToRoleCabinetUnless(
  allowedRole: UserRole,
  loginHref: string,
): Promise<void> {
  const row = await getDbRoleForSession();
  if (!row) {
    redirect(loginHref);
  }
  if (row.role !== allowedRole) {
    redirect(cabinetPathForRole(row.role) ?? loginHref);
  }
}
