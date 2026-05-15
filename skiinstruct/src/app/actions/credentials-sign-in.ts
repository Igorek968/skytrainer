"use server";

import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeRussianPhone } from "@/lib/phone";
import { sanitizeRedirectPath } from "@/lib/sanitize-auth-redirect";

export type CredentialsSignInState = {
  error: string | null;
};

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function isCredentialsFailure(error: unknown): boolean {
  if (error instanceof AuthError) return true;
  if (typeof error === "object" && error !== null) {
    const type =
      "type" in error && typeof (error as { type: unknown }).type === "string"
        ? (error as { type: string }).type
        : "";
    if (type === "CredentialsSignin") return true;
    const name =
      "name" in error && typeof (error as { name: unknown }).name === "string"
        ? (error as { name: string }).name
        : "";
    if (name === "CredentialsSignin") return true;
  }
  return false;
}

function barePath(path: string): string {
  const p = path.split("?")[0]?.split("#")[0] ?? path;
  const noTrail = p.replace(/\/+$/, "");
  return noTrail === "" ? "/" : noTrail;
}

function cabinetForRole(role: UserRole | undefined): "/instructor" | "/client" | "/admin/activity" | null {
  if (role === "INSTRUCTOR") return "/instructor";
  if (role === "CLIENT") return "/client";
  if (role === "ADMIN") return "/admin/activity";
  return null;
}

export async function signInWithCredentialsAction(
  _prev: CredentialsSignInState,
  formData: FormData,
): Promise<CredentialsSignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rawRedirect = String(formData.get("redirectTo") ?? "");
  const fallbackRaw = String(formData.get("fallbackRedirect") ?? "/") || "/";
  const fallback = sanitizeRedirectPath(fallbackRaw, "/");
  let redirectTo = sanitizeRedirectPath(rawRedirect, fallback);

  /** Иначе после входа остаются на «/» и не попадают в кабинет без лишнего клика. */
  if (barePath(redirectTo) === "/" && email.length > 0) {
    let row: { role: UserRole } | null = null;
    if (email.includes("@")) {
      row = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { role: true },
      });
    } else {
      const digits = normalizeRussianPhone(email);
      if (digits) {
        row = await prisma.user.findUnique({
          where: { phone: digits },
          select: { role: true },
        });
      }
    }
    const cabinet = cabinetForRole(row?.role);
    if (cabinet) redirectTo = cabinet;
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (isCredentialsFailure(error)) {
      return { error: "Неверный email или пароль" };
    }
    throw error;
  }

  redirect(redirectTo);
}

export async function signInAdminCredentialsAction(
  _prev: CredentialsSignInState,
  formData: FormData,
): Promise<CredentialsSignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/admin/activity",
    });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (isCredentialsFailure(error)) {
      return { error: "Неверный email или пароль" };
    }
    throw error;
  }

  redirect("/admin/activity");
}
