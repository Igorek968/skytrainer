import { randomUUID } from "node:crypto";

export function isYooKassaConfigured(): boolean {
  return Boolean(process.env.YOOKASSA_SHOP_ID?.trim() && process.env.YOOKASSA_SECRET_KEY?.trim());
}

function yooAuthHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID!.trim();
  const secretKey = process.env.YOOKASSA_SECRET_KEY!.trim();
  return Buffer.from(`${shopId}:${secretKey}`).toString("base64");
}

export type YooKassaPaymentMetadata = {
  orderId?: string;
  order_id?: string;
  eventRegistrationId?: string;
  userId?: string;
  type?: "lesson" | "event" | "card_bind";
};

type CreateYooPaymentInput = {
  amountRub: number;
  description: string;
  customerEmail: string;
  returnUrl: string;
  metadata: YooKassaPaymentMetadata;
  savePaymentMethod?: boolean;
  paymentMethodId?: string;
};

type CreateYooPaymentResult = {
  paymentId: string;
  confirmationUrl: string | null;
  status: string;
  paymentMethodId?: string | null;
};

export type YooKassaPaymentMethodObject = {
  id: string;
  type: string;
  saved: boolean;
  status: string;
  confirmation?: { type?: string; confirmation_url?: string };
  card?: { last4?: string; card_type?: string; brand?: string };
};

export type YooKassaPaymentObject = {
  id: string;
  status: string;
  metadata?: YooKassaPaymentMetadata;
  payment_method?: {
    id?: string;
    saved?: boolean;
    card?: { last4?: string; card_type?: string; brand?: string };
  };
};

export async function createYooKassaPayment(input: CreateYooPaymentInput): Promise<CreateYooPaymentResult> {
  const value = input.amountRub.toFixed(2);
  const body: Record<string, unknown> = {
    amount: { value, currency: "RUB" },
    capture: true,
    description: input.description,
    metadata: input.metadata,
    receipt: {
      customer: { email: input.customerEmail },
      items: [
        {
          description: input.description.slice(0, 128),
          quantity: "1.00",
          amount: { value, currency: "RUB" },
          vat_code: 1,
          payment_mode: "full_payment",
          payment_subject: "service",
        },
      ],
    },
  };

  if (input.paymentMethodId) {
    body.payment_method_id = input.paymentMethodId;
  } else {
    body.confirmation = {
      type: "redirect",
      return_url: input.returnUrl,
    };
    if (input.savePaymentMethod) {
      body.save_payment_method = true;
    }
  }

  const res = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${yooAuthHeader()}`,
      "Content-Type": "application/json",
      "Idempotence-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ЮKassa HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    id: string;
    status: string;
    confirmation?: { confirmation_url?: string };
    payment_method?: { id?: string };
  };

  return {
    paymentId: data.id,
    confirmationUrl: data.confirmation?.confirmation_url ?? null,
    status: data.status,
    paymentMethodId: data.payment_method?.id ?? null,
  };
}

/** Привязка карты на нулевую сумму (POST /v3/payment_methods). */
export async function createYooKassaCardBinding(returnUrl: string): Promise<{
  paymentMethodId: string;
  confirmationUrl: string | null;
  status: string;
}> {
  const res = await fetch("https://api.yookassa.ru/v3/payment_methods", {
    method: "POST",
    headers: {
      Authorization: `Basic ${yooAuthHeader()}`,
      "Content-Type": "application/json",
      "Idempotence-Key": randomUUID(),
    },
    body: JSON.stringify({
      type: "bank_card",
      confirmation: {
        type: "redirect",
        return_url: returnUrl,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ЮKassa bind HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as YooKassaPaymentMethodObject;
  return {
    paymentMethodId: data.id,
    confirmationUrl: data.confirmation?.confirmation_url ?? null,
    status: data.status,
  };
}

export async function fetchYooKassaPaymentMethod(
  paymentMethodId: string,
): Promise<YooKassaPaymentMethodObject | null> {
  if (!isYooKassaConfigured()) return null;
  const res = await fetch(`https://api.yookassa.ru/v3/payment_methods/${paymentMethodId}`, {
    headers: { Authorization: `Basic ${yooAuthHeader()}` },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[YooKassa] fetch payment_method", res.status, await res.text());
    return null;
  }
  return (await res.json()) as YooKassaPaymentMethodObject;
}

