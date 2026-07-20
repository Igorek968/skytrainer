import type { EventRegistrationStatus, OrderStatus } from "@prisma/client";

import { formatRussianPhoneDisplay, normalizeRussianPhone } from "@/lib/phone";

/**
 * Когда можно раскрыть телефон второй стороны по заказу.
 * Клиент — как чат: после оплаты (не AWAITING_PAYMENT).
 * Инструктор — после принятия заявки (можно связаться до оплаты клиента).
 */
export function canRevealOrderContact(
  status: OrderStatus,
  asRole: "CLIENT" | "INSTRUCTOR" | "ADMIN",
): boolean {
  if (asRole === "ADMIN") return true;
  if (
    status === "DRAFT" ||
    status === "PENDING_INSTRUCTOR" ||
    status === "CANCELLED" ||
    status === "EXPIRED"
  ) {
    return false;
  }
  if (asRole === "CLIENT") {
    return status !== "AWAITING_PAYMENT";
  }
  return true;
}

/** Запись на мероприятие: контакт сразу после записи (оплата часто после события). */
export function canRevealRegistrationContact(
  status: EventRegistrationStatus,
  _amountRub?: number,
): boolean {
  return status === "PAID" || status === "PENDING_PAYMENT";
}

export type PaidContactDTO = {
  phoneDisplay: string;
  telHref: string;
  counterpartName: string | null;
};

export function buildPaidContactDTO(
  phoneRaw: string | null | undefined,
  counterpartName: string | null | undefined,
): PaidContactDTO | null {
  if (!phoneRaw?.trim()) return null;
  const digits =
    normalizeRussianPhone(phoneRaw) ??
    (phoneRaw.replace(/\D/g, "").length === 11 ? phoneRaw.replace(/\D/g, "") : null);
  if (!digits || digits.length !== 11 || !digits.startsWith("7")) return null;
  return {
    phoneDisplay: formatRussianPhoneDisplay(digits),
    telHref: `tel:+${digits}`,
    counterpartName: counterpartName?.trim() || null,
  };
}
