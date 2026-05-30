import { isInstructorEventCompleted } from "@/lib/instructor-events";
import { sendWebPushToUser } from "@/lib/push-web";
import { prisma } from "@/lib/prisma";

import { createEventCheckoutUrl } from "./event-checkout";
import {
  attendanceStatusLabel,
  registrationNeedsAttendanceConfirmation,
} from "./event-attendance-shared";
import { isEventFree } from "./event-registration";

export { attendanceStatusLabel, registrationNeedsAttendanceConfirmation };

const ACTIVE_STATUSES = ["PAID", "PENDING_PAYMENT"] as const;

export async function countUnconfirmedEventAttendance(eventId: string): Promise<number> {
  const event = await prisma.instructorEvent.findUnique({
    where: { id: eventId },
    select: { eventAt: true },
  });
  if (!event || !isInstructorEventCompleted(event.eventAt)) return 0;

  return prisma.eventRegistration.count({
    where: {
      eventId,
      status: { in: [...ACTIVE_STATUSES] },
      attendanceConfirmedAt: null,
    },
  });
}

export async function sendEventAttendanceReminders(
  eventId: string,
): Promise<{ pushSent: number; reminded: number }> {
  const event = await prisma.instructorEvent.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, eventAt: true },
  });
  if (!event || !isInstructorEventCompleted(event.eventAt)) {
    return { pushSent: 0, reminded: 0 };
  }

  const rows = await prisma.eventRegistration.findMany({
    where: {
      eventId,
      status: { in: [...ACTIVE_STATUSES] },
      attendanceConfirmedAt: null,
    },
    select: { id: true, clientId: true, amountRub: true },
  });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  let pushSent = 0;

  for (const row of rows) {
    const paid = Number(row.amountRub) > 0;
    const body = paid
      ? `«${event.title}» — подтвердите участие и оплатите участие инструктору.`
      : `«${event.title}» — подтвердите, что вы были на мероприятии.`;

    const result = await sendWebPushToUser(row.clientId, {
      title: "Подтвердите участие в мероприятии",
      body,
      url: `${origin}/client/registrations/${row.id}?confirm=1`,
      tag: `event-attendance-${row.id}`,
    });
    pushSent += result.sent;

    await prisma.eventRegistration.update({
      where: { id: row.id },
      data: { attendanceReminderSentAt: new Date() },
    });
  }

  return { pushSent, reminded: rows.length };
}

export async function ensureEventReadyForDeletion(eventId: string): Promise<
  | { ok: true }
  | { ok: false; unconfirmed: number; reminded: number; pushSent: number }
> {
  const unconfirmed = await countUnconfirmedEventAttendance(eventId);
  if (unconfirmed === 0) return { ok: true };

  const { reminded, pushSent } = await sendEventAttendanceReminders(eventId);
  return { ok: false, unconfirmed, reminded, pushSent };
}

export async function confirmEventAttendance(params: {
  registrationId: string;
  clientId: string;
}): Promise<{ checkoutUrl: string | null; message: string }> {
  const reg = await prisma.eventRegistration.findFirst({
    where: { id: params.registrationId, clientId: params.clientId },
    include: {
      event: { select: { eventAt: true, priceRub: true, title: true } },
    },
  });
  if (!reg) throw new Error("NOT_FOUND");
  if (reg.status === "CANCELLED") throw new Error("Заявка отменена");
  if (reg.attendanceConfirmedAt) throw new Error("Участие уже подтверждено");
  if (!isInstructorEventCompleted(reg.event.eventAt)) {
    throw new Error("Подтверждение доступно после окончания мероприятия");
  }

  const amount = Number(reg.amountRub);
  const free = isEventFree(reg.event.priceRub) || amount <= 0;

  if (free) {
    await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: {
        status: "PAID",
        paidAt: reg.paidAt ?? new Date(),
        attendanceConfirmedAt: new Date(),
      },
    });
    return { checkoutUrl: null, message: "Спасибо! Участие подтверждено." };
  }

  if (reg.status === "PAID" && reg.paidAt) {
    await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: { attendanceConfirmedAt: new Date() },
    });
    return { checkoutUrl: null, message: "Спасибо! Участие подтверждено." };
  }

  const checkoutUrl = await createEventCheckoutUrl(reg.id);
  return {
    checkoutUrl,
    message: "Перейдите к оплате — после неё участие будет подтверждено, средства поступят инструктору.",
  };
}
