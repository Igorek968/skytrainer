import type { OrderCancelledBy, OrderStatus } from "@prisma/client";

export function orderCancelledByLabel(by: OrderCancelledBy): string {
  switch (by) {
    case "CLIENT":
      return "клиента";
    case "INSTRUCTOR":
      return "инструктора";
    case "PLATFORM":
      return "платформы";
    case "SYSTEM":
      return "системы";
    default: {
      const _e: never = by;
      return _e;
    }
  }
}

/** Подпись «с чьей стороны» для отменённых и закрытых заявок. */
export function orderCancellationSideText(
  status: OrderStatus,
  cancelledBy?: OrderCancelledBy | null,
): string | null {
  if (status === "CANCELLED") {
    if (!cancelledBy) return null;
    return `Отмена со стороны ${orderCancelledByLabel(cancelledBy)}`;
  }
  if (status === "REJECTED") {
    return "Отмена со стороны инструктора";
  }
  if (status === "EXPIRED") {
    if (cancelledBy) {
      return `Отмена со стороны ${orderCancelledByLabel(cancelledBy)}`;
    }
    return "Отмена со стороны системы";
  }
  return null;
}
