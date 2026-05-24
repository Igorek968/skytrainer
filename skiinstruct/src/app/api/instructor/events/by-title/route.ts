import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { serializeInstructorEvent } from "@/lib/instructor-events";
import { findLatestEventByTitle } from "@/lib/services/instructor-event-titles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const title = new URL(req.url).searchParams.get("title")?.trim() ?? "";
  if (!title) {
    return NextResponse.json({ error: "Укажите title" }, { status: 400 });
  }

  const row = await findLatestEventByTitle(userId, title);
  if (!row) {
    return NextResponse.json({ event: null });
  }

  return NextResponse.json({ event: serializeInstructorEvent(row) });
}
