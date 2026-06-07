import type { PayoutRequestStatus } from "@prisma/client";

import { PAYOUT_MIN_WITHDRAWAL_RUB } from "@/lib/legal-config";
import { prisma } from "@/lib/prisma";
import { canRequestWithdrawal } from "@/lib/services/order-payout";
import { resolveUserPayoutAccountHint } from "@/lib/services/referral";

export async function createReferralPayoutRequest(userId: string, role: string) {
  const pending = await prisma.referralPayoutRequest.findFirst({
    where: { userId, status: { in: ["PENDING", "PROCESSING"] } },
    select: { id: true },
  });
  if (pending) {
    throw new Error("У вас уже есть активная заявка на вывод реферального баланса");
  }

  const payoutHint = await resolveUserPayoutAccountHint(userId, role);
  if (!payoutHint) {
    throw new Error("Укажите реквизиты для выплат");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { referralBalanceRub: true },
    });
    if (!user) throw new Error("Пользователь не найден");

    const amountRub = Number(user.referralBalanceRub ?? 0);
    if (!canRequestWithdrawal(amountRub)) {
      throw new Error(`Минимальная сумма к выводу — ${PAYOUT_MIN_WITHDRAWAL_RUB} ₽`);
    }

    await tx.user.update({
      where: { id: userId },
      data: { referralBalanceRub: { decrement: amountRub } },
    });

    return tx.referralPayoutRequest.create({
      data: {
        userId,
        amountRub: amountRub.toFixed(2),
        status: "PENDING",
      },
    });
  });
}

export async function updateReferralPayoutRequestStatus(params: {
  requestId: string;
  status: PayoutRequestStatus;
  adminNote?: string | null;
}) {
  const request = await prisma.referralPayoutRequest.findUnique({
    where: { id: params.requestId },
  });
  if (!request) throw new Error("Заявка не найдена");

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.referralPayoutRequest.update({
      where: { id: params.requestId },
      data: {
        status: params.status,
        adminNote: params.adminNote ?? undefined,
        processedAt: params.status === "COMPLETED" || params.status === "REJECTED" ? now : null,
      },
    });

    if (params.status === "REJECTED") {
      await tx.user.update({
        where: { id: request.userId },
        data: { referralBalanceRub: { increment: Number(request.amountRub) } },
      });
    }

    return updated;
  });
}

export async function applyReferralCreditToOrder(params: {
  orderId: string;
  clientId: string;
  useCredit: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        clientId: true,
        status: true,
        paymentStatus: true,
        amountTotal: true,
        referralCreditAppliedRub: true,
      },
    });
    if (!order || order.clientId !== params.clientId) {
      throw new Error("Заказ не найден");
    }
    if (order.status !== "AWAITING_PAYMENT" || order.paymentStatus !== "PENDING") {
      throw new Error("Списание баланса доступно только до оплаты заказа");
    }
    if (order.amountTotal == null) {
      throw new Error("Сумма заказа не определена");
    }

    if (!params.useCredit) {
      return tx.order.update({
        where: { id: order.id },
        data: { referralCreditAppliedRub: null },
      });
    }

    const user = await tx.user.findUnique({
      where: { id: params.clientId },
      select: { referralBalanceRub: true },
    });
    const balance = Number(user?.referralBalanceRub ?? 0);
    const total = Number(order.amountTotal);
    const credit = Math.min(balance, total);

    if (credit <= 0) {
      throw new Error("Недостаточно реферального баланса");
    }

    return tx.order.update({
      where: { id: order.id },
      data: { referralCreditAppliedRub: credit.toFixed(2) },
    });
  });
}

export async function finalizeReferralCreditSpend(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        clientId: true,
        referralCreditAppliedRub: true,
        referralCreditSpent: true,
        paymentStatus: true,
      },
    });
    if (!order || order.paymentStatus !== "PAID" || order.referralCreditSpent) return;

    const credit = Number(order.referralCreditAppliedRub ?? 0);
    if (credit <= 0) return;

    const user = await tx.user.findUnique({
      where: { id: order.clientId },
      select: { referralBalanceRub: true },
    });
    const balance = Number(user?.referralBalanceRub ?? 0);
    const deduct = Math.min(credit, balance);
    if (deduct <= 0) return;

    const spent = await tx.order.updateMany({
      where: { id: orderId, referralCreditSpent: false },
      data: { referralCreditSpent: true },
    });
    if (spent.count === 0) return;

    await tx.user.update({
      where: { id: order.clientId },
      data: { referralBalanceRub: { decrement: deduct } },
    });
  });
}
