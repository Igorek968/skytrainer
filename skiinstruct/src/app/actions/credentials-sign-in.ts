"use server";

import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

import { signOut } from "@/auth";
import {
  cabinetPathForRole,
  isClientBookingReturnPath,
  resolvePostLoginRedirect,
} from "@/lib/auth-routes";
import { credentialsSignInNoRedirect } from "@/lib/credentials-sign-in-core";
import {
  getInstructorVerificationStatus,
  instructorEntryPath,
} from "@/lib/instructor-verification-gate";
import { prisma } from "@/lib/prisma";
import { sanitizeRedirectPath } from "@/lib/sanitize-auth-redirect";

export type CredentialsSignInState = {
  error: string | null;
};

/** Проверка email перед входом клиента (роль и куда редиректить). */
export async function validateClientLoginEmail(email: string): Promise<{ error: string | null }> {
  const trimmed = email.trim();
  if (!trimmed) return { error: "Введите email" };

  const role = await lookupRoleForIdentifier(trimmed);
  if (role === "ADMIN") {
    return {
      error:
        "Этот email — администратор. Войдите через /admin/login или зарегистрируйте отдельный клиентский аккаунт.",
    };
  }
  if (role === "INSTRUCTOR") {
    return {
      error:
        "Этот email — инструктор. Для заказа занятий нужен клиентский аккаунт: зарегистрируйтесь на /register или войдите через /instructor/login.",
    };
  }
  return { error: null };
}

async function lookupRoleForIdentifier(identifier: string): Promise<UserRole | undefined> {
  const email = identifier.trim();
  if (!email || !email.includes("@")) return undefined;
  const row = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { role: true },
  });
  return row?.role;
}

export async function signInWithCredentialsAction(
  _prev: CredentialsSignInState,
  formData: FormData,
): Promise<CredentialsSignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rawRedirect = String(formData.get("redirectTo") ?? "");
  const fallbackRaw = String(formData.get("fallbackRedirect") ?? "/client") || "/client";
  const fallback = sanitizeRedirectPath(fallbackRaw, "/client");
  let redirectTo = sanitizeRedirectPath(rawRedirect, fallback);

  if (!email || !password) {
    return { error: "Введите email и пароль" };
  }

  const role = await lookupRoleForIdentifier(email);
  if (role === "ADMIN") {
    return {
      error:
        "Этот email — администратор. Войдите через /admin/login или зарегистрируйте отдельный клиентский аккаунт.",
    };
  }
  if (role === "INSTRUCTOR") {
    return {
      error:
        "Этот email — инструктор. Для заказа занятий нужен клиентский аккаунт: зарегистрируйтесь на /register или войдите через /instructor/login.",
    };
  }

  if (role) {
    redirectTo = resolvePostLoginRedirect(role, redirectTo, cabinetPathForRole(role) ?? fallback);
  } else {
    redirectTo = resolvePostLoginRedirect("CLIENT", redirectTo, fallback);
  }

  if (role && role !== "CLIENT" && isClientBookingReturnPath(redirectTo)) {
    return {
      error:
        role === "ADMIN"
          ? "Этот email — администратор. Для заказа войдите как клиент или используйте /admin/login."
          : "Этот email — инструктор. Для заказа зарегистрируйтесь как клиент с другим email.",
    };
  }

  const signedIn = await credentialsSignInNoRedirect(email, password);
  if (!signedIn.ok) {
    return { error: signedIn.error };
  }

  redirect(redirectTo);
}

export async function signInAdminCredentialsAction(
  _prev: CredentialsSignInState,
  formData: FormData,
): Promise<CredentialsSignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rawRedirect = String(formData.get("redirectTo") ?? "");
  const redirectTo = resolvePostLoginRedirect(
    "ADMIN",
    sanitizeRedirectPath(rawRedirect, "/admin/metrics"),
    "/admin/metrics",
  );

  if (!email.includes("@")) {
    return { error: "Введите email администратора" };
  }

  const adminUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { role: true },
  });
  if (!adminUser || adminUser.role !== "ADMIN") {
    return { error: "Нет прав администратора для этого аккаунта" };
  }

  await signOut({ redirect: false });
  const signedIn = await credentialsSignInNoRedirect(email, password);
  if (!signedIn.ok) {
    return { error: signedIn.error };
  }

  redirect(redirectTo);
}

export async function signInInstructorCredentialsAction(
  _prev: CredentialsSignInState,
  formData: FormData,
): Promise<CredentialsSignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rawRedirect = String(formData.get("redirectTo") ?? "");

  if (!email.includes("@")) {
    return { error: "Введите email инструктора" };
  }

  const instructorUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true },
  });
  if (!instructorUser || instructorUser.role !== "INSTRUCTOR") {
    return { error: "Этот аккаунт не зарегистрирован как инструктор" };
  }

  const verificationStatus = await getInstructorVerificationStatus(instructorUser.id);
  const entry = instructorEntryPath(verificationStatus);
  const redirectTo = resolvePostLoginRedirect(
    "INSTRUCTOR",
    sanitizeRedirectPath(rawRedirect, entry),
    entry,
  );
  const bare = redirectTo.split("?")[0]?.replace(/\/+$/, "") || "/";
  const safeRedirect =
    verificationStatus !== "APPROVED" &&
    bare.startsWith("/instructor") &&
    bare !== "/instructor/pending" &&
    bare !== "/instructor/login" &&
    bare !== "/instructor/apply"
      ? entry
      : redirectTo;

  await signOut({ redirect: false });
  const signedIn = await credentialsSignInNoRedirect(email, password);
  if (!signedIn.ok) {
    return { error: signedIn.error };
  }

  redirect(safeRedirect);
}
