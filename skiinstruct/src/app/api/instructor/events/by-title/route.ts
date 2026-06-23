import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { formatSlotTimeRu, serializeInstructorEvent } from "@/lib/instructor-events";
import { findLatestEventByTitleForTemplate } from "@/lib/services/instructor-event-titles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const title = new URL(req.url).searchParams.get("title")?.trim() ?? "";
  if (!title) {
    return NextResponse.json({ error: "Укажите title" }, { status: 400 });
  }

  const row = await findLatestEventByTitleForTemplate(userId, title);
  if (!row) {
    return NextResponse.json({ event: null });
  }

  const slots = row.slots ?? [];
  const base = serializeInstructorEvent(row, { slots });
  if (!slots.length) {
    return NextResponse.json({ event: { ...base, slots: [] } });
  }
  return NextResponse.json({
    event: {
      ...base,
      hasSlots: true,
      slots: slots.map((s) => ({
        id: s.id,
        time: formatSlotTimeRu(s.startsAt),
        maxSeats: s.maxSeats,
        priceRub: s.priceRub,
        startsAt: s.startsAt.toISOString(),
      })),
    },
  });
}
