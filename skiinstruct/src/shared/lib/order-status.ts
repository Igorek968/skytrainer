import type { OrderStatus, PaymentStatus } from "@prisma/client";

/** Заказы в этих статусах клиент может удалить из списка «Мои заказы». */
export function clientCanRemoveOrderFromHistory(status: OrderStatus): boolean {
  return (
    status === "DRAFT" ||
    status === "AWAITING_PAYMENT" ||
    status === "EXPIRED" ||
    status === "CANCELLED" ||
    status === "REJECTED" ||
    status === "COMPLETED"
  );
}

/** Подпись статуса оплаты на экране заявки клиента. */
export function clientPaymentStatusLabel(s: PaymentStatus): string {
  switch (s) {
    case "PAID":
      return "сумма зарезервирована";
    case "PENDING":
      return "ожидает оплаты";
    case "FAILED":
      return "ошибка оплаты";
    default: {
      const _e: never = s;
      return _e;
    }
  }
}

export function orderStatusLabel(s: OrderStatus): string {
  switch (s) {
    case "DRAFT":
      return "Черновик";
    case "AWAITING_PAYMENT":
      return "Ожидает оплаты";
    case "PENDING_INSTRUCTOR":
      return "Ожидает ответа инструктора";
    case "ACCEPTED":
      return "Принято";
    case "INSTRUCTOR_EN_ROUTE":
      return "Инструктор в пути";
    case "LESSON_STARTED":
      return "Урок начался";
    case "COMPLETED":
      return "Завершено";
    case "CANCELLED":
      return "Отменено";
    case "REJECTED":
      return "Отклонено инструктором";
    case "EXPIRED":
      return "Не удалось назначить инструктора";
    default: {
      const _e: never = s;
      return _e;
    }
  }
}
