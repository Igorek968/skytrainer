import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import {
  CLIENT_EVENTS_RADIUS_KM,
  filterAndSortEventsByDistance,
  instructorEventDistanceKm,
  resolveClientEventsOrigin,
} from "@/lib/client-events-geo";
import { enrichClientEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import {
  activePublishedEventWhere,
  archivePastPublishedInstructorEvents,
  isVisibleInClientEventFeed,
} from "@/lib/services/instructor-event-expiry";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(500).optional().default(CLIENT_EVENTS_RADIUS_KM),
  unlimited: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export async function GET(req: Request) {
  const resolved = await requireClientSession();
  if (isApiErrorResponse(resolved)) return resolved;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { lat, lng, radiusKm, unlimited } = parsed.data;
  const origin = resolveClientEventsOrigin(lat, lng);
  const now = new Date();

  await archivePastPublishedInstructorEvents({ now });

  const rows = await prisma.instructorEvent.findMany({
    where: activePublishedEventWhere(now),
    orderBy: [{ eventAt: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      instructor: {
        select: {
          name: true,
          instructorProfile: { select: { lat: true, lng: true } },
        },
      },
      registrations: {
        where: { clientId: resolved.userId },
        take: 1,
      },
    },
  });

  const withDistance = await Promise.all(
    rows.map(async (row) => {
      const profile = row.instructor.instructorProfile;
      const distanceKm = instructorEventDistanceKm(
        origin.lat,
        origin.lng,
        profile?.lat ?? null,
        profile?.lng ?? null,
      );
      const event = await enrichClientEvent(
        row,
        row.registrations[0] ?? null,
        row.instructor.name,
      );
      return { ...event, distanceKm };
    }),
  );

  const activeOnly = withDistance.filter((event) => isVisibleInClientEventFeed(event, now));

  const events = filterAndSortEventsByDistance(activeOnly, { unlimited, radiusKm }).slice(0, 50);

  return NextResponse.json({
    events,
    meta: {
      originLat: origin.lat,
      originLng: origin.lng,
      radiusKm,
      unlimited,
      totalPublished: rows.length,
      shown: events.length,
    },
  });
}
