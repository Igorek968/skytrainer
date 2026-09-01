import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getInstructorPublicBusyWeek } from "@/lib/services/instructor-schedule";
import { resolveInstructorByPublicKey } from "@/lib/services/instructor-nickname-uniqueness";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/** Публичная занятость инструктора на текущую неделю (без имён клиентов). */
export async function GET(req: Request, ctx: Ctx) {
  const { id: publicKey } = await ctx.params;
  const week = new URL(req.url).searchParams.get("week")?.trim() || undefined;

  const resolved = await resolveInstructorByPublicKey(publicKey);
  if (!resolved) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }
  const id = resolved.id;

  const instructor = await prisma.user.findFirst({
    where: {
      id,
      role: "INSTRUCTOR",
      instructorProfile: { is: { verificationStatus: "APPROVED" } },
    },
    select: { id: true },
  });

  if (!instructor) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }

  const schedule = await getInstructorPublicBusyWeek(id, week);
  return NextResponse.json(
    { schedule },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
