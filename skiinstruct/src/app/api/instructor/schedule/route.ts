import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { getInstructorWeekSchedule } from "@/lib/services/instructor-schedule";

export async function GET(req: Request) {
  const resolved = await requireInstructorSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const url = new URL(req.url);
  const week = url.searchParams.get("week")?.trim() || undefined;

  const schedule = await getInstructorWeekSchedule(resolved.userId, week);
  return NextResponse.json({ schedule });
}
