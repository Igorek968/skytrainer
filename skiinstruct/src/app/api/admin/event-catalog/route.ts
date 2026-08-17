import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { serializeEventCatalogItem, parseOptionalEventAt } from "@/lib/services/event-catalog-admin";
import { createEventCatalogSchema } from "@/lib/validations/event-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const rows = await prisma.eventCatalogItem.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
    include: {
      events: {
        where: { moderationStatus: { in: ["PUBLISHED", "PENDING_REVIEW", "DRAFT", "REJECTED", "ARCHIVED"] } },
        select: { id: true },
      },
    },
  });

  return NextResponse.json({
    items: rows.map(serializeEventCatalogItem),
  });
}

export async function POST(req: Request) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = createEventCatalogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  let eventAt: Date | null;
  try {
    eventAt = parseOptionalEventAt(data.eventAt);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Дата" }, { status: 400 });
  }

  if (data.venueAddress && (data.venueLat == null || data.venueLng == null)) {
    return NextResponse.json(
      { error: "Для адреса укажите координаты места (venueLat / venueLng)" },
      { status: 400 },
    );
  }

  const eventIds = data.eventIds ?? [];
  if (eventIds.length) {
    const published = await prisma.instructorEvent.findMany({
      where: { id: { in: eventIds }, moderationStatus: "PUBLISHED" },
      select: { id: true },
    });
    if (published.length !== eventIds.length) {
      return NextResponse.json(
        { error: "Привязывать можно только опубликованные мероприятия" },
        { status: 400 },
      );
    }
  }

  const publish = data.publish === true;
  const now = new Date();
  const kind = data.kind === "VENUE" ? "VENUE" : "EVENT";
  const listingOnly =
    data.listingOnly != null ? data.listingOnly : kind === "VENUE";

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.eventCatalogItem.create({
      data: {
        title: data.title,
        body: data.body,
        category: data.category,
        kind,
        listingOnly,
        photoUrl: data.photoUrl || null,
        eventAt,
        venueAddress: data.venueAddress || null,
        venueLat: data.venueLat ?? null,
        venueLng: data.venueLng ?? null,
        citySlug: data.citySlug || null,
        status: publish ? "PUBLISHED" : "DRAFT",
        publishedAt: publish ? now : null,
        createdByAdminId: authResult.userId,
      },
    });

    if (eventIds.length) {
      await tx.instructorEvent.updateMany({
        where: { id: { in: eventIds } },
        data: { catalogItemId: created.id, category: data.category },
      });
    }

    return tx.eventCatalogItem.findUniqueOrThrow({
      where: { id: created.id },
      include: { events: { select: { id: true } } },
    });
  });

  return NextResponse.json({
    item: serializeEventCatalogItem(item),
    message: publish ? "Карточка каталога опубликована" : "Черновик каталога создан",
  });
}
