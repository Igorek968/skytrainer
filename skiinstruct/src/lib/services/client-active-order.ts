import type { OrderStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** У клиента одновременно только одна «рабочая» заявка. */
export const CLIENT_ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "DRAFT",
  "AWAITING_PAYMENT",
  "PENDING_INSTRUCTOR",
  "ACCEPTED",
  "INSTRUCTOR_EN_ROUTE",
  "LESSON_STARTED",
];

export async function assertClientHasNoOtherActiveOrder(clientId: string, excludeOrderId?: string) {
  const count = await prisma.order.count({
    where: {
      clientId,
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      status: { in: CLIENT_ACTIVE_ORDER_STATUSES },
    },
  });
  if (count > 0) {
    throw new Error("ACTIVE_ORDER_EXISTS");
  }
}
