/** Чистые функции без Node-only зависимостей (безопасно для client bundle). */

function isEventCompleted(
  eventAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!eventAt) return false;
  const t = eventAt instanceof Date ? eventAt.getTime() : new Date(eventAt).getTime();
  if (!Number.isFinite(t)) return false;
  return t <= now.getTime();
}

export function registrationNeedsAttendanceConfirmation(
  reg: {
    status: string;
    attendanceConfirmedAt: Date | null;
  },
  eventAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (reg.status === "CANCELLED") return false;
  if (reg.attendanceConfirmedAt) return false;
  if (!isEventCompleted(eventAt, now)) return false;
  return reg.status === "PAID" || reg.status === "PENDING_PAYMENT";
}

export function attendanceStatusLabel(
  reg: {
    status: string;
    attendanceConfirmedAt: Date | null;
    amountRub: number | import("@prisma/client").Prisma.Decimal;
    paidAt: Date | null;
  },
  eventAt: Date | null | undefined,
): string {
  if (reg.status === "CANCELLED") return "Отменена";
  if (reg.attendanceConfirmedAt) return "Участие подтверждено";
  if (!isEventCompleted(eventAt)) {
    if (reg.status === "PENDING_PAYMENT" && Number(reg.amountRub) > 0) {
      return "Записан · оплата после события";
    }
    if (reg.status === "PAID") return "Записан";
    return "Ожидает оплаты";
  }
  if (Number(reg.amountRub) > 0 && !reg.paidAt) {
    return "Подтвердите участие и оплатите";
  }
  return "Подтвердите участие";
}
