import { Prisma, type OrderCancelledBy } from "@prisma/client";

import {
  parseDisciplineFromOrderNotes,
  parseSpecializationOffers,
  resolveHourlyRateForDiscipline,
} from "@/lib/instructor-specialization-offers";
import {
  computePendingExpiresAt,
  INSTRUCTOR_ACCEPT_AFTER_DEADLINE_GRACE_MS,
  instructorCanAcceptAfterDeadline,
} from "@/shared/lib/order-flex";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/pricing";
import { autoAcceptOrderIfScheduled } from "@/lib/services/instructor-order-auto-accept";
import { notifyInstructorOfPendingOrder } from "@/lib/services/instructor-order-notify";
import { applyRefundForExpiredOrder } from "@/lib/services/order-refund";
import { resolveBillableHours } from "@/shared/lib/order-billing-hours";

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
    const urgent = order.urgentInvite === true;
    /** Срочно или клиент без выбранного инструктора — только онлайн. */
    const requireOnline = urgent || (!flexibleInvite && !order.instructorId);

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
        suspendedAt: null,
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

    const billableHours = resolveBillableHours({
      duration: order.duration,
      requestedStartDate: order.requestedStartDate,
      requestedEndDate: order.requestedEndDate,
      notes: order.notes,
    });
    const totals = computeTotals({
      hourlyRate,
      hours: billableHours,
      platformFeePercent: 15,
    });

    const prepaid =
      order.paymentStatus === "PAID" &&
      order.amountTotal != null &&
      order.instructorShareAmount != null;

    const timingInput = {
      urgentInvite: Boolean(order.urgentInvite),
      flexibleInstructorInvite: Boolean(order.flexibleInstructorInvite),
      requestedDays: order.requestedDays,
      requestedStartDate: order.requestedStartDate,
    };
    const pendingExpiresAt = computePendingExpiresAt(timingInput);

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
    try {
      const expired = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          paymentStatus: true,
          cancelledBy: true,
          client: { select: { name: true, email: true } },
        },
      });
      if (expired) {
        const { emitAdminOrderExpiredAlert } = await import("@/lib/services/admin-alerts");
        const expireReason: "timeout" | "reject" | "unavailable" =
          reason === "reject"
            ? "reject"
            : reason === "timeout"
              ? "timeout"
              : "unavailable";
        await emitAdminOrderExpiredAlert({
          orderId,
          reason: expireReason,
          clientLabel: expired.client?.name?.trim() || expired.client?.email || null,
          paid: expired.paymentStatus === "PAID",
        });
      }
    } catch (e) {
      console.error("[admin-alert] order expired", e instanceof Error ? e.message : e);
    }
  }

  if (result?.status === "PENDING_INSTRUCTOR") {
    await notifyInstructorOfPendingOrder(orderId);
    await autoAcceptOrderIfScheduled(orderId);
    const accepted = await prisma.order.findUnique({ where: { id: orderId } });
    if (accepted?.status === "ACCEPTED") {
      return { status: "ACCEPTED" as const, order: accepted };
    }
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

  const billableHours = resolveBillableHours({
    duration: order.duration,
    requestedStartDate: order.requestedStartDate,
    requestedEndDate: order.requestedEndDate,
    notes: order.notes,
  });
  const totals = computeTotals({
    hourlyRate,
    hours: billableHours,
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
  const cutoff = new Date(Date.now() - INSTRUCTOR_ACCEPT_AFTER_DEADLINE_GRACE_MS);
  const overdue = await prisma.order.findMany({
    where: {
      status: "PENDING_INSTRUCTOR",
      pendingExpiresAt: { not: null, lt: cutoff },
    },
    select: { id: true },
  });

  let count = 0;
  for (const row of overdue) {
    const result = await assignInstructorByQueue(row.id, "timeout");
    if (!result || result.status === "EXPIRED") {
      count += 1;
    }
  }
  return count;
}

/** Перед выдачей заказа — если дедлайн и льготное окно прошли, закрыть заявку. */
export async function rerouteOrderIfDeadlinePassed(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING_INSTRUCTOR") {
    return;
  }
  if (
    order.pendingExpiresAt != null &&
    !instructorCanAcceptAfterDeadline(order.pendingExpiresAt)
  ) {
    await assignInstructorByQueue(orderId, "timeout");
  }
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
