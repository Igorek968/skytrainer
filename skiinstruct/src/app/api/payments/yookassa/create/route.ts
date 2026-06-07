import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireClientSession } from "@/lib/api-session";
import { isMockCheckoutEnabled } from "@/lib/checkout-config";
import { prisma } from "@/lib/prisma";
import { isEmailVerificationRequired } from "@/lib/services/email-verification";
import { completeOrderPrepayment } from "@/lib/services/order-prepayment";
import { orderAmountDueRub } from "@/lib/services/referral";
import { createYooKassaLessonPayment, isYooKassaConfigured } from "@/lib/yookassa";

const bodySchema = z.object({
  orderId: z.string().cuid(),
});

export async function POST(req: Request) {
  try {
    const resolved = await requireClientSession();
    if (isApiErrorResponse(resolved)) return resolved;

    if (isEmailVerificationRequired()) {
      const user = await prisma.user.findUnique({
        where: { id: resolved.userId },
        select: { emailVerified: true, email: true },
      });
      if (!user?.emailVerified) {
        return NextResponse.json(
          {
            error: "Подтвердите email перед оплатой. Проверьте почту или запросите письмо повторно.",
            code: "EMAIL_NOT_VERIFIED",
          },
          { status: 403 },
        );
      }
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

    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
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

    if (amountRub <= 0) {
      await completeOrderPrepayment({
        orderId: order.id,
        paymentMethod: "CARD",
        paymentRecordAmount: 0,
      });
      return NextResponse.json({ url: `${returnUrl}&balance=1` });
    }

    if (!isYooKassaConfigured()) {
      if (isMockCheckoutEnabled()) {
        const mockPaymentId = `mock_yoo_${order.id.slice(0, 12)}_${Date.now()}`;
        await completeOrderPrepayment({
          orderId: order.id,
          paymentMethod: "CARD",
          yookassaPaymentId: mockPaymentId,
          paymentRecordAmount: amountRub,
        });
        return NextResponse.json({ url: `${returnUrl}&mock=1` });
      }
      return NextResponse.json(
        { error: "ЮKassa не настроена", code: "NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    const email = resolved.session.user.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "Укажите email в профиле для чека" }, { status: 400 });
    }

    const pay = await createYooKassaLessonPayment({
      orderId: order.id,
      amountRub,
      description: `uTrainer — заказ ${order.id.slice(0, 8)}`,
      customerEmail: email,
      returnUrl,
    });

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
