import { NextResponse } from "next/server";
import { z } from "zod";

import { loadEventReviewsList } from "@/lib/services/event-reviews";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    eventId: z.string().min(8).max(64).optional(),
    catalogId: z.string().min(8).max(64).optional(),
  })
  .refine((v) => Boolean(v.eventId || v.catalogId), { message: "Укажите событие" });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    eventId: url.searchParams.get("eventId") || undefined,
    catalogId: url.searchParams.get("catalogId") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Укажите событие" }, { status: 400 });
  }

  const reviews = await loadEventReviewsList({
    eventId: parsed.data.eventId,
    catalogId: parsed.data.catalogId,
  });

  return NextResponse.json({ reviews });
}
