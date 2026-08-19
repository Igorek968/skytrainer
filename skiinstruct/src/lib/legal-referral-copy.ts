import {
  PAYOUT_MIN_WITHDRAWAL_RUB,
  REFERRAL_COOKIE_MAX_AGE_DAYS,
  REFERRAL_MAX_ORDERS_PER_CLIENT,
  REFERRAL_PROGRAM_END_DATE,
  REFERRAL_REWARD_RUB,
} from "@/lib/legal-config";

/** Краткое описание реферальной программы (синхронизировано с referral.ts). */
export function referralProgramSummary(): string {
  return `${REFERRAL_REWARD_RUB} ₽ за каждый из первых ${REFERRAL_MAX_ORDERS_PER_CLIENT} завершённых оплаченных заказов приглашённого клиента; программа действует до ${REFERRAL_PROGRAM_END_DATE}; ссылка учитывается ${REFERRAL_COOKIE_MAX_AGE_DAYS} дней; вывод от ${PAYOUT_MIN_WITHDRAWAL_RUB} ₽`;
}
