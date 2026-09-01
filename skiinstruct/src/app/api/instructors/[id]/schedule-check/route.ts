import { NextResponse } from "next/server";
import { z } from "zod";

import { findInstructorScheduleConflict } from "@/lib/services/instructor-schedule";
import { resolveInstructorByPublicKey } from "@/lib/services/instructor-nickname-uniqueness";

const querySchema = z.object({
  lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lessonEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lessonStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  lessonEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.enum(["ONE_HOUR", "TWO_HOURS", "HALF_DAY", "FULL_DAY"]),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id: publicKey } = await ctx.params;
  const resolved = await resolveInstructorByPublicKey(publicKey);
  if (!resolved) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }
  const instructorId = resolved.id;
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    lessonDate: url.searchParams.get("lessonDate"),
    lessonEndDate: url.searchParams.get("lessonEndDate") ?? undefined,
    lessonStartTime: url.searchParams.get("lessonStartTime"),
    lessonEndTime: url.searchParams.get("lessonEndTime"),
    duration: url.searchParams.get("duration"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные параметры" }, { status: 400 });
  }

  const conflict = await findInstructorScheduleConflict({
    instructorId,
    ...parsed.data,
    lessonEndDate: parsed.data.lessonEndDate ?? parsed.data.lessonDate,
  });

  return NextResponse.json({
    available: conflict == null,
    conflict: conflict?.message ?? null,
  });
}
