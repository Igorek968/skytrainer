import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { serializeEventCatalogItem } from "@/lib/services/event-catalog-admin";
import { attachCatalogEventsSchema } from "@/lib/validations/event-catalog";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { id } = await ctx.params;
  const catalog = await prisma.eventCatalogItem.findUnique({ where: { id } });
  if (!catalog) return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = attachCatalogEventsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const eventIds = parsed.data.eventIds;
  const published = await prisma.instructorEvent.findMany({
    where: { id: { in: eventIds }, moderationStatus: "PUBLISHED" },
    select: { id: true },
  });
  if (published.length !== eventIds.length) {
    return NextResponse.json(
      { error: "Привязывать можно только опубликованные события" },
      { status: 400 },
    );
  }

  await prisma.instructorEvent.updateMany({
    where: { id: { in: eventIds } },
    data: {
      catalogItemId: id,
      ...(catalog.category ? { category: catalog.category } : {}),
    },
  });

  const row = await prisma.eventCatalogItem.findUniqueOrThrow({
    where: { id },
    include: { events: { select: { id: true } } },
  });

  return NextResponse.json({
    item: serializeEventCatalogItem(row),
    message: `Привязано событий: ${eventIds.length}`,
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { id } = await ctx.params;
  const catalog = await prisma.eventCatalogItem.findUnique({ where: { id } });
  if (!catalog) return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = attachCatalogEventsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.instructorEvent.updateMany({
    where: { id: { in: parsed.data.eventIds }, catalogItemId: id },
    data: { catalogItemId: null },
  });

  const row = await prisma.eventCatalogItem.findUniqueOrThrow({
    where: { id },
    include: { events: { select: { id: true } } },
  });

  return NextResponse.json({
    item: serializeEventCatalogItem(row),
    message: "События отвязаны от карточки",
  });
}
