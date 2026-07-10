import type { LessonDuration } from "@prisma/client";

import {
  isInLessonEndReminderWindow,
  isInLessonStartNowWindow,
  isInScheduledLessonEndWindow,
  isLessonEndWindowClosing,
  isLessonStartWindowClosing,
  isScheduledLessonEndWindowClosing,
} from "@/lib/order-lesson-reminder-windows";
import { publicSiteHostLabel } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import { startReminderWindow } from "@/lib/reminder-timing";
import { sendWebPushToUser } from "@/lib/push-web";

/**
 * Web Push: за ~1 ч до начала; в момент старта; после планового конца — «завершить урок».
 */
export async function processLessonPushReminders(): Promise<{
  startReminders: number;
  atStartReminders: number;
  endReminders: number;
}> {
  const now = Date.now();
  const siteLabel = publicSiteHostLabel();
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
    const base = {
      tag: `lesson-1h-${o.id}`,
      kind: "lesson-reminder" as const,
      sound: "reminder" as const,
      orderId: o.id,
    };
    const r1 = await sendWebPushToUser(o.clientId, {
      ...base,
      title: "Скоро начало урока",
      body: `Через ~1 час начало занятия (${startLabel}). Откройте ${siteLabel}.`,
      url: `/client/orders/${o.id}`,
    });
    const r2 = await sendWebPushToUser(ins, {
      ...base,
      title: "Скоро начало урока",
      body: `Через ~1 час начало занятия (${startLabel}). Откройте ${siteLabel}.`,
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
    const base = {
      tag: `lesson-start-${o.id}`,
      kind: "lesson-reminder" as const,
      sound: "reminder" as const,
      orderId: o.id,
      lessonPhase: "start" as const,
    };
    const r1 = await sendWebPushToUser(o.clientId, {
      ...base,
      title: "Пора начать тренировку",
      body: `Наступило время занятия (${startLabel}). Откройте ${siteLabel}.`,
      url: `/client/orders/${o.id}`,
    });
    const r2 = await sendWebPushToUser(ins, {
      ...base,
      title: "Пора начать тренировку",
      body: `Наступило время (${startLabel}). Откройте заказ и нажмите «Начать урок».`,
      url: `/instructor/orders/${o.id}?lessonAction=start`,
    });
    const sent = r1.sent + r2.sent > 0;
    const closing = isLessonStartWindowClosing(o.requestedStartDate, now);
    if (sent || closing) {
      await prisma.order.update({
        where: { id: o.id },
        data: { lessonAtStartReminderSentAt: nowDate },
      });
      if (sent) atStartReminders += 1;
    }
  }

  const forEnd = await prisma.order.findMany({
    where: {
      status: { in: ["ACCEPTED", "INSTRUCTOR_EN_ROUTE", "LESSON_STARTED"] },
      lessonEndReminderSentAt: null,
      instructorId: { not: null },
      OR: [{ lessonStartedAt: { not: null } }, { requestedStartDate: { not: null } }],
    },
    select: {
      id: true,
      clientId: true,
      instructorId: true,
      status: true,
      lessonStartedAt: true,
      requestedStartDate: true,
      duration: true,
    },
  });

  let endReminders = 0;
  for (const o of forEnd) {
    const duration = o.duration as LessonDuration;
    const inWindow =
      o.status === "LESSON_STARTED" && o.lessonStartedAt
        ? isInLessonEndReminderWindow(o.lessonStartedAt, duration, now)
        : o.requestedStartDate
          ? isInScheduledLessonEndWindow(o.requestedStartDate, duration, now)
          : false;
    if (!inWindow) continue;

    const ins = o.instructorId!;
    const base = {
      tag: `lesson-end-${o.id}`,
      kind: "lesson-reminder" as const,
      sound: "reminder" as const,
      orderId: o.id,
      lessonPhase: "end" as const,
    };
    const r1 = await sendWebPushToUser(ins, {
      ...base,
      title: "Завершите сделку",
      body: `Урок по расписанию окончен. Нажмите «Завершить урок» на ${siteLabel}.`,
      url: `/instructor/orders/${o.id}?lessonAction=complete`,
    });
    const r2 = await sendWebPushToUser(o.clientId, {
      ...base,
      title: "Урок окончен",
      body: `Занятие по расписанию завершено. Попросите инструктора нажать «Завершить урок» на ${siteLabel}.`,
      url: `/client/orders/${o.id}`,
    });
    const sent = r1.sent + r2.sent > 0;
    const closing =
      o.status === "LESSON_STARTED" && o.lessonStartedAt
        ? isLessonEndWindowClosing(o.lessonStartedAt, duration, now)
        : o.requestedStartDate
          ? isScheduledLessonEndWindowClosing(o.requestedStartDate, duration, now)
          : false;
    if (sent || closing) {
      await prisma.order.update({
        where: { id: o.id },
        data: { lessonEndReminderSentAt: nowDate },
      });
      if (sent) endReminders += 1;
    }
  }

  return { startReminders, atStartReminders, endReminders };
}
