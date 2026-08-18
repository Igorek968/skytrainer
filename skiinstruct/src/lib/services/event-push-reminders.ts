import { prisma } from "@/lib/prisma";
import { isInStartReminderWindow, startReminderWindow } from "@/lib/reminder-timing";
import { sendWebPushToUser } from "@/lib/push-web";

const ACTIVE_STATUSES = ["PAID", "PENDING_PAYMENT"] as const;

function formatStartLabel(at: Date): string {
  return at.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Web Push за ~1 час до события: клиентам с записью и инструктору (один раз на слот / событие).
 */
export async function processEventPushReminders(): Promise<{
  clientReminders: number;
  instructorReminders: number;
}> {
  const now = Date.now();
  const nowDate = new Date(now);
  const { min: startMin, max: startMax } = startReminderWindow(now);

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
      slotId: true,
      slot: { select: { id: true, startsAt: true, startReminderSentAt: true } },
      event: {
        select: {
          id: true,
          title: true,
          instructorId: true,
          eventAt: true,
          startReminderSentAt: true,
        },
      },
    },
  });

  let clientReminders = 0;
  let instructorReminders = 0;

  for (const reg of registrations) {
    const effectiveAt = reg.slot?.startsAt ?? reg.event.eventAt;
    if (!effectiveAt || !isInStartReminderWindow(effectiveAt, now)) continue;

    const startLabel = formatStartLabel(effectiveAt);
    const clientPush = await sendWebPushToUser(reg.clientId, {
      title: "Скоро событие",
      body: `Через ~1 час: «${reg.event.title}» (${startLabel}). Откройте заявку.`,
      url: `/client/registrations/${reg.id}`,
      tag: `event-start-${reg.id}`,
    });

    if (clientPush.sent > 0) {
      await prisma.eventRegistration.update({
        where: { id: reg.id },
        data: { eventStartReminderSentAt: nowDate },
      });
      clientReminders += 1;
    }

    const instructorAlreadySent = reg.slot
      ? reg.slot.startReminderSentAt
      : reg.event.startReminderSentAt;

    if (!instructorAlreadySent) {
      const insPush = await sendWebPushToUser(reg.event.instructorId, {
        title: "Скоро событие",
        body: `Через ~1 час начало «${reg.event.title}» (${startLabel}).`,
        url: "/instructor#events",
        tag: `event-start-inst-${reg.event.id}-${reg.slotId ?? "main"}`,
      });

      if (insPush.sent > 0) {
        if (reg.slot) {
          await prisma.eventSlot.update({
            where: { id: reg.slot.id },
            data: { startReminderSentAt: nowDate },
          });
        } else {
          await prisma.instructorEvent.update({
            where: { id: reg.event.id },
            data: { startReminderSentAt: nowDate },
          });
        }
        instructorReminders += 1;
      }
    }
  }

  return { clientReminders, instructorReminders };
}
