import { NextResponse } from "next/server";

import { emailLoginTokenSignInNoRedirect } from "@/lib/credentials-sign-in-core";
import { cabinetPathAfterEmailVerification } from "@/lib/email-verification-redirect";

/** После подтверждения email — установить сессию по одноразовому loginToken. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело" }, { status: 400 });
  }
  const loginToken =
    typeof body === "object" && body && "loginToken" in body
      ? String((body as { loginToken?: unknown }).loginToken ?? "").trim()
      : "";
  const emailHint =
    typeof body === "object" && body && "email" in body
      ? String((body as { email?: unknown }).email ?? "").trim()
      : "";

  if (!loginToken) {
    return NextResponse.json({ error: "Токен не указан" }, { status: 400 });
  }

  const signedIn = await emailLoginTokenSignInNoRedirect(loginToken);
  if (!signedIn.ok) {
    return NextResponse.json({ error: signedIn.error }, { status: 401 });
  }

  const redirectTo = emailHint
    ? (await cabinetPathAfterEmailVerification(emailHint)).redirectTo
    : "/client?emailVerified=1";

  return NextResponse.json({ ok: true, redirectTo });
}
