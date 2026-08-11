import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAuthSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { isEmailVerificationRequired } from "@/lib/services/email-verification";

/** Статус подтверждения email для баннера в кабинете. */
export async function GET() {
  const auth = await requireAuthSession();
  if (isApiErrorResponse(auth)) return auth;

  if (auth.role !== "CLIENT" && auth.role !== "INSTRUCTOR") {
    return NextResponse.json({ verified: true, required: false, email: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true, emailVerified: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    email: user.email,
    verified: Boolean(user.emailVerified),
    required: isEmailVerificationRequired(),
    role: auth.role,
  });
}
