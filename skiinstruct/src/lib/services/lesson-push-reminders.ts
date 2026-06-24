import type { LessonDuration } from "@prisma/client";

import {
  isInLessonEndReminderWindow,
  isInLessonStartNowWindow,
} from "@/lib/order-lesson-reminder-windows";
import { prisma } from "@/lib/prisma";
import { startReminderWindow } from "@/lib/reminder-timing";
import { sendWebPushToUser } from "@/lib/push-web";

const MS = 1_000;

/**
 * Web Push: за ~1 ч до начала; в момент старта; после планового конца — «завершить урок».
 */
export async function processLessonPushReminders(): Promise<{
  startReminders: number;
  atStartReminders: number;
  endReminders: number;
}> {
  const now = Date.now();
  const nowDate = new Date(now);

  const { min: startMin, max: startMax } = startReminderWindow(now);

  const forStart = await prisma.order.findMany({
    where: {
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
      tag: `lesson-1h-${o.id}`,
      kind: "lesson-reminder" as const,
      sound: "reminder" as const,
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

  const forAtStart = await prisma.order.findMany({
    where: {
      status: { in: ["ACCEPTED", "INSTRUCTOR_EN_ROUTE"] },
      requestedStartDate: { not: null },
      lessonAtStartReminderSentAt: null,
      instructorId: { not: null },
    },
    select: {
      id: true,
      clientId: true,
      instructorId: true,
      requestedStartDate: true,
    },
  });

  let atStartReminders = 0;
  for (const o of forAtStart) {
    if (!isInLessonStartNowWindow(o.requestedStartDate, now)) continue;
    const ins = o.instructorId!;
    const startLabel = o.requestedStartDate
      ? new Date(o.requestedStartDate).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
      : "";
    const payload = {
      title: "Пора начать тренировку",
      body: `Наступило время занятия (${startLabel}). Откройте заказ и нажмите «Начать урок».`,
      tag: `lesson-start-${o.id}`,
      kind: "lesson-reminder" as const,
      sound: "reminder" as const,
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
        data: { lessonAtStartReminderSentAt: nowDate },
      });
      atStartReminders += 1;
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
    if (!isInLessonEndReminderWindow(o.lessonStartedAt, o.duration as LessonDuration, now)) continue;

    const ins = o.instructorId!;
    const payload = {
      title: "Завершите сделку",
      body: "Урок по расписанию окончен. Нажмите «Завершить урок» в заказе — так фиксируется оплата и статус.",
      tag: `lesson-end-${o.id}`,
      kind: "lesson-reminder" as const,
      sound: "reminder" as const,
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

  return { startReminders, atStartReminders, endReminders };
}
