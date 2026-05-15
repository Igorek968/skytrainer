import { NextResponse } from "next/server";

import { processLessonPushReminders } from "@/lib/services/lesson-push-reminders";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

/** Рекомендуется вызывать каждую минуту (cron / Task Scheduler) с CRON_SECRET. */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await processLessonPushReminders();
  return NextResponse.json(r);
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await processLessonPushReminders();
  return NextResponse.json(r);
}
