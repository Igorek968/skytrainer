import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { cabinetPathForRole, resolvePostLoginRedirect } from "@/lib/auth-routes";
import {
  getInstructorVerificationStatus,
  instructorEntryPath,
} from "@/lib/instructor-verification-gate";
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
 * Инструктор без одобрения модерации → /instructor/pending.
 */
export async function redirectWhenAlreadyLoggedIn(
  expectedRole: UserRole,
  requestedReturn?: string | null,
): Promise<void> {
  const row = await getDbRoleForSession();
  if (!row || row.role !== expectedRole) return;

  let fallback = cabinetPathForRole(expectedRole) ?? "/";
  if (expectedRole === "INSTRUCTOR") {
    const status = await getInstructorVerificationStatus(row.userId);
    fallback = instructorEntryPath(status);
  }

  const target = requestedReturn?.trim()
    ? resolvePostLoginRedirect(
        expectedRole,
        sanitizeRedirectPath(requestedReturn, fallback),
        fallback,
      )
    : fallback;

  if (expectedRole === "INSTRUCTOR" && fallback === "/instructor/pending") {
    const bare = target.split("?")[0]?.replace(/\/+$/, "") || "/";
    if (bare.startsWith("/instructor") && bare !== "/instructor/pending" && bare !== "/instructor/login") {
      redirect("/instructor/pending");
    }
  }

  redirect(target);
}

/** Редирект в кабинет по роли из БД (для layout кабинетов). */
export async function redirectToRoleCabinetUnless(
  allowedRole: UserRole | UserRole[],
  loginHref: string,
): Promise<void> {
  const row = await getDbRoleForSession();
  if (!row) {
    redirect(loginHref);
  }
  const allowed = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
  if (!allowed.includes(row.role)) {
    redirect(cabinetPathForRole(row.role) ?? loginHref);
  }
}

/** Кабинет инструктора только после APPROVED. */
export async function redirectInstructorUnlessVerified(): Promise<void> {
  const row = await getDbRoleForSession();
  if (!row || row.role !== "INSTRUCTOR") return;
  const status = await getInstructorVerificationStatus(row.userId);
  if (status !== "APPROVED") {
    redirect(instructorEntryPath(status));
  }
}
