/** Версия агентской оферты для инструкторов (акцепт в БД). */
export const AGENCY_OFFER_VERSION = "2026-06-08";

/** Дата редакции клиентской оферты (футер, /oferta). */
export const CLIENT_OFFER_VERSION = "2026-06-10";

export const PLATFORM_FEE_PERCENT = 15;

/** До принятия инструктором — полный возврат; после принятия — невозвратно (refund-policy.ts). */
export const CANCEL_CLIENT_FULL_REFUND_HOURS = 24;
export const CANCEL_CLIENT_PARTIAL_REFUND_HOURS = 2;
export const CANCEL_CLIENT_PARTIAL_PERCENT = 50;

/** Опоздание инструктора: полный возврат после ETA + N минут. */
export const INSTRUCTOR_LATE_GRACE_MINUTES = 15;

/** Выплата инструктору: после урока + подтверждение (ч) + мин. рабочих дней. */
export const PAYOUT_CONFIRMATION_HOURS = 24;
export const PAYOUT_DELAY_BUSINESS_DAYS_MIN = 3;
export const PAYOUT_DELAY_BUSINESS_DAYS_MAX = 10;
export const PAYOUT_MIN_WITHDRAWAL_RUB = 500;

/** Реферальная программа: 250 ₽ за каждый из первых 4 завершённых оплаченных заказов приглашённого клиента. */
export const REFERRAL_REWARD_RUB = 250;
export const REFERRAL_MAX_ORDERS_PER_CLIENT = 4;
export const REFERRAL_COOKIE_NAME = "utr_ref";
export const REFERRAL_COOKIE_MAX_AGE_DAYS = 30;

/** Чек НПД: срок загрузки после занятия (ч). */
export const NPD_RECEIPT_DEADLINE_HOURS = 24;

/** Отмена инструктором: не позднее N ч до занятия без штрафа для клиента. */
export const INSTRUCTOR_CANCEL_NOTICE_HOURS = 24;

/** Неявка / поздняя отмена инструктором: штраф в пользу платформы (% от суммы заявки). */
export const INSTRUCTOR_NO_SHOW_PENALTY_PERCENT = 30;

/** Отмена записи на мероприятие клиентом: полный возврат при отмене за N ч и более. */
export const EVENT_CANCEL_FULL_REFUND_HOURS = 24;

/** Рег. номер уведомления Роскомнадзора (NEXT_PUBLIC_PDN_REGISTRY_NUMBER). */
export function roskomnadzorRegistryNumber(): string | null {
  const n = process.env.NEXT_PUBLIC_PDN_REGISTRY_NUMBER?.trim();
  return n || null;
}

export const LEGAL_PLATFORM_NAME =
  process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Инструктор для тебя";

export const LEGAL_PLATFORM_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://utrainer.ru";
