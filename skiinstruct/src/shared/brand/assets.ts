import { getPublicProductName } from "@/shared/lib/product";

/** Горизонтальный логотип с текстом (SVG, legacy). */
export const BRAND_LOGO_HORIZONTAL = "/brand/logo-horizontal.svg" as const;

/** Знак без текста — эталонный PNG. */
export const BRAND_LOGO_MARK = "/brand/logo-mark.png" as const;

/** Знак на тёмном фоне (SVG). */
export const BRAND_LOGO_MARK_ON_DARK = "/brand/logo-mark-on-dark.svg" as const;

/** Растровый мастер-файл (PNG, для печати / агентства). */
export const BRAND_LOGO_HORIZONTAL_PNG = "/brand/logo-horizontal.png" as const;

/** Пакет для рекламщиков / партнёров. */
export const BRAND_PRESS_DIR = "/brand/press" as const;

/** Название в шапке: одно слово, без доменного суффикса. */
export const BRAND_WORDMARK = "ТвойТренер" as const;

export function getBrandAltText(): string {
  return getPublicProductName();
}
