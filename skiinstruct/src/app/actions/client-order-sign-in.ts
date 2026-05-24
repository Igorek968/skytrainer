"use server";

import { credentialsSignInNoRedirect } from "@/lib/credentials-sign-in-core";
import { prisma } from "@/lib/prisma";

export type ClientOrderSignInResult = { ok: true } | { ok: false; error: string };

/**
 * Вход клиента по credentials без редиректа — cookie сессии, затем заказ с той же страницы.
 */
export async function signInClientSessionAction(formData: FormData): Promise<ClientOrderSignInResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Введите email и пароль" };
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { role: true },
  });
  if (existing?.role === "ADMIN") {
    return {
      ok: false,
      error:
        "Этот email — администратор. Для заказа нужен аккаунт клиента: зарегистрируйтесь или войдите с client@…",
    };
  }
  if (existing?.role === "INSTRUCTOR") {
    return {
      ok: false,
      error: "Этот email — инструктор. Для заказа зарегистрируйтесь как клиент с другим email.",
    };
  }

  return credentialsSignInNoRedirect(email, password);
}
