"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resolvePostLoginRedirect } from "@/lib/auth-routes";
import { credentialsSignInNoRedirect } from "@/lib/credentials-sign-in-core";
import { createClientUser } from "@/lib/client-registration";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { sanitizeRedirectPath } from "@/lib/sanitize-auth-redirect";

export type RegisterClientState = {
  error: string | null;
};

export async function registerClientAction(
  _prev: RegisterClientState,
  formData: FormData,
): Promise<RegisterClientState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const name = String(formData.get("name") ?? "");
  const captchaToken = String(formData.get("captchaToken") ?? "");
  const rawRedirect = String(formData.get("redirectTo") ?? "");
  const redirectTo = resolvePostLoginRedirect("CLIENT", sanitizeRedirectPath(rawRedirect, "/client"), "/client");
  const acceptLegal = formData.get("acceptLegal") === "on";

  if (!acceptLegal) {
    return { error: "Примите условия агентской оферты, политики обработки ПДн и правил возврата" };
  }

  const referralCode = String(formData.get("referralCode") ?? "").trim() || undefined;
  const ip = clientIp(await headers());
  const emailKey = email.trim().toLowerCase();
  if (!rateLimit(`register-action:${ip}`, 12, 3600_000) || !rateLimit(`register-action:${ip}:${emailKey}`, 6, 3600_000)) {
    return { error: "Слишком много попыток. Попробуйте позже." };
  }
  const humanOk = await verifyTurnstileToken(captchaToken, ip);
  if (!humanOk) {
    return { error: "Подтвердите, что вы не робот." };
  }

  const created = await createClientUser({
    email,
    password,
    passwordConfirm,
    name: name.trim() || undefined,
    referralCode,
  });
  if (!created.ok) {
    return { error: created.error };
  }

  const signedIn = await credentialsSignInNoRedirect(created.email, password);
  if (!signedIn.ok) {
    redirect(
      `/login?registered=1&callbackUrl=${encodeURIComponent(redirectTo)}&email=${encodeURIComponent(created.email)}`,
    );
  }

  redirect(redirectTo);
}
