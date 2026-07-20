import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { serializeEventCatalogItem } from "@/lib/services/event-catalog-admin";
import { catalogStatusActionSchema } from "@/lib/validations/event-catalog";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = catalogStatusActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.eventCatalogItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });

  const now = new Date();
  const action = parsed.data.action;

  const data =
    action === "publish"
      ? { status: "PUBLISHED" as const, publishedAt: now, unpublishedAt: null }
      : action === "unpublish"
        ? { status: "UNPUBLISHED" as const, unpublishedAt: now }
        : { status: "ARCHIVED" as const, unpublishedAt: existing.unpublishedAt ?? now };

  const row = await prisma.eventCatalogItem.update({
    where: { id },
    data,
    include: { events: { select: { id: true } } },
  });

  const message =
    action === "publish"
      ? "Карточка опубликована"
      : action === "unpublish"
        ? "Карточка снята с публикации (скрыта из ленты клиентов)"
        : "Карточка архивирована";

  return NextResponse.json({ item: serializeEventCatalogItem(row), message });
}
