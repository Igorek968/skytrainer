/** Продукт: веб-приложение «ТвойТренер.рф» (Next.js). Админка читает только его БД. */
export const UTRAINER_PRODUCT_NAME = "ТвойТренер.рф" as const;

/** @deprecated используйте UTRAINER_PRODUCT_NAME */
export const SKIINSTRUCT_PRODUCT_NAME = UTRAINER_PRODUCT_NAME;

export function getPublicProductName(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_NAME?.trim()) {
    return process.env.NEXT_PUBLIC_APP_NAME.trim();
  }
  return UTRAINER_PRODUCT_NAME;
}
