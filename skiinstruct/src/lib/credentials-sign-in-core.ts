import { headers } from "next/headers";
import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function isCredentialsLikeFailure(error: unknown): boolean {
  if (error instanceof AuthError) return true;
  if (typeof error === "object" && error !== null) {
    const type =
      "type" in error && typeof (error as { type: unknown }).type === "string"
        ? (error as { type: string }).type
        : "";
    if (type === "CredentialsSignin" || type === "Configuration" || type === "AccessDenied") {
      return true;
    }
    const name =
      "name" in error && typeof (error as { name: unknown }).name === "string"
        ? (error as { name: string }).name
        : "";
    if (name === "CredentialsSignin") return true;
  }
  return false;
}

export function messageForCredentialsFailure(error: unknown): string {
  if (error instanceof AuthError) {
    const authType = String(error.type);
    if (authType === "Configuration") {
      return "Сбой настройки входа на сервере. Проверьте AUTH_SECRET и AUTH_URL (должен совпадать с адресом в браузере), перезапустите приложение.";
    }
    if (authType === "AccessDenied") return "Вход запрещён настройками.";
  }
  return "Неверный email или пароль.";
}

function authSecretForTrustedSignIn(): string {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || "";
}

function signInResultFromAuthResponse(result: unknown): { ok: true } | { ok: false; error: string } {
  // null/undefined при redirect:false без cookie — не считаем успехом
  if (result == null) {
    return { ok: false, error: "Не удалось установить сессию. Попробуйте войти вручную." };
  }
  if (typeof result === "object") {
    const r = result as { error?: string | null; ok?: boolean; status?: number; url?: string | null };
    if (r.error) {
      return {
        ok: false,
        error:
          r.error === "Configuration"
            ? "Сбой настройки входа (AUTH_URL / AUTH_SECRET)."
            : "Неверный email или пароль.",
      };
    }
    if (r.ok === false || (typeof r.status === "number" && r.status >= 400)) {
      return { ok: false, error: "Неверный email или пароль." };
    }
    if (r.ok === true || r.status === 200) return { ok: true };
    // url на /api/auth/error — провал
    if (typeof r.url === "string" && /error=/i.test(r.url)) {
      return { ok: false, error: "Неверный email или пароль." };
    }
  }
  return { ok: false, error: "Не удалось выполнить вход. Попробуйте ещё раз." };
}

/** Вход по ссылке восстановления пароля (без смены пароля). */
export async function passwordResetTokenSignInNoRedirect(
  resetToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const h = await headers();
    const ip = clientIp(h);
    if (!rateLimit(`password-reset:enter:${ip}`, 12, 900_000)) {
      return { ok: false, error: "Слишком много попыток. Подождите 15 минут." };
    }

    const trusted = authSecretForTrustedSignIn();
    const result = await signIn("credentials", {
      resetToken,
      trustedServerSignIn: trusted,
      redirect: false,
    });
    return signInResultFromAuthResponse(result);
  } catch (error) {
    // redirect:false не должен кидать NEXT_REDIRECT; если кинул — это ошибка конфигурации, не успех
    if (isNextRedirect(error)) {
      return {
        ok: false,
        error: "Сбой настройки входа. Проверьте AUTH_SECRET / AUTH_URL и войдите вручную.",
      };
    }
    if (isCredentialsLikeFailure(error)) {
      return { ok: false, error: "Ссылка недействительна или устарела." };
    }
    throw error;
  }
}

/** Устанавливает cookie сессии без редиректа Auth.js (надёжно из Server Actions). */
export async function credentialsSignInNoRedirect(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const h = await headers();
    const ip = clientIp(h);
    const idKey = email.trim().toLowerCase();
    if (!rateLimit(`login-ip:${ip}`, 30, 900_000) || !rateLimit(`login:${idKey}`, 12, 900_000)) {
      return { ok: false, error: "Слишком много попыток входа. Подождите 15 минут." };
    }

    const trusted = authSecretForTrustedSignIn();
    const result = await signIn("credentials", {
      email,
      password,
      trustedServerSignIn: trusted,
      redirect: false,
    });
    return signInResultFromAuthResponse(result);
  } catch (error) {
    if (isNextRedirect(error)) {
      return {
        ok: false,
        error: "Сбой настройки входа. Аккаунт мог быть создан — войдите вручную на /login.",
      };
    }
    if (isCredentialsLikeFailure(error)) {
      return { ok: false, error: messageForCredentialsFailure(error) };
    }
    throw error;
  }
}
