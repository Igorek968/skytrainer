import { randomUUID } from "node:crypto";

export function isYooKassaConfigured(): boolean {
  return Boolean(process.env.YOOKASSA_SHOP_ID?.trim() && process.env.YOOKASSA_SECRET_KEY?.trim());
}

/**
 * Сохранение карты / автосписания (POST /v3/payment_methods, save_payment_method).
 * ЮKassa включила привязку карт для магазина — по умолчанию включено, если касса настроена.
 * Выключить: YOOKASSA_RECURRING_PAYMENTS=0
 */
export function isYooKassaRecurringEnabled(): boolean {
  const v = process.env.YOOKASSA_RECURRING_PAYMENTS?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  return isYooKassaConfigured();
}

export const YOO_RECURRING_UNAVAILABLE_RU =
  "Привязка карты пока недоступна: у магазина ЮKassa не подключены автоплатежи. Оплатите заказ разово в форме ЮKassa — после оплаты заявка уйдёт инструктору.";

export function isYooKassaRecurringForbiddenMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("can't make recurring") ||
    m.includes("cannot make recurring") ||
    m.includes("recurring payments") ||
    (m.includes("forbidden") && m.includes("recurring"))
  );
}

export function yooKassaUserFacingError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (isYooKassaRecurringForbiddenMessage(message)) {
    return YOO_RECURRING_UNAVAILABLE_RU;
  }
  // Не отдаём сырой JSON ЮKassa в UI
  if (/ЮKassa\s+\w+\s+HTTP\s+\d+/i.test(message) || message.includes('"type" : "error"')) {
    return fallback;
  }
  return message.trim() || fallback;
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
  merchantCustomerId?: string;
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
  paid?: boolean;
  metadata?: YooKassaPaymentMetadata;
  confirmation?: {
    type?: string;
    confirmation_url?: string;
  };
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

  if (input.merchantCustomerId) {
    body.merchant_customer_id = input.merchantCustomerId;
  }

  body.confirmation = {
    type: "redirect",
    return_url: input.returnUrl,
  };
  if (input.paymentMethodId) {
    body.payment_method_id = input.paymentMethodId;
  } else if (input.savePaymentMethod) {
    body.save_payment_method = true;
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
export async function createYooKassaCardBinding(
  returnUrl: string,
  merchantCustomerId?: string,
): Promise<{
  paymentMethodId: string;
  confirmationUrl: string | null;
  status: string;
}> {
  const payload: Record<string, unknown> = {
    type: "bank_card",
    confirmation: {
      type: "redirect",
      return_url: returnUrl,
    },
  };
  if (merchantCustomerId) {
    payload.merchant_customer_id = merchantCustomerId;
  }
  const res = await fetch("https://api.yookassa.ru/v3/payment_methods", {
    method: "POST",
    headers: {
      Authorization: `Basic ${yooAuthHeader()}`,
      "Content-Type": "application/json",
      "Idempotence-Key": randomUUID(),
    },
    body: JSON.stringify(payload),
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
  userId?: string;
}): Promise<CreateYooPaymentResult> {
  return createYooKassaPayment({
    ...input,
    merchantCustomerId: input.userId,
    metadata: { orderId: input.orderId, type: "lesson", userId: input.userId },
  });
}

/** Удобная обёртка для оплаты записи на событие. */
export async function createYooKassaEventPayment(input: {
  eventRegistrationId: string;
  amountRub: number;
  description: string;
  customerEmail: string;
  returnUrl: string;
  savePaymentMethod?: boolean;
  paymentMethodId?: string;
  userId?: string;
}): Promise<CreateYooPaymentResult> {
  return createYooKassaPayment({
    amountRub: input.amountRub,
    description: input.description,
    customerEmail: input.customerEmail,
    returnUrl: input.returnUrl,
    savePaymentMethod: input.savePaymentMethod,
    paymentMethodId: input.paymentMethodId,
    merchantCustomerId: input.userId,
    metadata: { eventRegistrationId: input.eventRegistrationId, type: "event", userId: input.userId },
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

function webhookClientIp(req: Request): string | null {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  // Правый доверенный hop (Caddy → app): не XFF[0] — его может подставить клиент.
  const trusted = process.env.TRUSTED_PROXY_COUNT?.trim();
  const count = trusted ? Math.max(1, parseInt(trusted, 10) || 1) : 1;
  const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const idx = Math.max(0, parts.length - count);
  return parts[idx] ?? parts[parts.length - 1] ?? null;
}

/** Проверка IP webhook (опционально, YOOKASSA_WEBHOOK_VERIFY_IP=1). */
export function isYooKassaWebhookIpAllowed(req: Request): boolean {
  const verify =
    process.env.YOOKASSA_WEBHOOK_VERIFY_IP === "1" ||
    (process.env.YOOKASSA_WEBHOOK_VERIFY_IP !== "0" && process.env.NODE_ENV === "production");
  if (!verify) return true;
  const ip = webhookClientIp(req);
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
