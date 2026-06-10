import type { InstructorTaxStatus } from "@prisma/client";

/** Сохранение выбранного инструктора между переходом на /login и возвратом на /client. */
export const PENDING_CHECKOUT_STORAGE_KEY = "skiinstruct_pending_checkout";

export type PendingCheckout = {
  instructorId: string;
  instructorName: string | null;
  hourlyRate: number;
  taxStatus?: InstructorTaxStatus | null;
};

export const CLIENT_BOOKING_RETURN_PATH = "/client?checkout=1";

export function savePendingCheckout(payload: PendingCheckout): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, JSON.stringify(payload));
}

export function readPendingCheckout(): PendingCheckout | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as PendingCheckout;
    if (!j?.instructorId || typeof j.instructorId !== "string") return null;
    return {
      instructorId: j.instructorId,
      instructorName: j.instructorName ?? null,
      hourlyRate: Number(j.hourlyRate) || 0,
      taxStatus: j.taxStatus ?? null,
    };
  } catch {
    return null;
  }
}

export function clearPendingCheckout(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
}
