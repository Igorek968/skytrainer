/** Единая дата редакции всех юридических документов (оферты, ПДн, возвраты, реквизиты). */
export const LEGAL_DOCS_VERSION = "2026-07-29";

/** Версия агентской оферты для инструкторов (акцепт в БД). */
export const AGENCY_OFFER_VERSION = LEGAL_DOCS_VERSION;

/** Дата редакции клиентской оферты (футер, /oferta). */
export const CLIENT_OFFER_VERSION = LEGAL_DOCS_VERSION;

/** Формат даты для текста документов: 2026-06-11 → 11.06.2026 */
export function formatLegalEditionDate(version: string = LEGAL_DOCS_VERSION): string {
  const [y, m, d] = version.split("-");
  if (!y || !m || !d) return version.replace(/-/g, ".");
  return `${d}.${m}.${y}`;
}

export const PLATFORM_FEE_PERCENT = 15;

/** Отмена клиентом: более N ч до занятия — полный возврат (refund-policy.ts, оферта п. 5.6). */
export const CANCEL_CLIENT_FULL_REFUND_HOURS = 24;
/** Отмена клиентом: от N до FULL ч — частичный возврат PARTIAL_PERCENT%. */
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

/** Отмена записи на событие клиентом: полный возврат при отмене за N ч и более. */
export const EVENT_CANCEL_FULL_REFUND_HOURS = 24;

/** Претензия по качеству урока: срок подачи после lessonEndedAt (ч). Совпадает с окном удержания выплаты. */
export const QUALITY_CLAIM_WINDOW_HOURS = PAYOUT_CONFIRMATION_HOURS;

/** Минимальная длительность урока (мин), ниже — считается «урок не состоялся». */
export const QUALITY_NO_LESSON_MAX_MINUTES = 5;

/** Порог «сокращённого занятия»: фактическая длительность < N% от заказанной. */
export const QUALITY_SHORT_LESSON_THRESHOLD_PERCENT = 75;

/** Минимальный и максимальный автоматический возврат при сокращённом занятии (%). */
export const QUALITY_SHORT_LESSON_REFUND_MIN_PERCENT = 25;
export const QUALITY_SHORT_LESSON_REFUND_MAX_PERCENT = 75;

/** Возврат при некомпетентности / несоответствии условий (%). */
export const QUALITY_INCOMPETENCE_REFUND_PERCENT = 50;

/** Минимальная длина описания претензии (символов). */
export const QUALITY_CLAIM_MIN_DESCRIPTION_CHARS = 30;

export const COOKIE_CONSENT_COOKIE_NAME = "utr_cookie_consent";
export const COOKIE_CONSENT_STORAGE_KEY = "utr_cookie_consent";
export const COOKIE_CONSENT_VERSION = "1";

/** Рег. номер уведомления Роскомнадзора (NEXT_PUBLIC_PDN_REGISTRY_NUMBER). */
export function roskomnadzorRegistryNumber(): string | null {
  const n = process.env.NEXT_PUBLIC_PDN_REGISTRY_NUMBER?.trim();
  return n || null;
}

export const LEGAL_PLATFORM_NAME =
  process.env.NEXT_PUBLIC_APP_NAME?.trim() || "ТвойТренер.рф";

export const LEGAL_PLATFORM_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://твойтренер.рф";
