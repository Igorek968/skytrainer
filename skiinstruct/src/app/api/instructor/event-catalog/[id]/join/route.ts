import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { isInstructorEventAutoApproveEnabled } from "@/lib/instructor-event-moderation-config";
import { prisma } from "@/lib/prisma";
import {
  assertCanEditCatalogOffer,
  buildCatalogOfferCreateData,
  findActiveCatalogOffer,
  resolveCatalogOfferEventAt,
  serializeMyCatalogOffer,
} from "@/lib/services/catalog-join";
import { joinEventCatalogSchema } from "@/lib/validations/event-catalog";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id: catalogItemId } = await ctx.params;
  if (!catalogItemId?.trim()) {
    return NextResponse.json({ error: "Не указан id карточки" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = joinEventCatalogSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const catalog = await prisma.eventCatalogItem.findUnique({ where: { id: catalogItemId } });
  if (!catalog) {
    return NextResponse.json({ error: "Карточка каталога не найдена" }, { status: 404 });
  }
  if (catalog.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: "Присоединиться можно только к опубликованной карточке каталога" },
      { status: 400 },
    );
  }

  const eventAtResolved = resolveCatalogOfferEventAt(catalog, parsed.data.eventAt);
  if (!eventAtResolved.ok) {
    return NextResponse.json({ error: eventAtResolved.error }, { status: 400 });
  }

  const existing = await findActiveCatalogOffer(userId, catalogItemId);
  if (existing) {
    if (existing.moderationStatus === "PUBLISHED" || existing.moderationStatus === "PENDING_REVIEW") {
      return NextResponse.json(
        {
          error:
            existing.moderationStatus === "PUBLISHED"
              ? "Вы уже участвуете в этом событии"
              : "Заявка уже на модерации",
          offer: serializeMyCatalogOffer(existing),
        },
        { status: 409 },
      );
    }
    const editError = assertCanEditCatalogOffer(existing);
    if (editError) {
      return NextResponse.json({ error: editError, offer: serializeMyCatalogOffer(existing) }, { status: 400 });
    }
  }

  const autoApprove = isInstructorEventAutoApproveEnabled();
  const nextStatus = autoApprove ? "PUBLISHED" : "PENDING_REVIEW";
  const now = new Date();
  const priceRub = parsed.data.priceRub ?? null;
  const maxRegistrations = parsed.data.maxRegistrations ?? null;
  const serviceNote = parsed.data.serviceNote;

  const data = buildCatalogOfferCreateData({
    instructorId: userId,
    catalog,
    serviceNote,
    priceRub,
    maxRegistrations,
    eventAt: eventAtResolved.eventAt,
    moderationStatus: nextStatus,
    submittedAt: now,
    publishedAt: autoApprove ? now : null,
  });

  const row = existing
    ? await prisma.instructorEvent.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.instructorEvent.create({ data });

  if (!autoApprove && nextStatus === "PENDING_REVIEW") {
    try {
      const { emitAdminCatalogJoinAlert } = await import("@/lib/services/admin-alerts");
      const instructor = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      await emitAdminCatalogJoinAlert({
        eventId: row.id,
        catalogTitle: catalog.title,
        instructorName: instructor?.name,
      });
    } catch (e) {
      console.error("[admin-alert] catalog join", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    offer: serializeMyCatalogOffer(row),
    autoApproveEnabled: autoApprove,
    message: autoApprove
      ? "Вы присоединились к событию — клиенты увидят вас в списке инструкторов."
      : "Заявка отправлена на модерацию. После одобрения вы появитесь в карточке события у клиентов.",
  });
}
