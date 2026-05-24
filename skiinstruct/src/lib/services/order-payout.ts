import {
  PAYOUT_CONFIRMATION_HOURS,
  PAYOUT_DELAY_BUSINESS_DAYS_MIN,
  PAYOUT_MIN_WITHDRAWAL_RUB,
} from "@/lib/legal-config";

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return d;
}

/** Момент, с которого доля инструктора доступна к выплате (агентский договор). */
export function computePayoutEligibleAt(lessonEndedAt: Date): Date {
  const afterConfirmation = new Date(
    lessonEndedAt.getTime() + PAYOUT_CONFIRMATION_HOURS * 3600 * 1000,
  );
  return addBusinessDays(afterConfirmation, PAYOUT_DELAY_BUSINESS_DAYS_MIN);
}

export function formatPayoutWindowHint(): string {
  return `${PAYOUT_DELAY_BUSINESS_DAYS_MIN}–10 рабочих дней после подтверждения оказания услуги (не ранее ${PAYOUT_CONFIRMATION_HOURS} ч после занятия)`;
}

export function canRequestWithdrawal(availableRub: number): boolean {
  return availableRub >= PAYOUT_MIN_WITHDRAWAL_RUB;
}