type CreateYooRefundResult = {
  refundId: string;
  status: string;
};

/** Возврат по платежу ЮKassa (частичный или полный). */
export async function createYooKassaRefund(
  paymentId: string,
  amountRub: number,
): Promise<CreateYooRefundResult> {
  if (!isYooKassaConfigured()) {
    throw new Error("ЮKassa не настроена");
  }
  if (paymentId.startsWith("mock_yoo_") || paymentId.startsWith("mock_event_")) {
    return { refundId: `mock_refund_${Date.now()}`, status: "succeeded" };
  }

  const value = amountRub.toFixed(2);

  const res = await fetch("https://api.yookassa.ru/v3/refunds", {
    method: "POST",
    headers: {
      Authorization: `Basic ${yooAuthHeader()}`,
      "Content-Type": "application/json",
      "Idempotence-Key": randomUUID(),
    },
    body: JSON.stringify({
      payment_id: paymentId,
      amount: { value, currency: "RUB" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ЮKassa refund HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { id: string; status: string };
  return { refundId: data.id, status: data.status };
}

/** Удобная обёртка для оплаты урока. */
export async function createYooKassaLessonPayment(input: {
  orderId: string;
  amountRub: number;
  description: string;
  customerEmail: string;
  returnUrl: string;
  savePaymentMethod?: boolean;
  paymentMethodId?: string;
}): Promise<CreateYooPaymentResult> {
  return createYooKassaPayment({
    ...input,
    metadata: { orderId: input.orderId, type: "lesson" },
  });
}

/** Удобная обёртка для оплаты записи на мероприятие. */
export async function createYooKassaEventPayment(input: {
  eventRegistrationId: string;
  amountRub: number;
  description: string;
  customerEmail: string;
  returnUrl: string;
}): Promise<CreateYooPaymentResult> {
  return createYooKassaPayment({
    amountRub: input.amountRub,
    description: input.description,
    customerEmail: input.customerEmail,
    returnUrl: input.returnUrl,
    metadata: { eventRegistrationId: input.eventRegistrationId, type: "event" },
  });
}

/** Подтверждение статуса платежа при webhook (защита от поддельных уведомлений). */
export async function fetchYooKassaPayment(paymentId: string): Promise<YooKassaPaymentObject | null> {
  if (!isYooKassaConfigured()) return null;
  const res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${yooAuthHeader()}` },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[YooKassa] fetch payment", res.status, await res.text());
    return null;
  }
  return (await res.json()) as YooKassaPaymentObject;
}

export function orderIdFromYooMetadata(meta?: YooKassaPaymentMetadata): string | null {
  const id = meta?.orderId ?? meta?.order_id;
  return id?.trim() || null;
}

export function eventRegistrationIdFromYooMetadata(meta?: YooKassaPaymentMetadata): string | null {
  const id = meta?.eventRegistrationId;
  return id?.trim() || null;
}

export function cardBindUserIdFromYooMetadata(meta?: YooKassaPaymentMetadata): string | null {
  return meta?.userId?.trim() || null;
}

export function extractYooCardLabel(method?: {
  card?: { last4?: string; card_type?: string; brand?: string };
}): { last4: string | null; brand: string | null } {
  const card = method?.card;
  return {
    last4: card?.last4 ?? null,
    brand: card?.brand ?? card?.card_type ?? null,
  };
}

/** Проверка IP webhook (опционально, YOOKASSA_WEBHOOK_VERIFY_IP=1). */
export function isYooKassaWebhookIpAllowed(req: Request): boolean {
  const verify =
    process.env.YOOKASSA_WEBHOOK_VERIFY_IP === "1" ||
    (process.env.YOOKASSA_WEBHOOK_VERIFY_IP !== "0" && process.env.NODE_ENV === "production");
  if (!verify) return true;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const ip = forwarded || realIp;
  if (!ip) return false;

  const allowedPrefixes = [
    "185.71.76.",
    "185.71.77.",
    "77.75.153.",
    "77.75.156.11",
    "77.75.156.35",
  ];
  if (allowedPrefixes.some((p) => ip.startsWith(p) || ip === p)) return true;
  if (ip.startsWith("2a02:5180:")) return true;
  return false;
}
