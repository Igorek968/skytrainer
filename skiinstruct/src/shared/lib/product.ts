/** Продукт: веб-приложение «ТвойТренер.рф» (Next.js). Админка читает только его БД. */
export const PRODUCT_NAME = "ТвойТренер.рф" as const;

/** @deprecated используйте PRODUCT_NAME */
export const SKIINSTRUCT_PRODUCT_NAME = PRODUCT_NAME;

export function getPublicProductName(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_NAME?.trim()) {
    return process.env.NEXT_PUBLIC_APP_NAME.trim();
  }
  return PRODUCT_NAME;
}
