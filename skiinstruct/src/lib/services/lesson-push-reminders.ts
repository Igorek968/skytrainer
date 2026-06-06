import type { LessonDuration } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { durationHours } from "@/lib/pricing";
import { startReminderWindow } from "@/lib/reminder-timing";
import { sendWebPushToUser } from "@/lib/push-web";

const MS = 1_000;

/** Напоминание о завершении: с планового конца урока до +20 мин, один раз. */
const END_GRACE_AFTER_MS = 20 * 60 * MS;

function expectedLessonEndMs(startedAt: Date, duration: LessonDuration): number {
  const hours = durationHours(duration);
  return startedAt.getTime() + hours * 60 * 60 * MS;
}

/**
 * Напоминания Web Push: за ~1 час до requestedStartDate; после планового конца урока — «нажмите завершить».
 */
export async function processLessonPushReminders(): Promise<{
  startReminders: number;
  endReminders: number;
}> {
  const now = Date.now();
  const nowDate = new Date(now);

  const { min: startMin, max: startMax } = startReminderWindow(now);

  const forStart = await prisma.order.findMany({
    where: {
      /** PENDING_INSTRUCTOR — оплачено, ждём принятия; напоминание за минуту до старта всё равно нужно. */
      status: { in: ["PENDING_INSTRUCTOR", "ACCEPTED", "INSTRUCTOR_EN_ROUTE"] },
      requestedStartDate: { gte: startMin, lte: startMax },
      lessonStartReminderSentAt: null,
      instructorId: { not: null },
    },
    select: {
      id: true,
      clientId: true,
      instructorId: true,
      requestedStartDate: true,
    },
  });

  let startReminders = 0;
  for (const o of forStart) {
    const ins = o.instructorId!;
    const startLabel = o.requestedStartDate
      ? new Date(o.requestedStartDate).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
      : "";
    const payload = {
      title: "Скоро начало урока",
      body: `Через ~1 час начало занятия (${startLabel}). Откройте заказ.`,
      tag: `lesson-start-${o.id}`,
    };
    const r1 = await sendWebPushToUser(o.clientId, {
      ...payload,
      url: `/client/orders/${o.id}`,
    });
    const r2 = await sendWebPushToUser(ins, {
      ...payload,
      url: `/instructor/orders/${o.id}`,
    });
    if (r1.sent + r2.sent > 0) {
      await prisma.order.update({
        where: { id: o.id },
        data: { lessonStartReminderSentAt: nowDate },
      });
      startReminders += 1;
    }
  }

  const active = await prisma.order.findMany({
    where: {
      status: "LESSON_STARTED",
      lessonStartedAt: { not: null },
      lessonEndReminderSentAt: null,
      instructorId: { not: null },
    },
    select: {
      id: true,
      clientId: true,
      instructorId: true,
      lessonStartedAt: true,
      duration: true,
    },
  });

  let endReminders = 0;
  for (const o of active) {
    if (!o.lessonStartedAt) continue;
    const endMs = expectedLessonEndMs(o.lessonStartedAt, o.duration);
    if (now < endMs - 30 * MS) continue;
    if (now > endMs + END_GRACE_AFTER_MS) continue;

    const ins = o.instructorId!;
    const payload = {
      title: "Урок по расписанию завершён",
      body: "Не забудьте нажать «Завершить урок» в заказе — так фиксируется оплата и статус.",
      tag: `lesson-end-${o.id}`,
    };
    const r1 = await sendWebPushToUser(ins, {
      ...payload,
      url: `/instructor/orders/${o.id}`,
    });
    const r2 = await sendWebPushToUser(o.clientId, {
      ...payload,
      url: `/client/orders/${o.id}`,
    });
    if (r1.sent + r2.sent > 0) {
      await prisma.order.update({
        where: { id: o.id },
        data: { lessonEndReminderSentAt: nowDate },
      });
      endReminders += 1;
    }
  }

  return { startReminders, endReminders };
}
