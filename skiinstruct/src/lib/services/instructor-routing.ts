import { Prisma, type OrderCancelledBy } from "@prisma/client";

import {
  parseDisciplineFromOrderNotes,
  parseSpecializationOffers,
  resolveHourlyRateForDiscipline,
} from "@/lib/instructor-specialization-offers";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/pricing";
import { applyRefundForExpiredOrder } from "@/lib/services/order-refund";
import { orderRelaxedInstructorTiming } from "@/shared/lib/order-flex";

/** Prisma Decimal(10,2): числа JS с плавающей точкой и NaN ломали запись. */
function orderMoneyDecimal(value: number): Prisma.Decimal {
  const safe = Number.isFinite(value) && value >= 0 ? value : 0;
  return new Prisma.Decimal(safe.toFixed(2));
}

function hourlyRateForOrder(
  profile: {
    hourlyRate: unknown;
    specializationOffers: unknown;
    specializations: string[];
  },
  order: { disciplineLabel: string | null; notes: string | null },
): number {
  const fallback = Number(profile.hourlyRate);
  const offers = parseSpecializationOffers(
    profile.specializationOffers,
    fallback,
    profile.specializations,
  );
  const discipline =
    order.disciplineLabel ?? parseDisciplineFromOrderNotes(order.notes);
  return resolveHourlyRateForDiscipline(offers, discipline, fallback);
}

/** Окно на принятие, если заявка без «мягкого» режима (нет даты урока в заказе). */
export const RESPONSE_WINDOW_MS = 60_000;

function cancelledByForExpiredReason(
  reason: "timeout" | "reject" | "unavailable",
): OrderCancelledBy {
  if (reason === "reject") return "INSTRUCTOR";
  return "SYSTEM";
}

async function markOrderExpired(
  tx: Prisma.TransactionClient,
  orderId: string,
  expiredReason: "timeout" | "reject" | "unavailable",
): Promise<{ status: "EXPIRED" }> {
  await tx.order.update({
    where: { id: orderId },
    data: {
      status: "EXPIRED",
      pendingExpiresAt: null,
      cancelledBy: cancelledByForExpiredReason(expiredReason),
    },
  });
  return { status: "EXPIRED" };
}

/**
 * Назначает выбранного клиентом инструктора из очереди (всегда один id).
 * При таймауте или отказе заявка закрывается (EXPIRED), другим инструкторам не передаётся.
 */
export async function assignInstructorByQueue(orderId: string, reason: "initial" | "timeout" | "reject") {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return null;

    const flexibleInvite = order.flexibleInstructorInvite === true;
    const relaxedTiming = orderRelaxedInstructorTiming(order);
    const requireOnline = !flexibleInvite;

    const queue = Array.isArray(order.instructorQueue) ? (order.instructorQueue as string[]) : [];
    if (!queue.length) {
      return markOrderExpired(tx, orderId, "unavailable");
    }

    if (reason !== "initial") {
      return markOrderExpired(tx, orderId, reason === "reject" ? "reject" : "timeout");
    }

    const nextInstructorId = queue[0]!;
    const instr = await tx.user.findFirst({
      where: {
        id: nextInstructorId,
        role: "INSTRUCTOR",
        instructorProfile: {
          verificationStatus: "APPROVED",
          ...(requireOnline ? { isOnline: true } : {}),
        },
      },
      include: { instructorProfile: true },
    });

    if (!instr?.instructorProfile) {
      return markOrderExpired(tx, orderId, "unavailable");
    }

    const hourlyRate = hourlyRateForOrder(instr.instructorProfile, order);
    if (!Number.isFinite(hourlyRate) || hourlyRate < 500) {
      return markOrderExpired(tx, orderId, "unavailable");
    }

    const totals = computeTotals({
      hourlyRate,
      duration: order.duration,
      platformFeePercent: 15,
    });

    const prepaid =
      order.paymentStatus === "PAID" &&
      order.amountTotal != null &&
      order.instructorShareAmount != null;

    const pendingExpiresAt = relaxedTiming ? null : new Date(Date.now() + RESPONSE_WINDOW_MS);
    const updated = await tx.order.update({
      where: { id: orderId },
      data: prepaid
        ? {
            instructorId: nextInstructorId,
            instructorQueueIndex: 0,
            status: "PENDING_INSTRUCTOR",
            pendingExpiresAt,
          }
        : {
            instructorId: nextInstructorId,
            instructorQueueIndex: 0,
            status: "PENDING_INSTRUCTOR",
            pendingExpiresAt,
            agreedHourlyRate: orderMoneyDecimal(hourlyRate),
            amountTotal: orderMoneyDecimal(totals.total),
            instructorShareAmount: orderMoneyDecimal(totals.instructorShare),
            platformFeePercent: 15,
          },
    });

    return { status: "PENDING_INSTRUCTOR" as const, order: updated };
  });

  if (result?.status === "EXPIRED") {
    await applyRefundForExpiredOrder(orderId);
  }

  return result;
}

