"use server";

import { redirect } from "next/navigation";

import { resolvePostLoginRedirect } from "@/lib/auth-routes";
import { credentialsSignInNoRedirect } from "@/lib/credentials-sign-in-core";
import { createClientUser } from "@/lib/client-registration";
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
  const rawRedirect = String(formData.get("redirectTo") ?? "");
  const redirectTo = resolvePostLoginRedirect("CLIENT", sanitizeRedirectPath(rawRedirect, "/client"), "/client");
  const acceptLegal = formData.get("acceptLegal") === "on";

  if (!acceptLegal) {
    return { error: "Примите условия агентской оферты, политики обработки ПДн и правил возврата" };
  }

  const created = await createClientUser({
    email,
    password,
    passwordConfirm,
    name: name.trim() || undefined,
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
