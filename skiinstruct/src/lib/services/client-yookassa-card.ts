import { prisma } from "@/lib/prisma";
import { isMockCheckoutEnabled } from "@/lib/checkout-config";
import {
  createYooKassaCardBinding,
  extractYooCardLabel,
  fetchYooKassaPaymentMethod,
  isYooKassaConfigured,
} from "@/lib/yookassa";

export type ClientCardStatus = {
  hasCard: boolean;
  brand: string | null;
  last4: string | null;
  mock?: boolean;
  pendingBind?: boolean;
};

const cardSelect = {
  yookassaPaymentMethodId: true,
  yookassaCardLast4: true,
  yookassaCardBrand: true,
  yookassaPendingBindId: true,
  mockCardBoundAt: true,
} as const;

export async function getClientCardStatus(userId: string): Promise<ClientCardStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: cardSelect,
  });
  if (!user) {
    return { hasCard: false, brand: null, last4: null };
  }

  if (user.mockCardBoundAt) {
    return {
      hasCard: true,
      brand: user.yookassaCardBrand ?? "mock",
      last4: user.yookassaCardLast4 ?? "4242",
      mock: true,
    };
  }

  if (user.yookassaPaymentMethodId) {
    return {
      hasCard: true,
      brand: user.yookassaCardBrand,
      last4: user.yookassaCardLast4,
    };
  }

  return {
    hasCard: false,
    brand: null,
    last4: null,
    pendingBind: Boolean(user.yookassaPendingBindId),
  };
}

export async function clientHasBoundCard(userId: string): Promise<boolean> {
  const status = await getClientCardStatus(userId);
  return status.hasCard;
}

export async function saveClientYooPaymentMethod(
  userId: string,
  paymentMethodId: string,
  card?: { last4?: string | null; brand?: string | null },
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      yookassaPaymentMethodId: paymentMethodId,
      yookassaCardLast4: card?.last4 ?? null,
      yookassaCardBrand: card?.brand ?? null,
      yookassaPendingBindId: null,
    },
  });
}

export async function markMockCardBound(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      mockCardBoundAt: new Date(),
      yookassaCardLast4: "4242",
      yookassaCardBrand: "visa",
      yookassaPendingBindId: null,
    },
  });
}

export async function syncPendingYooCardBind(userId: string): Promise<ClientCardStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: cardSelect,
  });
  if (!user) return { hasCard: false, brand: null, last4: null };

  if (user.yookassaPaymentMethodId || user.mockCardBoundAt) {
    return getClientCardStatus(userId);
  }

  const pendingId = user.yookassaPendingBindId?.trim();
  if (!pendingId || !isYooKassaConfigured()) {
    return getClientCardStatus(userId);
  }

  const method = await fetchYooKassaPaymentMethod(pendingId);
  if (method?.status === "active" && method.saved) {
    const { last4, brand } = extractYooCardLabel(method);
    await saveClientYooPaymentMethod(userId, method.id, { last4, brand });
  }

  return getClientCardStatus(userId);
}

export async function startYooCardBinding(userId: string, returnUrl: string): Promise<{ url: string }> {
  if (isMockCheckoutEnabled()) {
    await markMockCardBound(userId);
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    return { url: `${origin}/client?card=mock` };
  }

  if (!isYooKassaConfigured()) {
    throw new Error("ЮKassa не настроена для привязки карты");
  }

  let bind;
  try {
    bind = await createYooKassaCardBinding(returnUrl);
  } catch (e) {
    if (process.env.NODE_ENV === "production") throw e;
    console.warn("[yookassa/bind] API error, dev mock fallback:", e);
    await markMockCardBound(userId);
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    return { url: `${origin}/client?card=mock` };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { yookassaPendingBindId: bind.paymentMethodId },
  });

  if (!bind.confirmationUrl) {
    throw new Error("ЮKassa не вернула ссылку на привязку карты");
  }

  return { url: bind.confirmationUrl };
}

export async function saveCardFromPaymentMethodPayload(
  userId: string,
  paymentMethod?: {
    id?: string;
    saved?: boolean;
    card?: { last4?: string; card_type?: string; brand?: string };
  },
): Promise<void> {
  if (!paymentMethod?.id || !paymentMethod.saved) return;
  const { last4, brand } = extractYooCardLabel(paymentMethod);
  await saveClientYooPaymentMethod(userId, paymentMethod.id, { last4, brand });
}
