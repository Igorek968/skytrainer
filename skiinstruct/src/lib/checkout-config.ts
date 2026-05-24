/** Локальная оплата без Stripe (Docker / dev). В проде с ключом — реальный Stripe Checkout. */
export function isMockCheckoutEnabled(): boolean {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  return !stripeKey || process.env.ALLOW_MOCK_CHECKOUT === "1";
}
