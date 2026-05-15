"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { sanitizeRedirectPath } from "@/lib/sanitize-auth-redirect";
import { signIn } from "@/auth";
import { createClientUser } from "@/lib/client-registration";

export type RegisterClientState = {
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

export async function registerClientAction(
  _prev: RegisterClientState,
  formData: FormData,
): Promise<RegisterClientState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const name = String(formData.get("name") ?? "");
  const rawRedirect = String(formData.get("redirectTo") ?? "");
  const redirectTo = sanitizeRedirectPath(rawRedirect, "/client");

  const created = await createClientUser({
    email,
    password,
    passwordConfirm,
    name: name.trim() || undefined,
  });
  if (!created.ok) {
    return { error: created.error };
  }

  try {
    await signIn("credentials", {
      email: created.email,
      password,
      redirectTo,
    });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (isCredentialsFailure(error)) {
      redirect(
        `/login?registered=1&callbackUrl=${encodeURIComponent(redirectTo)}&email=${encodeURIComponent(created.email)}`,
      );
    }
    throw error;
  }

  redirect(redirectTo);
}
