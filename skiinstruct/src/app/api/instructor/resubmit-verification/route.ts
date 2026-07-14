import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

/** После отказа — снова поставить заявку в очередь модерации. */
export async function POST() {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const profile = await prisma.instructorProfile.findUnique({
    where: { userId },
    select: { verificationStatus: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }
  if (profile.verificationStatus === "APPROVED") {
    return NextResponse.json({ ok: true, verificationStatus: "APPROVED" });
  }
  if (profile.verificationStatus !== "REJECTED") {
    return NextResponse.json(
      { error: "Повторная отправка доступна только после отказа" },
      { status: 400 },
    );
  }

  await prisma.instructorProfile.update({
    where: { userId },
    data: {
      verificationStatus: "PENDING",
      profileDraftRejectNote: null,
      profileDraftRejectedAt: null,
    },
  });

  return NextResponse.json({ ok: true, verificationStatus: "PENDING" });
}
