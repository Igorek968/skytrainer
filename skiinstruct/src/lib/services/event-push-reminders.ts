import { prisma } from "@/lib/prisma";
import { sendWebPushToUser } from "@/lib/push-web";
import { isInStartReminderWindow, startReminderWindow } from "@/lib/reminder-timing";
import { APP_TIME_ZONE } from "@/shared/lib/app-timezone";

const ACTIVE_STATUSES = ["PAID", "PENDING_PAYMENT"] as const;

function formatStartLabel(at: Date): string {
  return at.toLocaleString("ru-RU", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Web Push за ~1 час до события:
 * — каждому участнику с активной записью;
 * — инструктору (один раз на событие / слот), даже если записей ещё нет.
 */
export async function processEventPushReminders(): Promise<{
  clientReminders: number;
  instructorReminders: number;
}> {
  const now = Date.now();
  const nowDate = new Date(now);
  const { min: startMin, max: startMax } = startReminderWindow(now);

  let clientReminders = 0;
  let instructorReminders = 0;

  const registrations = await prisma.eventRegistration.findMany({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      eventStartReminderSentAt: null,
      event: { moderationStatus: "PUBLISHED" },
      OR: [
        { slot: { startsAt: { gte: startMin, lte: startMax } } },
        {
          slotId: null,
          event: { eventAt: { gte: startMin, lte: startMax } },
        },
      ],
    },
    select: {
      id: true,
      clientId: true,
      slot: { select: { startsAt: true } },
      event: {
        select: {
          id: true,
          title: true,
          eventAt: true,
        },
      },
    },
  });

  for (const reg of registrations) {
    const effectiveAt = reg.slot?.startsAt ?? reg.event.eventAt;
    if (!effectiveAt || !isInStartReminderWindow(effectiveAt, now)) continue;

    const startLabel = formatStartLabel(effectiveAt);
    const clientPush = await sendWebPushToUser(reg.clientId, {
      title: "Скоро событие",
      body: `Через ~1 час: «${reg.event.title}» (${startLabel}). Откройте заявку.`,
      url: `/client/registrations/${reg.id}`,
      tag: `event-start-${reg.id}`,
      kind: "lesson-reminder",
      sound: "reminder",
    });

    // Помечаем после попытки в окне — иначе без подписки push крутится зря;
    // in-app оповещение работает отдельно через sessionStorage.
    await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: { eventStartReminderSentAt: nowDate },
    });
    if (clientPush.sent > 0) clientReminders += 1;
  }

  const eventsWithoutSlots = await prisma.instructorEvent.findMany({
    where: {
      moderationStatus: "PUBLISHED",
      startReminderSentAt: null,
      eventAt: { gte: startMin, lte: startMax },
      slots: { none: {} },
    },
    select: { id: true, title: true, instructorId: true, eventAt: true },
  });

  for (const event of eventsWithoutSlots) {
    if (!event.eventAt || !isInStartReminderWindow(event.eventAt, now)) continue;
    const startLabel = formatStartLabel(event.eventAt);
    const insPush = await sendWebPushToUser(event.instructorId, {
      title: "Скоро ваше событие",
      body: `Через ~1 час начало «${event.title}» (${startLabel}).`,
      url: "/instructor#events",
      tag: `event-start-inst-${event.id}`,
      kind: "lesson-reminder",
      sound: "reminder",
    });
    await prisma.instructorEvent.update({
      where: { id: event.id },
      data: { startReminderSentAt: nowDate },
    });
    if (insPush.sent > 0) instructorReminders += 1;
  }

  const slots = await prisma.eventSlot.findMany({
    where: {
      startReminderSentAt: null,
      startsAt: { gte: startMin, lte: startMax },
      event: { moderationStatus: "PUBLISHED" },
    },
    select: {
      id: true,
      startsAt: true,
      event: { select: { id: true, title: true, instructorId: true } },
    },
  });

  for (const slot of slots) {
    if (!isInStartReminderWindow(slot.startsAt, now)) continue;
    const startLabel = formatStartLabel(slot.startsAt);
    const insPush = await sendWebPushToUser(slot.event.instructorId, {
      title: "Скоро ваше событие",
      body: `Через ~1 час начало «${slot.event.title}» (${startLabel}).`,
      url: "/instructor#events",
      tag: `event-start-inst-${slot.event.id}-${slot.id}`,
      kind: "lesson-reminder",
      sound: "reminder",
    });
    await prisma.eventSlot.update({
      where: { id: slot.id },
      data: { startReminderSentAt: nowDate },
    });
    if (insPush.sent > 0) instructorReminders += 1;
  }

  return { clientReminders, instructorReminders };
}
