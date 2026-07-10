import { getPublicProductName } from "@/shared/lib/product";

/** Горизонтальный логотип с текстом (SVG). */
export const BRAND_LOGO_HORIZONTAL = "/brand/logo-horizontal.svg" as const;

/** Знак без текста (SVG, favicon / иконки). */
export const BRAND_LOGO_MARK = "/brand/logo-mark.svg" as const;

/** Знак на тёмном фоне (SVG). */
export const BRAND_LOGO_MARK_ON_DARK = "/brand/logo-mark-on-dark.svg" as const;

/** Растровый мастер-файл (PNG, для печати / агентства). */
export const BRAND_LOGO_HORIZONTAL_PNG = "/brand/logo-horizontal.png" as const;

export function getBrandAltText(): string {
  return getPublicProductName();
}
