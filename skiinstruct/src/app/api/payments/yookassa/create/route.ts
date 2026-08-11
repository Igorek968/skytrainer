import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { isMockCheckoutEnabled } from "@/lib/checkout-config";
import { prisma } from "@/lib/prisma";
import {
  clientHasBoundCard,
  markMockCardBound,
  saveCardFromPaymentMethodPayload,
} from "@/lib/services/client-yookassa-card";
import { assertUserEmailVerified } from "@/lib/services/email-verification";
import { completeOrderPrepayment } from "@/lib/services/order-prepayment";
import { orderAmountDueRub } from "@/lib/services/referral";
import { createYooKassaLessonPayment, isYooKassaConfigured } from "@/lib/yookassa";
import { getPublicProductName } from "@/shared/lib/product";

const bodySchema = z.object({
  orderId: z.string().cuid(),
  bindAndPay: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const resolved = await requireClientSession();
    if (isApiErrorResponse(resolved)) return resolved;

    const emailBlock = await assertUserEmailVerified(resolved.userId);
    if (emailBlock) {
      return NextResponse.json(
        { error: emailBlock, code: "EMAIL_NOT_VERIFIED" },
        { status: 403 },
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: {
        id: true,
        clientId: true,
        status: true,
        paymentStatus: true,
        amountTotal: true,
      },
    });
    if (!order || order.clientId !== resolved.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const prepayOk =
      order.status === "AWAITING_PAYMENT" &&
      order.paymentStatus === "PENDING" &&
      order.amountTotal != null;
    const legacyPostLessonPay =
      order.status === "COMPLETED" &&
      (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED") &&
      order.amountTotal != null;

    if (!prepayOk && !legacyPostLessonPay) {
      return NextResponse.json({ error: "Оплата недоступна для этого заказа" }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    const returnUrl = `${origin}/client/orders/${order.id}?paid=1`;
    const amountRub = orderAmountDueRub(order);
    const hasCard = await clientHasBoundCard(resolved.userId);
    const bindAndPay = parsed.data.bindAndPay === true;

    if (!hasCard && !bindAndPay) {
      return NextResponse.json(
        {
          error: "Привяжите банковскую карту в личных данных или нажмите «Привязать карту и оплатить».",
          code: "CARD_NOT_BOUND",
        },
        { status: 403 },
      );
    }

    if (amountRub <= 0) {
      await completeOrderPrepayment({
        orderId: order.id,
        paymentMethod: "CARD",
        paymentRecordAmount: 0,
      });
      return NextResponse.json({ url: `${returnUrl}&balance=1` });
    }

    if (isMockCheckoutEnabled()) {
      if (!hasCard && bindAndPay) {
        await markMockCardBound(resolved.userId);
      }
      if (!(await clientHasBoundCard(resolved.userId))) {
        return NextResponse.json(
          { error: "Сначала привяжите карту", code: "CARD_NOT_BOUND" },
          { status: 403 },
        );
      }
      const mockPaymentId = `mock_yoo_${order.id.slice(0, 12)}_${Date.now()}`;
      await completeOrderPrepayment({
        orderId: order.id,
        paymentMethod: "CARD",
        yookassaPaymentId: mockPaymentId,
        paymentRecordAmount: amountRub,
      });
      return NextResponse.json({ url: `${returnUrl}&mock=1` });
    }

    if (!isYooKassaConfigured()) {
      return NextResponse.json(
        { error: "ЮKassa не настроена", code: "NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    const email = resolved.session.user.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "Укажите email в профиле для чека" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: resolved.userId },
      select: { yookassaPaymentMethodId: true },
    });

    let pay;
    try {
      if (hasCard && user?.yookassaPaymentMethodId) {
        pay = await createYooKassaLessonPayment({
          orderId: order.id,
          amountRub,
          description: `${getPublicProductName()} — заказ ${order.id.slice(0, 8)}`,
          customerEmail: email,
          returnUrl,
          paymentMethodId: user.yookassaPaymentMethodId,
        });
      } else {
        pay = await createYooKassaLessonPayment({
          orderId: order.id,
          amountRub,
          description: `${getPublicProductName()} — заказ ${order.id.slice(0, 8)}`,
          customerEmail: email,
          returnUrl,
          savePaymentMethod: true,
        });
      }
    } catch (yooErr) {
      if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_CHECKOUT !== "1") {
        throw yooErr;
      }
      console.warn("[yookassa/create] API error, mock fallback:", yooErr);
      if (!hasCard && bindAndPay) {
        await markMockCardBound(resolved.userId);
      }
      const mockPaymentId = `mock_yoo_${order.id.slice(0, 12)}_${Date.now()}`;
      await completeOrderPrepayment({
        orderId: order.id,
        paymentMethod: "CARD",
        yookassaPaymentId: mockPaymentId,
        paymentRecordAmount: amountRub,
      });
      return NextResponse.json({ url: `${returnUrl}&mock=1` });
    }

    if (pay.status === "succeeded") {
      await saveCardFromPaymentMethodPayload(resolved.userId, {
        id: pay.paymentMethodId ?? user?.yookassaPaymentMethodId ?? undefined,
        saved: true,
      });
      await completeOrderPrepayment({
        orderId: order.id,
        paymentMethod: "CARD",
        yookassaPaymentId: pay.paymentId,
        paymentRecordAmount: amountRub,
      });
      return NextResponse.json({ url: `${returnUrl}&autopay=1` });
    }

    if (!pay.confirmationUrl) {
      return NextResponse.json({ error: "ЮKassa не вернула ссылку на оплату" }, { status: 502 });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        yookassaPaymentId: pay.paymentId,
        paymentMethod: "CARD",
      },
    });

    return NextResponse.json({ url: pay.confirmationUrl, paymentId: pay.paymentId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось создать оплату";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
