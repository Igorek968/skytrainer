import { randomUUID } from "node:crypto";

export function isYooKassaConfigured(): boolean {
  return Boolean(process.env.YOOKASSA_SHOP_ID?.trim() && process.env.YOOKASSA_SECRET_KEY?.trim());
}

type CreateYooPaymentInput = {
  orderId: string;
  amountRub: number;
  description: string;
  customerEmail: string;
  returnUrl: string;
};

type CreateYooPaymentResult = {
  paymentId: string;
  confirmationUrl: string | null;
  status: string;
};

export async function createYooKassaPayment(input: CreateYooPaymentInput): Promise<CreateYooPaymentResult> {
  const shopId = process.env.YOOKASSA_SHOP_ID!.trim();
  const secretKey = process.env.YOOKASSA_SECRET_KEY!.trim();
  const value = input.amountRub.toFixed(2);
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

  const res = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "Idempotence-Key": randomUUID(),
    },
    body: JSON.stringify({
      amount: { value, currency: "RUB" },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: input.returnUrl,
      },
      description: input.description,
      metadata: { orderId: input.orderId },
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
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ЮKassa HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    id: string;
    status: string;
    confirmation?: { confirmation_url?: string };
  };

  return {
    paymentId: data.id,
    confirmationUrl: data.confirmation?.confirmation_url ?? null,
    status: data.status,
  };
}

export type YooKassaPaymentObject = {
  id: string;
  status: string;
  metadata?: { orderId?: string; order_id?: string };
};

/** Подтверждение статуса платежа при webhook (защита от поддельных уведомлений). */
export async function fetchYooKassaPayment(paymentId: string): Promise<YooKassaPaymentObject | null> {
  if (!isYooKassaConfigured()) return null;
  const shopId = process.env.YOOKASSA_SHOP_ID!.trim();
  const secretKey = process.env.YOOKASSA_SECRET_KEY!.trim();
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  const res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[YooKassa] fetch payment", res.status, await res.text());
    return null;
  }
  return (await res.json()) as YooKassaPaymentObject;
}

export function orderIdFromYooMetadata(meta?: { orderId?: string; order_id?: string }): string | null {
  const id = meta?.orderId ?? meta?.order_id;
  return id?.trim() || null;
}
