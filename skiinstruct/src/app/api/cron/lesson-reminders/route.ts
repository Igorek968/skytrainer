import { NextResponse } from "next/server";

import { authorizeCronRequest } from "@/lib/cron-auth";
import { processLessonPushReminders } from "@/lib/services/lesson-push-reminders";

/** Рекомендуется вызывать каждую минуту (cron / Task Scheduler) с CRON_SECRET. */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await processLessonPushReminders();
  return NextResponse.json(r);
}

export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await processLessonPushReminders();
  return NextResponse.json(r);
}
