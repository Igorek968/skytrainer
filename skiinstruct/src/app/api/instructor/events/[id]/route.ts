import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import {
  canEditInstructorEvent,
  isInstructorEventCompleted,
  serializeInstructorEvent,
} from "@/lib/instructor-events";
import { prisma } from "@/lib/prisma";
import { ensureEventReadyForDeletion } from "@/lib/services/event-attendance";
import { upsertInstructorEventTitle } from "@/lib/services/instructor-event-titles";
import { updateInstructorEventSchema } from "@/lib/validations/instructor-event";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

function parseEventAt(raw: string | null | undefined) {
  if (raw === null) return null;
  if (!raw) return undefined;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
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

  const parsed = updateInstructorEventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.instructorEvent.findFirst({
    where: { id, instructorId: userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.moderationStatus === "ARCHIVED") {
    return NextResponse.json(
      { error: "Скрытое мероприятие нельзя редактировать. Создайте новое." },
      { status: 400 },
    );
  }

  if (!canEditInstructorEvent(existing)) {
    return NextResponse.json(
      { error: "Выполненное или опубликованное мероприятие нельзя редактировать" },
      { status: 400 },
    );
  }

  if (existing.moderationStatus === "PENDING_REVIEW") {
    return NextResponse.json(
      { error: "Снимите с модерации нельзя — дождитесь решения администратора" },
      { status: 400 },
    );
  }

  const orderId =
    parsed.data.orderId === undefined ? undefined : parsed.data.orderId?.trim() || null;

  if (orderId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, instructorId: userId },
      select: { id: true },
    });
    if (!order) {
      return NextResponse.json(
        { error: "Заказ не найден или не назначен на вас" },
        { status: 400 },
      );
    }
  }

  const eventAt = parseEventAt(parsed.data.eventAt);
  if (parsed.data.eventAt !== undefined && parsed.data.eventAt && eventAt === null) {
    return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
  }

  let titleId = existing.titleId;
  let title = existing.title;
  if (parsed.data.title !== undefined) {
    const titleRow = await upsertInstructorEventTitle(userId, parsed.data.title);
    titleId = titleRow.id;
    title = titleRow.title;
  }

  const row = await prisma.instructorEvent.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { titleId, title } : {}),
      ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
      ...(orderId !== undefined ? { orderId } : {}),
      ...(eventAt !== undefined ? { eventAt } : {}),
      ...(parsed.data.priceRub !== undefined ? { priceRub: parsed.data.priceRub } : {}),
      ...(parsed.data.maxRegistrations !== undefined
        ? { maxRegistrations: parsed.data.maxRegistrations }
        : {}),
      moderationStatus: "DRAFT",
      rejectNote: null,
    },
  });

  return NextResponse.json({ event: serializeInstructorEvent(row) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id } = await ctx.params;

  const existing = await prisma.instructorEvent.findFirst({
    where: { id, instructorId: userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.moderationStatus === "PUBLISHED") {
    await prisma.instructorEvent.update({
      where: { id },
      data: { moderationStatus: "ARCHIVED" },
    });
    return NextResponse.json({ ok: true, archived: true });
  }

  if (existing.moderationStatus === "ARCHIVED") {
    const isCompleted = isInstructorEventCompleted(existing.eventAt);
    if (isCompleted) {
      const readiness = await ensureEventReadyForDeletion(id);
      if (!readiness.ok) {
        return NextResponse.json(
          {
            error: `Не все участники подтвердили участие (${readiness.unconfirmed}). Отправлены напоминания: ${readiness.reminded}. Удаление возможно после подтверждения.`,
            unconfirmed: readiness.unconfirmed,
            reminded: readiness.reminded,
          },
          { status: 409 },
        );
      }
      await prisma.instructorEvent.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    const paidCount = await prisma.eventRegistration.count({
      where: { eventId: id, status: "PAID" },
    });
    if (paidCount > 0) {
      return NextResponse.json(
        { error: "Нельзя удалить: есть оплаченные записи" },
        { status: 400 },
      );
    }
    await prisma.instructorEvent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (!canEditInstructorEvent(existing) && existing.moderationStatus !== "DRAFT") {
    return NextResponse.json(
      { error: "Удалить можно только черновик или невыполненное отклонённое" },
      { status: 400 },
    );
  }

  await prisma.instructorEvent.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
