import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import {
  assertCanEditCatalogOffer,
  findActiveCatalogOffer,
  resolveCatalogOfferEventAt,
  serializeMyCatalogOffer,
} from "@/lib/services/catalog-join";
import { updateCatalogOfferSchema } from "@/lib/validations/event-catalog";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Обновить черновик / отклонённую заявку на участие (до повторной отправки через join). */
export async function PATCH(req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id: catalogItemId } = await ctx.params;
  const existing = await findActiveCatalogOffer(userId, catalogItemId);
  if (!existing) {
    return NextResponse.json({ error: "Активная заявка не найдена" }, { status: 404 });
  }

  const editError = assertCanEditCatalogOffer(existing);
  if (editError) {
    return NextResponse.json({ error: editError }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateCatalogOfferSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const catalog = await prisma.eventCatalogItem.findUnique({ where: { id: catalogItemId } });
  if (!catalog) {
    return NextResponse.json({ error: "Карточка каталога не найдена" }, { status: 404 });
  }

  let eventAt = existing.eventAt;
  if (parsed.data.eventAt !== undefined) {
    const resolved = resolveCatalogOfferEventAt(catalog, parsed.data.eventAt);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    eventAt = resolved.eventAt;
  }

  const row = await prisma.instructorEvent.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.serviceNote !== undefined ? { body: parsed.data.serviceNote } : {}),
      ...(parsed.data.priceRub !== undefined ? { priceRub: parsed.data.priceRub } : {}),
      ...(parsed.data.maxRegistrations !== undefined
        ? { maxRegistrations: parsed.data.maxRegistrations }
        : {}),
      eventAt,
      rejectNote: null,
      moderationStatus: "DRAFT",
      title: catalog.title,
      photoUrl: catalog.photoUrl,
      venueAddress: catalog.venueAddress,
      venueLat: catalog.venueLat,
      venueLng: catalog.venueLng,
    },
  });

  return NextResponse.json({
    offer: serializeMyCatalogOffer(row),
    message: "Заявка обновлена. Отправьте её снова через «Присоединиться».",
  });
}

/** Отозвать участие / снять оффер с карточки каталога. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id: catalogItemId } = await ctx.params;
  const existing = await findActiveCatalogOffer(userId, catalogItemId);
  if (!existing) {
    return NextResponse.json({ error: "Активная заявка не найдена" }, { status: 404 });
  }

  const paidCount = await prisma.eventRegistration.count({
    where: { eventId: existing.id, status: { in: ["PAID", "PENDING_PAYMENT"] } },
  });

  if (existing.moderationStatus === "PUBLISHED" && paidCount > 0) {
    return NextResponse.json(
      {
        error:
          "Нельзя отозвать участие: есть оплаченные или ожидающие оплаты записи. Снимите мероприятие через «Скрыть» после завершения.",
      },
      { status: 400 },
    );
  }

  if (
    (existing.moderationStatus === "DRAFT" ||
      existing.moderationStatus === "REJECTED" ||
      existing.moderationStatus === "PENDING_REVIEW") &&
    paidCount === 0
  ) {
    await prisma.instructorEvent.delete({ where: { id: existing.id } });
    return NextResponse.json({ message: "Заявка удалена" });
  }

  await prisma.instructorEvent.update({
    where: { id: existing.id },
    data: { moderationStatus: "ARCHIVED" },
  });

  return NextResponse.json({
    message: "Участие отозвано — вы больше не отображаетесь в карточке каталога",
  });
}
