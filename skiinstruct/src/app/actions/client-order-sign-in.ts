"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export type ClientOrderSignInResult = { ok: true } | { ok: false; error: string };

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function isCredentialsLikeFailure(error: unknown): boolean {
  if (error instanceof AuthError) return true;
  if (typeof error === "object" && error !== null) {
    const type =
      "type" in error && typeof (error as { type: unknown }).type === "string"
        ? (error as { type: string }).type
        : "";
    if (type === "CredentialsSignin" || type === "Configuration" || type === "AccessDenied") return true;
    const name =
      "name" in error && typeof (error as { name: unknown }).name === "string"
        ? (error as { name: string }).name
        : "";
    if (name === "CredentialsSignin") return true;
  }
  return false;
}

function messageForFailure(error: unknown): string {
  if (error instanceof AuthError) {
    const authType = String(error.type);
    if (authType === "Configuration") {
      return "Сбой настройки входа на сервере. Проверьте AUTH_SECRET и AUTH_URL, перезапустите приложение.";
    }
    if (authType === "AccessDenied") return "Вход запрещён настройками.";
  }
  return "Неверный email или пароль.";
}

/**
 * Вход клиента по credentials без редиректа — cookie сессии, затем заказ с той же страницы.
 */
export async function signInClientSessionAction(formData: FormData): Promise<ClientOrderSignInResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Введите email и пароль" };
  }

  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result && typeof result === "object") {
      const r = result as { error?: string; ok?: boolean };
      if (r.error || r.ok === false) {
        return {
          ok: false,
          error:
            r.error === "Configuration"
              ? "Сбой настройки входа (AUTH_URL / AUTH_SECRET)."
              : "Неверный email или пароль.",
        };
      }
    }
  } catch (error) {
    if (isNextRedirect(error)) {
      return { ok: true };
    }
    if (isCredentialsLikeFailure(error)) {
      return { ok: false, error: messageForFailure(error) };
    }
    throw error;
  }

  return { ok: true };
}
