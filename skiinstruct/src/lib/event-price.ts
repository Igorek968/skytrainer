/** Минимальная платная цена события / слота (₽). 0 или пусто = бесплатно. */
export const EVENT_PRICE_MIN_PAID_RUB = 500;

export const EVENT_PRICE_HINT_RU = "Бесплатно (пусто или 0) либо от 500 ₽";

/** Минимальная ставка занятия ₽/ч. Бесплатные уроки (0) не допускаются. */
export const LESSON_HOURLY_RATE_MIN_PAID_RUB = EVENT_PRICE_MIN_PAID_RUB;

export const LESSON_HOURLY_RATE_HINT_RU = `Минимальная стоимость ${LESSON_HOURLY_RATE_MIN_PAID_RUB} ₽`;

export function parseEventPriceRubInput(raw: string | null | undefined): number | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n)) return NaN as unknown as number;
  return n;
}

/** null / ≤0 — бесплатно; иначе только ≥ EVENT_PRICE_MIN_PAID_RUB. */
export function isValidEventPriceRub(price: number | null | undefined): boolean {
  if (price == null) return true;
  if (!Number.isFinite(price)) return false;
  const n = Math.round(price);
  if (n <= 0) return true;
  return n >= EVENT_PRICE_MIN_PAID_RUB && n <= 500_000;
}

export function eventPriceRubError(price: number | null | undefined): string | null {
  if (isValidEventPriceRub(price)) return null;
  if (price != null && Number.isFinite(price) && price > 0 && price < EVENT_PRICE_MIN_PAID_RUB) {
    return `Цена: бесплатно или от ${EVENT_PRICE_MIN_PAID_RUB} ₽ (сейчас ${Math.round(price)} ₽)`;
  }
  return `Цена: ${EVENT_PRICE_HINT_RU}`;
}

export function eventPriceRubErrorFromInput(raw: string | null | undefined): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0) return "Некорректная цена";
  return eventPriceRubError(n);
}

/** Ставка занятия: только от LESSON_HOURLY_RATE_MIN_PAID_RUB до 100_000. */
export function isValidLessonHourlyRate(rate: number | null | undefined): boolean {
  if (rate == null || !Number.isFinite(rate)) return false;
  const n = Math.round(rate);
  return n >= LESSON_HOURLY_RATE_MIN_PAID_RUB && n <= 100_000;
}

/** Черновик ставки: пустое поле → 0 (невалидно), значения ниже минимума не поднимаем. */
export function normalizeLessonHourlyRate(rate: number): number {
  const n = Math.round(Number(rate));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100_000, n);
}

export function lessonHourlyRateError(rate: number | null | undefined): string | null {
  if (isValidLessonHourlyRate(rate)) return null;
  return LESSON_HOURLY_RATE_HINT_RU;
}
