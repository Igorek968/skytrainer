import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import {
  getClientRatingsByInstructor,
  type InstructorRegistrationListItem,
} from "@/lib/instructor-event-registration";
import {
  canEditInstructorEvent,
  canRestoreArchivedEvent,
  isInstructorEventCompleted,
  moderationStatusLabel,
} from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import {
  cancelEventRegistrationByInstructor,
  computeEventRegistrationCancelQuote,
  computeInstructorEventRegistrationCancelQuote,
} from "@/lib/services/event-registration-cancel";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["preview_cancel", "cancel", "request_event_edit"]),
});

export async function GET(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id } = await ctx.params;

  const row = await prisma.eventRegistration.findFirst({
    where: { id, event: { instructorId: userId } },
    include: {
      client: { select: { id: true, name: true, email: true, image: true } },
      event: true,
      slot: { select: { startsAt: true } },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ratings = await getClientRatingsByInstructor(userId, [row.clientId]);
  const rating = ratings.get(row.clientId);

  const cancelQuote = computeInstructorEventRegistrationCancelQuote({
    status: row.status,
    amountRub: row.amountRub,
    paidAt: row.paidAt,
    instructorNoShowRefundClaimedAt: row.instructorNoShowRefundClaimedAt,
    event: { eventAt: row.event.eventAt },
    slot: row.slot ? { startsAt: row.slot.startsAt } : null,
  });

  const eventDto = {
    id: row.event.id,
    title: row.event.title,
    body: row.event.body,
    eventAt: row.event.eventAt?.toISOString() ?? null,
    priceRub: row.event.priceRub,
    maxRegistrations: row.event.maxRegistrations,
    moderationStatus: row.event.moderationStatus,
    moderationStatusLabel: moderationStatusLabel(row.event.moderationStatus),
    isCompleted: isInstructorEventCompleted(row.event.eventAt),
    canEdit: canEditInstructorEvent(row.event),
    canRestoreArchived: canRestoreArchivedEvent({
      moderationStatus: row.event.moderationStatus,
      isCompleted: isInstructorEventCompleted(row.event.eventAt),
      paidRegistrationCount: undefined,
    }),
  };

  const registration: InstructorRegistrationListItem & {
    event: typeof eventDto & { body: string };
    canCancelRegistration: boolean;
    cancelRegistrationReason: string | null;
    canRequestEventEdit: boolean;
    eventEditHint: string | null;
  } = {
    id: row.id,
    status: row.status,
    amountRub: Number(row.amountRub),
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    client: {
      id: row.client.id,
      name: row.client.name,
      email: row.client.email,
      image: row.client.image,
      ratingAvg: rating?.avg ?? null,
      ratingCount: rating?.count ?? 0,
    },
    event: {
      ...eventDto,
      body: row.event.body,
    },
    canCancelRegistration: cancelQuote.canCancel,
    cancelRegistrationReason: cancelQuote.canCancel ? null : cancelQuote.reason,
    canRequestEventEdit:
      row.event.moderationStatus === "PUBLISHED" && !isInstructorEventCompleted(row.event.eventAt),
    eventEditHint:
      row.event.moderationStatus === "PUBLISHED"
        ? "Изменения только через модерацию: событие вернётся в черновик, после правок отправьте на проверку администратору."
        : row.event.moderationStatus === "ARCHIVED"
          ? "Скрытое событие: восстановите черновик на странице профиля, затем «На модерацию»."
          : null,
  };

  return NextResponse.json({ registration });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.eventRegistration.findFirst({
    where: { id, event: { instructorId: userId } },
    include: {
      event: true,
      slot: { select: { startsAt: true } },
      client: { select: { name: true, email: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.action === "request_event_edit") {
    const event = row.event;
    if (event.moderationStatus !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Редактирование через модерацию доступно для опубликованных событий" },
        { status: 400 },
      );
    }
    if (isInstructorEventCompleted(event.eventAt)) {
      return NextResponse.json({ error: "Событие уже прошло" }, { status: 400 });
    }
    const paidCount = await prisma.eventRegistration.count({
      where: { eventId: event.id, status: "PAID" },
    });
    if (paidCount > 0) {
      return NextResponse.json(
        {
          error:
            "Есть активные записи. Сначала отмените заявки участников, затем запросите изменение.",
        },
        { status: 400 },
      );
    }
    await prisma.instructorEvent.update({
      where: { id: event.id },
      data: {
        moderationStatus: "DRAFT",
        rejectNote: null,
        submittedAt: null,
        publishedAt: null,
      },
    });
    return NextResponse.json({
      ok: true,
      eventId: event.id,
      message: `Событие «${event.title}» в черновиках. Измените и отправьте на модерацию.`,
    });
  }

  const quote = computeInstructorEventRegistrationCancelQuote({
    status: row.status,
    amountRub: row.amountRub,
    paidAt: row.paidAt,
    instructorNoShowRefundClaimedAt: row.instructorNoShowRefundClaimedAt,
    event: { eventAt: row.event.eventAt },
    slot: row.slot ? { startsAt: row.slot.startsAt } : null,
  });

  if (parsed.data.action === "preview_cancel") {
    if (!quote.canCancel) {
      return NextResponse.json({ error: quote.reason }, { status: 400 });
    }
    return NextResponse.json({
      refundPercent: quote.refundPercent,
      refundAmount: quote.refundAmount,
      reason: `Отмена записи клиента ${row.client.name ?? row.client.email}. ${quote.reason}`,
    });
  }

  try {
    const result = await cancelEventRegistrationByInstructor({
      registrationId: id,
      instructorId: userId,
    });
    return NextResponse.json({
      ok: true,
      refundPercent: result.refundPercent,
      refundAmount: result.refundAmount,
      reason: result.reason,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось отменить";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
