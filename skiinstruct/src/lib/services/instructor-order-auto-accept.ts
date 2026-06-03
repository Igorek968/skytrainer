import type { Order } from "@prisma/client";

/** Запись не «день в день» / на дату — без ожидания принятия инструктором. */
export function orderAutoConfirmsAfterPayment(order: {
  flexibleInstructorInvite: boolean;
  requestedDays: number | null;
  requestedStartDate?: Date | string | null;
}): boolean {
  void order;
  return false;
}

export async function autoAcceptOrderIfScheduled(orderId: string): Promise<Order | null> {
  void orderId;
  return null;
}
