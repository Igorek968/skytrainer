import { getPublicProductName } from "@/shared/lib/product";

/** Официальный горизонтальный логотип (SVG). */
export const BRAND_LOGO_HORIZONTAL =
  "/brand/logo-tvoytrener-official.svg?v=space1" as const;

/** Официальный горизонтальный логотип (PNG). */
export const BRAND_LOGO_OFFICIAL_PNG =
  "/brand/logo-tvoytrener-official.png?v=space1" as const;

/** Знак без текста — из официального логотипа. */
export const BRAND_LOGO_MARK = "/brand/logo-mark.svg?v=space1" as const;

/** Знак на тёмном фоне (SVG). */
export const BRAND_LOGO_MARK_ON_DARK = "/brand/logo-mark-on-dark.svg?v=space1" as const;

/** Растровый мастер-файл (PNG, для печати / агентства). */
export const BRAND_LOGO_HORIZONTAL_PNG =
  "/brand/logo-tvoytrener-official.png?v=space1" as const;

/** Пакет для рекламщиков / партнёров. */
export const BRAND_PRESS_DIR = "/brand/press" as const;

/** Wordmark в логотипе: два слова с пробелом, без доменного суффикса. */
export const BRAND_WORDMARK = "Твой Тренер" as const;

/** Бирюзовый из официального логотипа. */
export const BRAND_TEAL = "#027676" as const;

/** Тёмно-синий из официального логотипа. */
export const BRAND_NAVY = "#2E3E55" as const;

export function getBrandAltText(): string {
  return getPublicProductName();
}
