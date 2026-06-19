import type { Order } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { assertInstructorCanAcceptPaidOrders } from "@/lib/instructor-compliance";
import { isMockCheckoutEnabled } from "@/lib/checkout-config";
import { assignInstructorByQueue } from "@/lib/services/instructor-routing";
import { transitionOrderStatus } from "@/lib/services/order-service";
import { orderHasMeetAddress } from "@/shared/lib/order-meet-address";

export type InstructorPendingRespondResult =
  | { ok: true; order: Order }
  | { ok: false; error: string; status: number };

/** Принять или отклонить заявку PENDING_INSTRUCTOR (push / API). */
export async function instructorRespondToPendingOrder(
  orderId: string,
  instructorUserId: string,
  action: "accept" | "reject",
): Promise<InstructorPendingRespondResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Not found", status: 404 };
  if (order.instructorId !== instructorUserId) {
    return { ok: false, error: "Forbidden", status: 403 };
  }
  if (order.status !== "PENDING_INSTRUCTOR") {
    return { ok: false, error: "Заявка уже обработана", status: 409 };
  }

  if (action === "reject") {
    await assignInstructorByQueue(orderId, "reject");
    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    if (!updated) return { ok: false, error: "Not found", status: 404 };
    return { ok: true, order: updated };
  }

  if (
    !isMockCheckoutEnabled() &&
    (order.paymentStatus === "PAID" || order.status === "PENDING_INSTRUCTOR")
  ) {
    const complianceBlock = await assertInstructorCanAcceptPaidOrders(instructorUserId);
    if (complianceBlock) {
      return { ok: false, error: complianceBlock, status: 403 };
    }
  }
  if (!orderHasMeetAddress(order)) {
    return {
      ok: false,
      error: "Нельзя принять: клиент не указал место встречи. Откройте заказ на сайте.",
      status: 400,
    };
  }
  if (order.pendingExpiresAt && order.pendingExpiresAt < new Date()) {
    const routed = await assignInstructorByQueue(orderId, "timeout");
    if (!routed || routed.status === "EXPIRED") {
      return {
        ok: false,
        error: "Время ответа истекло. Заявка закрыта.",
        status: 400,
      };
    }
    return { ok: true, order: routed.order };
  }

  const updated = await transitionOrderStatus({
    orderId,
    actorUserId: instructorUserId,
    to: "ACCEPTED",
    extra: { pendingExpiresAt: null },
  });
  return { ok: true, order: updated };
}
