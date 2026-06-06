import { NextResponse } from "next/server";

import { authorizeCronRequest } from "@/lib/cron-auth";
import { processScheduledPushReminders } from "@/lib/services/scheduled-reminders";

/** Резервный вызов извне (cron). В Docker по умолчанию работает встроенный планировщик. */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await processScheduledPushReminders();
  return NextResponse.json(r);
}

export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await processScheduledPushReminders();
  return NextResponse.json(r);
}
