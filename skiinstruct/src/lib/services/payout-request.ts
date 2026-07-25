import type { PayoutRequestStatus } from "@prisma/client";

import { PAYOUT_MIN_WITHDRAWAL_RUB } from "@/lib/legal-config";
import { prisma } from "@/lib/prisma";
import { canRequestWithdrawal } from "@/lib/services/order-payout";
import {
  getInstructorPenaltyBalanceRub,
  netPayoutAfterPenalties,
} from "@/lib/services/instructor-penalty";

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
  const [orders, penaltyBalanceRub] = await Promise.all([
    getEligiblePayoutOrders(instructorId),
    getInstructorPenaltyBalanceRub(instructorId),
  ]);
  const grossRub = orders.reduce((sum, o) => sum + Number(o.instructorShareAmount ?? 0), 0);
  return netPayoutAfterPenalties(grossRub, penaltyBalanceRub).netRub;
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
    select: { payoutAccountHint: true, verificationStatus: true, platformPenaltyBalanceRub: true },
  });
  if (!profile || profile.verificationStatus !== "APPROVED") {
    throw new Error("Профиль инструктора не одобрен");
  }
  if (!profile.payoutAccountHint?.trim()) {
    throw new Error("Укажите реквизиты для выплат в разделе документов");
  }

  const orders = await getEligiblePayoutOrders(instructorId);
  const grossRub = orders.reduce((sum, o) => sum + Number(o.instructorShareAmount ?? 0), 0);
  const penaltyBalanceRub = Number(profile.platformPenaltyBalanceRub ?? 0);
  const { netRub, penaltyDeductedRub } = netPayoutAfterPenalties(grossRub, penaltyBalanceRub);

  if (!canRequestWithdrawal(netRub)) {
    if (grossRub > 0 && penaltyBalanceRub >= grossRub) {
      throw new Error(
        `Недостаточно средств к выплате после удержания штрафов (${penaltyBalanceRub.toFixed(0)} ₽)`,
      );
    }
    throw new Error(`Минимальная сумма к выводу — ${PAYOUT_MIN_WITHDRAWAL_RUB} ₽`);
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.instructorPayoutRequest.create({
      data: {
        instructorId,
        amountRub: netRub.toFixed(2),
        penaltyDeductedRub: penaltyDeductedRub.toFixed(2),
        status: "PENDING",
      },
    });
    await tx.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { payoutRequestId: created.id },
    });

    if (penaltyDeductedRub > 0) {
      await tx.instructorProfile.update({
        where: { userId: instructorId },
        data: {
          platformPenaltyBalanceRub: { decrement: penaltyDeductedRub },
        },
      });
    }

    return created;
  });

  try {
    const { emitAdminPayoutAlert } = await import("@/lib/services/admin-alerts");
    const user = await prisma.user.findUnique({
      where: { id: instructorId },
      select: { name: true, email: true },
    });
    await emitAdminPayoutAlert({
      requestId: request.id,
      kind: "instructor",
      amountRub: Number(request.amountRub),
      userLabel: user?.name?.trim() || user?.email || instructorId,
    });
  } catch (e) {
    console.error("[admin-alert] payout", e instanceof Error ? e.message : e);
  }

  return request;
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
      const penaltyDeductedRub = Number(request.penaltyDeductedRub ?? 0);
      if (penaltyDeductedRub > 0) {
        await tx.instructorProfile.update({
          where: { userId: request.instructorId },
          data: { platformPenaltyBalanceRub: { increment: penaltyDeductedRub } },
        });
      }
      await tx.order.updateMany({
        where: { payoutRequestId: params.requestId },
        data: { payoutRequestId: null },
      });
    }

    return updated;
  });
}