export type PrepareQueueResult =
  | { ok: true }
  | {
      ok: false;
      reason: "ORDER_NOT_FOUND" | "NO_INSTRUCTOR_CHOSEN" | "NO_PROFILE" | "NO_QUEUE";
    };

/**
 * Очередь из одного выбранного клиентом инструктора; суммы по его ставке (комиссия 15%).
 * Назначение в PENDING_INSTRUCTOR — после успешной оплаты (Stripe webhook / checkout).
 */
export async function prepareInstructorQueue(orderId: string): Promise<PrepareQueueResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, reason: "ORDER_NOT_FOUND" };

  const chosenId = order.instructorId;
  if (!chosenId) return { ok: false, reason: "NO_INSTRUCTOR_CHOSEN" };

  const profile = await prisma.instructorProfile.findUnique({
    where: { userId: chosenId },
    select: {
      hourlyRate: true,
      verificationStatus: true,
      specializationOffers: true,
      specializations: true,
    },
  });
  if (!profile || profile.verificationStatus !== "APPROVED") {
    return { ok: false, reason: "NO_PROFILE" };
  }

  const queue = [chosenId];

  const hourlyRate = hourlyRateForOrder(profile, order);
  if (!Number.isFinite(hourlyRate) || hourlyRate < 500) {
    return { ok: false, reason: "NO_PROFILE" };
  }

  const totals = computeTotals({
    hourlyRate,
    duration: order.duration,
    platformFeePercent: 15,
  });

  await prisma.order.update({
    where: { id: orderId },
    data: {
      instructorQueue: queue as Prisma.InputJsonValue,
      instructorQueueIndex: 0,
      agreedHourlyRate: orderMoneyDecimal(hourlyRate),
      amountTotal: orderMoneyDecimal(totals.total),
      instructorShareAmount: orderMoneyDecimal(totals.instructorShare),
      platformFeePercent: 15,
    },
  });

  return { ok: true };
}

/** Cron / фон: просроченные ожидания ответа → EXPIRED и возврат при оплате. */
export async function processExpiredPendingOrders(): Promise<number> {
  const now = new Date();
  const expired = await prisma.order.findMany({
    where: {
      status: "PENDING_INSTRUCTOR",
      pendingExpiresAt: { lt: now },
    },
    select: { id: true },
  });
  let count = 0;
  for (const row of expired) {
    const order = await prisma.order.findUnique({ where: { id: row.id } });
    if (!order) continue;
    if (orderRelaxedInstructorTiming(order)) {
      await prisma.order.update({
        where: { id: row.id },
        data: { pendingExpiresAt: null },
      });
      continue;
    }
    await assignInstructorByQueue(row.id, "timeout");
    count += 1;
  }
  return count;
}

/** Перед выдачей заказа — если дедлайн прошёл, закрыть заявку (без передачи другим). */
export async function rerouteOrderIfDeadlinePassed(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING_INSTRUCTOR") {
    return;
  }
  if (orderRelaxedInstructorTiming(order)) {
    if (order.pendingExpiresAt != null) {
      await prisma.order.update({
        where: { id: orderId },
        data: { pendingExpiresAt: null },
      });
    }
    return;
  }
  if (!order.pendingExpiresAt || order.pendingExpiresAt >= new Date()) {
    return;
  }
  await assignInstructorByQueue(orderId, "timeout");
}

export async function loadRoutingQueueLabels(queueIds: string[]) {
  if (!queueIds.length) return [] as { userId: string; name: string | null }[];
  const users = await prisma.user.findMany({
    where: { id: { in: queueIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return queueIds.map((userId) => ({
    userId,
    name: nameById.get(userId) ?? null,
  }));
}
