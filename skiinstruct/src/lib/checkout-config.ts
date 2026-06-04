import { isYooKassaConfigured } from "@/lib/yookassa";

/** Локальная оплата без ЮKassa/Stripe (Docker / dev). На проде: ALLOW_MOCK_CHECKOUT=0. */
export function isMockCheckoutEnabled(): boolean {
  if (process.env.ALLOW_MOCK_CHECKOUT === "0") return false;
  if (isYooKassaConfigured()) return false;
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  return !stripeKey || process.env.ALLOW_MOCK_CHECKOUT === "1";
}
