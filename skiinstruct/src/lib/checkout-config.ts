import { isYooKassaConfigured } from "@/lib/yookassa";

/**
 * Тестовая оплата без ЮKassa/Stripe.
 * ALLOW_MOCK_CHECKOUT=1 — только вне production, либо с ALLOW_MOCK_CHECKOUT_PROD=1 (break-glass).
 * ALLOW_MOCK_CHECKOUT=0 — только реальная оплата.
 * По умолчанию: mock, если нет ни ЮKassa, ни Stripe (и не production).
 */
export function isMockCheckoutEnabled(): boolean {
  if (process.env.ALLOW_MOCK_CHECKOUT === "1") {
    const prod = process.env.NODE_ENV === "production";
    const breakGlass = process.env.ALLOW_MOCK_CHECKOUT_PROD === "1";
    if (prod && !breakGlass) {
      console.error("[checkout] ALLOW_MOCK_CHECKOUT=1 ignored in production (set ALLOW_MOCK_CHECKOUT_PROD=1 to force)");
      return false;
    }
    return true;
  }
  if (process.env.ALLOW_MOCK_CHECKOUT === "0") return false;
  if (isYooKassaConfigured()) return false;
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (stripeKey) return false;
  // В production без платёжных ключей — не молча «оплачивать» mock'ом.
  if (process.env.NODE_ENV === "production") return false;
  return true;
}
