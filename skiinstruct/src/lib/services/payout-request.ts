import type { PayoutRequestStatus } from "@prisma/client";

import { PAYOUT_MIN_WITHDRAWAL_RUB } from "@/lib/legal-config";
import { prisma } from "@/lib/prisma";
import { canRequestWithdrawal } from "@/lib/services/order-payout";

export async function getEligiblePayoutOrders(instructorId: string) {
  const now = new Date();
  return prisma.order.findMany({
    where: {
      instructorId,
      status: "COMPLETED",
      paymentStatus: "PAID",
      payoutEligibleAt: { lte: now },
      instructorPayoutPaidAt: null,
      payoutRequestId: null,
    },
    select: {
      id: true,
      instructorShareAmount: true,
    },
    orderBy: { payoutEligibleAt: "asc" },
  });
}

export async function computeAvailablePayoutRub(instructorId: string): Promise<number> {
  const orders = await getEligiblePayoutOrders(instructorId);
  return orders.reduce((sum, o) => sum + Number(o.instructorShareAmount ?? 0), 0);
}

export async function createInstructorPayoutRequest(instructorId: string) {
  const pending = await prisma.instructorPayoutRequest.findFirst({
    where: { instructorId, status: { in: ["PENDING", "PROCESSING"] } },
    select: { id: true },
  });
  if (pending) {
    throw new Error("У вас уже есть активная заявка на выплату");
  }

  const profile = await prisma.instructorProfile.findUnique({
    where: { userId: instructorId },
    select: { payoutAccountHint: true, verificationStatus: true },
  });
  if (!profile || profile.verificationStatus !== "APPROVED") {
    throw new Error("Профиль инструктора не одобрен");
  }
  if (!profile.payoutAccountHint?.trim()) {
    throw new Error("Укажите реквизиты для выплат в разделе документов");
  }

  const orders = await getEligiblePayoutOrders(instructorId);
  const amountRub = orders.reduce((sum, o) => sum + Number(o.instructorShareAmount ?? 0), 0);
  if (!canRequestWithdrawal(amountRub)) {
    throw new Error(`Минимальная сумма к выводу — ${PAYOUT_MIN_WITHDRAWAL_RUB} ₽`);
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.instructorPayoutRequest.create({
      data: {
        instructorId,
        amountRub: amountRub.toFixed(2),
        status: "PENDING",
      },
    });
    await tx.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { payoutRequestId: request.id },
    });
    return request;
  });
}

export async function updatePayoutRequestStatus(params: {
  requestId: string;
  status: PayoutRequestStatus;
  adminNote?: string | null;
}) {
  const request = await prisma.instructorPayoutRequest.findUnique({
    where: { id: params.requestId },
    include: { orders: { select: { id: true } } },
  });
  if (!request) throw new Error("Заявка не найдена");

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.instructorPayoutRequest.update({
      where: { id: params.requestId },
      data: {
        status: params.status,
        adminNote: params.adminNote ?? undefined,
        processedAt: params.status === "COMPLETED" || params.status === "REJECTED" ? now : null,
      },
    });

    if (params.status === "COMPLETED") {
      await tx.order.updateMany({
        where: { payoutRequestId: params.requestId },
        data: { instructorPayoutPaidAt: now },
      });
    }

    if (params.status === "REJECTED") {
      await tx.order.updateMany({
        where: { payoutRequestId: params.requestId },
        data: { payoutRequestId: null },
      });
    }

    return updated;
  });
}
