import { NextResponse } from "next/server";

import { authorizeCronRequest } from "@/lib/cron-auth";
import { archivePastPublishedInstructorEvents } from "@/lib/services/instructor-event-expiry";

/** Vercel Cron: GET ?secret=CRON_SECRET — архив прошедших мероприятий */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const archived = await archivePastPublishedInstructorEvents();
  return NextResponse.json({ archived });
}

export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const archived = await archivePastPublishedInstructorEvents();
  return NextResponse.json({ archived });
}
