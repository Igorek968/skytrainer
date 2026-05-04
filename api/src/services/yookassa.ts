import { randomUUID } from "node:crypto";
import { config } from "../config.js";

type CreatePaymentInput = {
  bookingId: string;
  amountRub: number;
  description: string;
};

type CreatePaymentResult = {
  paymentId: string;
  confirmationUrl: string | null;
  status: string;
};

export function isYooConfigured(): boolean {
  return Boolean(config.yooShopId && config.yooSecretKey);
}

export async function createYooPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const idempotenceKey = randomUUID();
  const value = input.amountRub.toFixed(2);

  if (!isYooConfigured()) {
    console.warn("[YooKassa] credentials missing — returning synthetic payment for local dev");
    return {
      paymentId: `mock_${input.bookingId}`,
      confirmationUrl: `${config.publicApiUrl.replace(/\/$/, "")}/payment/mock-success?bookingId=${input.bookingId}`,
      status: "pending"
    };
  }

  const auth = Buffer.from(`${config.yooShopId}:${config.yooSecretKey}`).toString("base64");
  const res = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey
    },
    body: JSON.stringify({
      amount: { value, currency: "RUB" },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: config.appReturnUrl
      },
      description: input.description,
      metadata: { booking_id: input.bookingId }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YooKassa HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    id: string;
    status: string;
    confirmation?: { confirmation_url?: string };
  };

  return {
    paymentId: data.id,
    confirmationUrl: data.confirmation?.confirmation_url ?? null,
    status: data.status
  };
}
