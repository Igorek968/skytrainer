import { enrichClientEvent, type ClientInstructorEventDTO } from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { resolveOptionalClientUserId } from "@/lib/api-session";
import {
  archivePastPublishedInstructorEvents,
  isVisibleInClientEventFeed,
} from "@/lib/services/instructor-event-expiry";

export function publicEventPath(eventId: string): string {
  return `/events/${eventId}`;
}

export async function loadPublicClientEvent(
  eventId: string,
): Promise<ClientInstructorEventDTO | null> {
  const id = eventId.trim();
  if (!id || id.length > 64) return null;

  const now = new Date();
  await archivePastPublishedInstructorEvents({ now });

  const row = await prisma.instructorEvent.findFirst({
    where: { id, moderationStatus: "PUBLISHED", orderId: null },
    include: {
      instructor: {
        select: {
          name: true,
          instructorProfile: { select: { ratingAvg: true } },
        },
      },
      slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
      catalogItem: {
        select: {
          title: true,
          body: true,
          category: true,
          photoUrl: true,
          eventAt: true,
          venueAddress: true,
          venueLat: true,
          venueLng: true,
          status: true,
        },
      },
    },
  });
  if (!row) return null;
  if (row.catalogItem && row.catalogItem.status !== "PUBLISHED") return null;

  const clientId = await resolveOptionalClientUserId();
  const myRegistration = clientId
    ? await prisma.eventRegistration.findFirst({
        where: { eventId: id, clientId },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const event = await enrichClientEvent(
    row,
    myRegistration,
    row.instructor.name,
    clientId,
    row.instructor.instructorProfile?.ratingAvg ?? null,
  );

  const catalog = row.catalogItem;
  if (catalog?.status === "PUBLISHED") {
    const catalogTitle = catalog.title.trim();
    if (catalogTitle) event.title = catalogTitle;
    if (catalog.body.trim()) event.body = catalog.body;
    if (catalog.category?.trim()) event.category = catalog.category;
    if (catalog.photoUrl?.trim()) event.photoUrl = catalog.photoUrl;
    if (catalog.eventAt) event.eventAt = catalog.eventAt.toISOString();
    if (catalog.venueAddress?.trim()) event.venueAddress = catalog.venueAddress;
    if (catalog.venueLat != null) event.venueLat = catalog.venueLat;
    if (catalog.venueLng != null) event.venueLng = catalog.venueLng;
  }

  if (!isVisibleInClientEventFeed(event, now)) return null;
  return event;
}
