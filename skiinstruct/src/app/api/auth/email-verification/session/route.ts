import { NextResponse } from "next/server";

import { emailLoginTokenSignInNoRedirect } from "@/lib/credentials-sign-in-core";
import { getInstructorVerificationStatus, instructorEntryPath } from "@/lib/instructor-verification-gate";
import { prisma } from "@/lib/prisma";

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
  if (!loginToken) {
    return NextResponse.json({ error: "Токен не указан" }, { status: 400 });
  }

  const signedIn = await emailLoginTokenSignInNoRedirect(loginToken);
  if (!signedIn.ok) {
    return NextResponse.json({ error: signedIn.error }, { status: 401 });
  }

  // Роль/куда вести — из свежей БД (сессия только что выставлена)
  const emailHint =
    typeof body === "object" && body && "email" in body
      ? String((body as { email?: unknown }).email ?? "").trim()
      : "";

  let redirectTo = "/client?emailVerified=1";
  if (emailHint) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailHint, mode: "insensitive" } },
      select: { id: true, role: true },
    });
    if (user?.role === "INSTRUCTOR") {
      const status = await getInstructorVerificationStatus(user.id);
      redirectTo = `${instructorEntryPath(status)}?emailVerified=1`;
    } else if (user?.role === "ADMIN" || user?.role === "MODERATOR") {
      redirectTo = "/admin/metrics?emailVerified=1";
    } else if (user?.role === "CLIENT") {
      redirectTo = "/client?emailVerified=1";
    }
  }

  return NextResponse.json({ ok: true, redirectTo });
}
