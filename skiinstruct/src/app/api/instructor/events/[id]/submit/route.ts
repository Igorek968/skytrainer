import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import {
  canEditInstructorEvent,
  isInstructorEventCompleted,
  serializeInstructorEvent,
} from "@/lib/instructor-events";
import { isInstructorEventAutoApproveEnabled } from "@/lib/instructor-event-moderation-config";
import { prisma } from "@/lib/prisma";
import { ensureUpcomingDailyCopy } from "@/lib/services/instructor-event-daily-repeat";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: Ctx) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const { id } = await ctx.params;

  const existing = await prisma.instructorEvent.findFirst({
    where: { id, instructorId: userId },
    include: { slots: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  }

  if (existing.moderationStatus === "PENDING_REVIEW") {
    return NextResponse.json({ error: "Уже на модерации" }, { status: 400 });
  }

  if (existing.moderationStatus === "ARCHIVED") {
    if (isInstructorEventCompleted(existing.eventAt)) {
      return NextResponse.json(
        { error: "Выполненное мероприятие нельзя отправить на модерацию" },
        { status: 400 },
      );
    }
    const paidCount = await prisma.eventRegistration.count({
      where: { eventId: id, status: "PAID" },
    });
    if (paidCount > 0) {
      return NextResponse.json(
        { error: "У мероприятия есть оплаченные записи — создайте новое объявление" },
        { status: 400 },
      );
    }
  } else if (!canEditInstructorEvent(existing)) {
    return NextResponse.json(
      { error: "Выполненное мероприятие нельзя отправить на модерацию" },
      { status: 400 },
    );
  }

  if (!existing.eventAt && existing.slots.length === 0) {
    return NextResponse.json(
      { error: "Укажите день и выходы или дату мероприятия перед отправкой на модерацию" },
      { status: 400 },
    );
  }

  const autoApprove = isInstructorEventAutoApproveEnabled();
  const nextStatus = autoApprove ? "PUBLISHED" : "PENDING_REVIEW";
  const row = await prisma.instructorEvent.update({
    where: { id },
    data: {
      moderationStatus: nextStatus,
      submittedAt: new Date(),
      publishedAt: autoApprove ? new Date() : null,
      rejectNote: null,
    },
    include: { slots: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] } },
  });

  if (autoApprove && row.repeatDaily) {
    await ensureUpcomingDailyCopy(row);
  }

  if (!autoApprove) {
    try {
      const { emitAdminModerationEventAlert } = await import("@/lib/services/admin-alerts");
      const instructor = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      await emitAdminModerationEventAlert({
        eventId: row.id,
        title: row.title,
        instructorName: instructor?.name,
      });
    } catch (e) {
      console.error("[admin-alert] event submit", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    event: serializeInstructorEvent(row),
    autoApproveEnabled: autoApprove,
    message: autoApprove
      ? "Опубликовано — появится в ленте и на карте (если указано место проведения)."
      : "Отправлено на модерацию. После одобрения администратором появится в ленте и на карте у клиентов.",
  });
}
