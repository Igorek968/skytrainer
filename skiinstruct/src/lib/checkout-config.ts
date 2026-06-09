import { isYooKassaConfigured } from "@/lib/yookassa";

/**
 * Тестовая оплата без ЮKassa/Stripe.
 * ALLOW_MOCK_CHECKOUT=1 — принудительно (даже если ключи ЮKassa заданы; для прогона на VPS).
 * ALLOW_MOCK_CHECKOUT=0 — только реальная оплата.
 * По умолчанию: mock, если нет ни ЮKassa, ни Stripe.
 */
export function isMockCheckoutEnabled(): boolean {
  if (process.env.ALLOW_MOCK_CHECKOUT === "1") return true;
  if (process.env.ALLOW_MOCK_CHECKOUT === "0") return false;
  if (isYooKassaConfigured()) return false;
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  return !stripeKey;
}
