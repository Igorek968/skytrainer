import { NextResponse } from "next/server";

import { archivePastPublishedInstructorEvents } from "@/lib/services/instructor-event-expiry";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

/** Vercel Cron: GET ?secret=CRON_SECRET — архив прошедших мероприятий */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const archived = await archivePastPublishedInstructorEvents();
  return NextResponse.json({ archived });
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const archived = await archivePastPublishedInstructorEvents();
  return NextResponse.json({ archived });
}
