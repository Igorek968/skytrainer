import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import {
  canEditInstructorEvent,
  isInstructorEventCompleted,
  serializeInstructorEvent,
} from "@/lib/instructor-events";
import { isInstructorEventAutoApproveEnabled } from "@/lib/instructor-event-moderation-config";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: Ctx) {
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

  if (!existing.eventAt) {
    return NextResponse.json(
      { error: "Укажите дату и время мероприятия перед отправкой на модерацию" },
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
  });

  return NextResponse.json({
    event: serializeInstructorEvent(row),
    autoApproveEnabled: autoApprove,
    message: autoApprove
      ? "Опубликовано — появится в общей ленте мероприятий у всех клиентов."
      : "Отправлено на модерацию. После одобрения администратором появится в ленте у всех клиентов.",
  });
}
