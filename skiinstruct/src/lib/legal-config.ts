/** Версия агентской оферты для инструкторов (акцепт в БД). */
export const AGENCY_OFFER_VERSION = "2026-05-13";

export const PLATFORM_FEE_PERCENT = 15;

/** Отмена клиентом: >24 ч — 100%, 2–24 ч — 50%, <2 ч — 0%. */
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

/** Чек НПД: срок загрузки после занятия (ч). */
export const NPD_RECEIPT_DEADLINE_HOURS = 24;

/** Отмена инструктором: не позднее N ч до занятия без штрафа для клиента. */
export const INSTRUCTOR_CANCEL_NOTICE_HOURS = 24;

export const LEGAL_PLATFORM_NAME =
  process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Инструктор для тебя";

export const LEGAL_PLATFORM_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://utrainer.ru";
