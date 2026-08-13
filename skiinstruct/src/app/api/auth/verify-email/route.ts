import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getInstructorVerificationStatus, instructorEntryPath } from "@/lib/instructor-verification-gate";
import { verifyEmailToken } from "@/lib/services/email-verification";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Токен не указан" }, { status: 400 });
  }

  const result = await verifyEmailToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: "Ссылка недействительна или устарела" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: result.email, mode: "insensitive" } },
    select: { id: true, role: true },
  });

  let redirectTo = "/client?emailVerified=1";
  if (user?.role === "INSTRUCTOR") {
    const status = await getInstructorVerificationStatus(user.id);
    redirectTo = `${instructorEntryPath(status)}?emailVerified=1`;
  } else if (user?.role === "ADMIN" || user?.role === "MODERATOR") {
    redirectTo = "/admin/metrics?emailVerified=1";
  }

  return NextResponse.json({
    ok: true,
    email: result.email,
    role: user?.role ?? null,
    loginToken: result.loginToken,
    redirectTo,
  });
}
