import type { Order } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { transitionOrderStatus } from "@/lib/services/order-service";
import { orderIsFutureLessonDay, orderSpansMultipleLessonDays } from "@/shared/lib/order-flex";

/** Запись на дату / несколько дней / будущий урок — без ожидания ручного принятия. */
export function orderAutoConfirmsAfterPayment(order: {
  flexibleInstructorInvite: boolean;
  requestedDays: number | null;
  requestedStartDate?: Date | string | null;
}): boolean {
  if (order.flexibleInstructorInvite) return true;
  if (orderSpansMultipleLessonDays(order)) return true;
  if (orderIsFutureLessonDay(order)) return true;
  return false;
}

function orderHasMeetAddress(order: { meetAddress: string | null }): boolean {
  return Boolean(order.meetAddress?.trim());
}

/** Автопринятие relaxed-заявок после оплаты (будущие даты, запись на дату). */
export async function autoAcceptOrderIfScheduled(orderId: string): Promise<Order | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING_INSTRUCTOR") return null;
  if (!orderAutoConfirmsAfterPayment(order)) return null;
  if (!orderHasMeetAddress(order)) return null;

  return transitionOrderStatus({
    orderId,
    actorUserId: order.instructorId ?? order.clientId,
    to: "ACCEPTED",
    extra: { pendingExpiresAt: null },
  });
}
