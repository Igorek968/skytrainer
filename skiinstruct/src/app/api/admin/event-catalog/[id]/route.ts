import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { serializeEventCatalogItem, parseOptionalEventAt } from "@/lib/services/event-catalog-admin";
import { removePublicUploadByUrl } from "@/lib/public-uploads";
import { updateEventCatalogSchema } from "@/lib/validations/event-catalog";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { id } = await ctx.params;
  const row = await prisma.eventCatalogItem.findUnique({
    where: { id },
    include: {
      events: {
        select: {
          id: true,
          title: true,
          body: true,
          moderationStatus: true,
          instructorId: true,
          instructor: { select: { name: true, email: true } },
          priceRub: true,
          maxRegistrations: true,
          eventAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!row) return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });

  return NextResponse.json({
    item: serializeEventCatalogItem(row),
    events: row.events,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = updateEventCatalogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.eventCatalogItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });

  const data = parsed.data;
  let eventAt: Date | null | undefined;
  if (data.eventAt !== undefined) {
    try {
      eventAt = parseOptionalEventAt(data.eventAt);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Дата" }, { status: 400 });
    }
  }

  const venueAddress = data.venueAddress === undefined ? undefined : data.venueAddress || null;
  const venueLat = data.venueLat === undefined ? undefined : data.venueLat;
  const venueLng = data.venueLng === undefined ? undefined : data.venueLng;

  const nextAddress = venueAddress === undefined ? existing.venueAddress : venueAddress;
  const nextLat = venueLat === undefined ? existing.venueLat : venueLat;
  const nextLng = venueLng === undefined ? existing.venueLng : venueLng;
  if (nextAddress && (nextLat == null || nextLng == null)) {
    return NextResponse.json(
      { error: "Для адреса укажите координаты места (venueLat / venueLng)" },
      { status: 400 },
    );
  }

  const row = await prisma.eventCatalogItem.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.listingOnly !== undefined ? { listingOnly: data.listingOnly } : {}),
      ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl || null } : {}),
      ...(eventAt !== undefined ? { eventAt } : {}),
      ...(venueAddress !== undefined ? { venueAddress } : {}),
      ...(venueLat !== undefined ? { venueLat } : {}),
      ...(venueLng !== undefined ? { venueLng } : {}),
      ...(data.citySlug !== undefined ? { citySlug: data.citySlug || null } : {}),
    },
    include: { events: { select: { id: true } } },
  });

  if (data.category !== undefined) {
    await prisma.instructorEvent.updateMany({
      where: { catalogItemId: id },
      data: { category: data.category },
    });
  }

  return NextResponse.json({ item: serializeEventCatalogItem(row) });
}

/** Безвозвратно удалить карточку каталога. Офферы инструкторов отвязываются (остаются сами по себе). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { id } = await ctx.params;
  const existing = await prisma.eventCatalogItem.findUnique({
    where: { id },
    include: { events: { select: { id: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });
  }

  const detachedCount = existing.events.length;

  await prisma.$transaction(async (tx) => {
    if (detachedCount > 0) {
      await tx.instructorEvent.updateMany({
        where: { catalogItemId: id },
        data: { catalogItemId: null },
      });
    }
    await tx.eventCatalogItem.delete({ where: { id } });
  });

  await removePublicUploadByUrl(existing.photoUrl);

  return NextResponse.json({
    ok: true,
    detachedCount,
    message:
      detachedCount > 0
        ? `Карточка удалена. Отвязано офферов инструкторов: ${detachedCount}`
        : "Карточка каталога удалена",
  });
}
