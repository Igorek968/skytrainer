/** Продукт: это приложение SkiInstruct (Next.js). Админка читает только его БД. */
export const SKIINSTRUCT_PRODUCT_NAME = "SkiInstruct" as const;

export function getPublicProductName(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_NAME?.trim()) {
    return process.env.NEXT_PUBLIC_APP_NAME.trim();
  }
  return SKIINSTRUCT_PRODUCT_NAME;
}
