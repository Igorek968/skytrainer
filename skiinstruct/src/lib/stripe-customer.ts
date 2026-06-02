import type Stripe from "stripe";

export type ClientCardStatus = {
  hasCard: boolean;
  brand: string | null;
  last4: string | null;
};

/**
 * Возвращает первого Stripe customer по email (createCheckout уже не хранит id в БД).
 */
export async function findStripeCustomerByEmail(
  stripe: Stripe,
  email: string | null | undefined,
): Promise<Stripe.Customer | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  const listed = await stripe.customers.list({ email: normalized, limit: 1 });
  return listed.data[0] ?? null;
}

export async function getClientCardStatus(
  stripe: Stripe,
  email: string | null | undefined,
): Promise<ClientCardStatus> {
  const customer = await findStripeCustomerByEmail(stripe, email);
  if (!customer) {
    return { hasCard: false, brand: null, last4: null };
  }

  const methods = await stripe.paymentMethods.list({
    customer: customer.id,
    type: "card",
    limit: 1,
  });
  const card = methods.data[0]?.card;
  if (!card) {
    return { hasCard: false, brand: null, last4: null };
  }

  return {
    hasCard: true,
    brand: card.brand ?? null,
    last4: card.last4 ?? null,
  };
}
