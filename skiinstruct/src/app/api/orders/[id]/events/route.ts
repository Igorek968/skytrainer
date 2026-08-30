import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { enrichClientEvent } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { loadEventReviewsForFeed, reviewsOrEmpty } from "@/lib/services/event-reviews";
import {
  archivePastPublishedInstructorEvents,
  isVisibleInClientEventFeed,
} from "@/lib/services/instructor-event-expiry";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { clientId: true, instructorId: true, status: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const uid = session.user.id;
  let role: UserRole | undefined = session.user.role;
  if (!role) {
    const row = await prisma.user.findUnique({
      where: { id: uid },
      select: { role: true },
    });
    role = row?.role ?? undefined;
  }

  const allowed =
    order.clientId === uid || order.instructorId === uid || role === "ADMIN" || role === "MODERATOR";
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!order.instructorId) {
    return NextResponse.json({ events: [] });
  }

  const now = new Date();
  await archivePastPublishedInstructorEvents({ instructorId: order.instructorId, now });

  const rows = await prisma.instructorEvent.findMany({
    where: {
      instructorId: order.instructorId,
      moderationStatus: "PUBLISHED",
      AND: [
        { OR: [{ eventAt: null }, { eventAt: { gt: now } }] },
        { OR: [{ orderId: null }, { orderId: orderId }] },
      ],
    },
    orderBy: [{ eventAt: "desc" }, { createdAt: "desc" }],
    take: 30,
    include: {
      slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
      registrations: {
        where: { clientId: order.clientId },
        take: 10,
      },
    },
  });

  const events = (
    await Promise.all(
      rows.map((row) =>
        enrichClientEvent(
          row,
          row.registrations[0] ?? null,
          undefined,
          order.clientId === uid ? order.clientId : null,
        ),
      ),
    )
  ).filter((event) => isVisibleInClientEventFeed(event, now));

  const eventIds = events.map((e) => e.id);
  const catalogIds = [...new Set(events.map((e) => e.catalogItemId).filter((id): id is string => Boolean(id)))];
  const reviewMaps = await loadEventReviewsForFeed({ eventIds, catalogIds });
  const withReviews = events.map((event) => {
    const summary = event.catalogItemId
      ? reviewsOrEmpty(reviewMaps.byCatalogId.get(event.catalogItemId))
      : reviewsOrEmpty(reviewMaps.byEventId.get(event.id));
    return {
      ...event,
      ratingAvg: summary.ratingAvg,
      reviewCount: summary.reviewCount,
      reviewsPreview: summary.reviewsPreview,
    };
  });

  return NextResponse.json({ events: withReviews });
}
