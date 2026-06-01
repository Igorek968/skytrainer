import { NextResponse } from "next/server";
import { Prisma, type UserRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertClientHasNoOtherActiveOrder } from "@/lib/services/client-active-order";
import {
  assignInstructorByQueue,
  loadRoutingQueueLabels,
  prepareInstructorQueue,
  rerouteOrderIfDeadlinePassed,
} from "@/lib/services/instructor-routing";
import type { OrderCancelledBy } from "@prisma/client";

import { cancelOrderWithRefund, claimInstructorLateRefund } from "@/lib/services/order-refund";
import { canClaimInstructorLateRefund, computeCancelRefundQuote } from "@/lib/refund-policy";
import { transitionOrderStatus } from "@/lib/services/order-service";
import { orderActionSchema } from "@/lib/validations/order";
import { orderRelaxedInstructorTiming, orderSkipsInstructorEta } from "@/shared/lib/order-flex";
import {
  extractInstructorEtaMinutes,
  instructorEtaDeadlineFromMinutes,
} from "@/shared/lib/order-instructor-eta";
import { clientCanRemoveOrderFromHistory } from "@/shared/lib/order-status";
import { isLongInstructorEtaMinutes } from "@/shared/lib/order-long-eta";
import { orderHasMeetAddress } from "@/shared/lib/order-meet-address";

type Ctx = { params: Promise<{ id: string }> };

function mergeEtaToNotes(rawNotes: string | null | undefined, etaMinutes: number): string {
  const etaLine = `ETA инструктора: ~${Math.round(etaMinutes)} мин.`;
  const notesWithoutOldEta = (rawNotes ?? "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !line.startsWith("ETA инструктора:"));
  return [...notesWithoutOldEta, etaLine].filter(Boolean).join("\n").trim();
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  await rerouteOrderIfDeadlinePassed(id);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, image: true } },
      instructor: {
        select: { id: true, name: true, image: true, instructorProfile: true },
      },
      resort: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const uid = session.user.id;
  let role: UserRole | undefined = session.user.role;
  if (!role) {
    const row = await prisma.user.findUnique({
      where: { id: uid },
      select: { role: true },
    });
    role = row?.role ?? undefined;
  }
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const allowed =
    order.clientId === uid ||
    (order.instructorId === uid && order.status !== "AWAITING_PAYMENT") ||
    role === "ADMIN";
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  /** Старые заказы: ETA только в notes — восстанавливаем instructorEtaAt для живого таймера. */
  let orderForClient = order;
  if (!order.instructorEtaAt) {
    const etaMinutes = extractInstructorEtaMinutes(order.notes);
    if (etaMinutes != null) {
      const acceptedMs = order.acceptedAt?.getTime();
      const deadline =
        acceptedMs != null && Number.isFinite(acceptedMs)
          ? new Date(acceptedMs + etaMinutes * 60_000)
          : instructorEtaDeadlineFromMinutes(etaMinutes);
      orderForClient = await prisma.order.update({
        where: { id },
        data: { instructorEtaAt: deadline },
        include: {
          client: { select: { id: true, name: true, image: true } },
          instructor: {
            select: { id: true, name: true, image: true, instructorProfile: true },
          },
          resort: true,
        },
      });
    }
  }

  let routingQueue: { userId: string; name: string | null }[] | undefined;
  if (
    role === "CLIENT" &&
    orderForClient.clientId === uid &&
    orderForClient.status !== "AWAITING_PAYMENT" &&
    Array.isArray(orderForClient.instructorQueue)
  ) {
    routingQueue = await loadRoutingQueueLabels(orderForClient.instructorQueue as string[]);
  }

  return NextResponse.json(
    { order: orderForClient, ...(routingQueue ? { routingQueue } : {}) },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = orderActionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const action = parsed.data;
  const actor = session.user.id;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    if (action.action === "request_instructor") {
      if (order.clientId !== actor || order.status !== "DRAFT") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      try {
        await assertClientHasNoOtherActiveOrder(actor, id);
      } catch (e) {
        if (e instanceof Error && e.message === "ACTIVE_ORDER_EXISTS") {
          return NextResponse.json(
            {
              error:
                "У вас уже есть другая активная заявка. Завершите или отмените её перед новой записью.",
            },
            { status: 409 }
          );
        }
        throw e;
      }

      await prisma.order.update({
        where: { id },
        data: {
          instructorId: action.instructorId,
          status: "AWAITING_PAYMENT",
          flexibleInstructorInvite: action.flexibleInstructorInvite ?? false,
        },
      });
      const prepared = await prepareInstructorQueue(id);
      if (!prepared.ok) {
        await prisma.order.update({
          where: { id },
          data: {
            status: "DRAFT",
            instructorId: action.instructorId,
            flexibleInstructorInvite: false,
            instructorQueue: Prisma.JsonNull,
            instructorQueueIndex: 0,
            agreedHourlyRate: null,
            amountTotal: null,
            instructorShareAmount: null,
            pendingExpiresAt: null,
          },
        });
        const msg =
          prepared.reason === "NO_PROFILE"
            ? "Инструктор недоступен для записи"
            : "Не удалось подготовить заявку к выбранному инструктору";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      const refreshed = await prisma.order.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, name: true, image: true } },
          instructor: {
            select: { id: true, name: true, image: true, instructorProfile: true },
          },
          resort: true,
        },
      });
      return NextResponse.json({ order: refreshed });
    }

    if (action.action === "preview_cancel_refund") {
      if (order.clientId !== actor && order.instructorId !== actor) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const cancelledBy: OrderCancelledBy =
        order.clientId === actor
          ? "CLIENT"
          : order.instructorId === actor
            ? "INSTRUCTOR"
            : "PLATFORM";
      const quote = computeCancelRefundQuote({
        cancelledBy,
        status: order.status,
        paymentStatus: order.paymentStatus,
        requestedStartDate: order.requestedStartDate,
        acceptedAt: order.acceptedAt,
      });
      const totalRub = order.amountTotal != null ? Number(order.amountTotal) : 0;
      const refundAmount =
        quote.percent > 0 ? Math.round(((totalRub * quote.percent) / 100) * 100) / 100 : 0;
      return NextResponse.json({
        refundPercent: quote.percent,
        refundAmount,
        reason: quote.reason,
        lateRefundEligible: canClaimInstructorLateRefund({
          status: order.status,
          paymentStatus: order.paymentStatus,
          instructorEtaAt: order.instructorEtaAt,
          lessonStartedAt: order.lessonStartedAt,
          lateRefundClaimedAt: order.lateRefundClaimedAt,
        }),
      });
    }

    if (action.action === "cancel") {
      const cancelledBy: OrderCancelledBy =
        order.clientId === actor
          ? "CLIENT"
          : order.instructorId === actor
            ? "INSTRUCTOR"
            : "PLATFORM";
      const result = await cancelOrderWithRefund({
        orderId: id,
        actorUserId: actor,
        cancelledBy,
      });
      return NextResponse.json({
        order: result.order,
        refundPercent: result.refundPercent,
        refundAmount: result.refundAmount,
      });
    }

    if (action.action === "claim_late_refund") {
      if (order.clientId !== actor) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (
        !canClaimInstructorLateRefund({
          status: order.status,
          paymentStatus: order.paymentStatus,
          instructorEtaAt: order.instructorEtaAt,
          lessonStartedAt: order.lessonStartedAt,
          lateRefundClaimedAt: order.lateRefundClaimedAt,
        })
      ) {
        return NextResponse.json(
          { error: "Полный возврат по опозданию сейчас недоступен для этого заказа" },
          { status: 400 },
        );
      }
      const result = await claimInstructorLateRefund({ orderId: id, actorUserId: actor });
      return NextResponse.json({
        order: result.order,
        refundPercent: result.refundPercent,
        refundAmount: result.refundAmount,
      });
    }

    if (action.action === "hold_pending_long_eta") {
      if (order.instructorId !== actor) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (order.status !== "PENDING_INSTRUCTOR") {
        return NextResponse.json({ error: "Действие доступно только для ожидающей заявки" }, { status: 400 });
      }
      if (!isLongInstructorEtaMinutes(action.etaMinutes)) {
        return NextResponse.json(
          { error: `Укажите время прибытия больше ${30} минут` },
          { status: 400 },
        );
      }
      const updated = await prisma.order.update({
        where: { id },
        data: { pendingExpiresAt: null },
      });
      return NextResponse.json({ order: updated });
    }

    if (action.action === "accept") {
      if (!orderHasMeetAddress(order)) {
        return NextResponse.json(
          { error: "Нельзя принять заявку: клиент не указал место встречи." },
          { status: 400 },
        );
      }
      if (order.pendingExpiresAt && order.pendingExpiresAt < new Date()) {
        const routed = await assignInstructorByQueue(id, "timeout");
        if (!routed || routed.status === "EXPIRED") {
          return NextResponse.json(
            { error: "Время ответа инструктора истекло. Заявка закрыта; при оплате оформляется возврат." },
            { status: 400 },
          );
        }
        return NextResponse.json({ order: routed.order });
      }
      const timingInput = {
        flexibleInstructorInvite: Boolean(order.flexibleInstructorInvite),
        requestedDays: order.requestedDays,
        requestedStartDate: order.requestedStartDate,
      };
      const skipsEta = orderSkipsInstructorEta(timingInput);
      const etaMinutes = skipsEta ? undefined : action.etaMinutes;
      if (
        !skipsEta &&
        (typeof etaMinutes !== "number" || !Number.isFinite(etaMinutes) || etaMinutes < 1)
      ) {
        return NextResponse.json(
          { error: "Укажите, через сколько минут вы сможете быть на месте встречи." },
          { status: 400 },
        );
      }
      let extra: Prisma.OrderUpdateInput | undefined;
      if (typeof etaMinutes === "number" && Number.isFinite(etaMinutes) && etaMinutes > 0) {
        const nextNotes = mergeEtaToNotes(order.notes, etaMinutes);
        extra = {
          notes: nextNotes || null,
          instructorEtaAt: instructorEtaDeadlineFromMinutes(etaMinutes),
        };
        if (isLongInstructorEtaMinutes(etaMinutes)) {
          extra.pendingExpiresAt = null;
        }
      }
      const updated = await transitionOrderStatus({
        orderId: id,
        actorUserId: actor,
        to: "ACCEPTED",
        extra,
      });
      return NextResponse.json({ order: updated });
    }

    if (action.action === "set_eta") {
      if (order.instructorId !== actor) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (
        orderSkipsInstructorEta({
          flexibleInstructorInvite: Boolean(order.flexibleInstructorInvite),
          requestedDays: order.requestedDays,
        })
      ) {
        return NextResponse.json(
          {
            error:
              "Для этой заявки ETA до клиента не используется (запись на дату или бронь на несколько дней).",
          },
          { status: 400 },
        );
      }
      if (
        order.status !== "ACCEPTED" &&
        order.status !== "INSTRUCTOR_EN_ROUTE" &&
        order.status !== "LESSON_STARTED"
      ) {
        return NextResponse.json({ error: "Указать ETA можно только для активного заказа" }, { status: 400 });
      }
      const nextNotes = mergeEtaToNotes(order.notes, action.etaMinutes);
      const updated = await prisma.order.update({
        where: { id },
        data: {
          notes: nextNotes || null,
          instructorEtaAt: instructorEtaDeadlineFromMinutes(action.etaMinutes),
        },
      });
      return NextResponse.json({ order: updated });
    }

    if (action.action === "reject") {
      if (order.instructorId !== actor) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      await assignInstructorByQueue(id, "reject");
      const updated = await prisma.order.findUnique({ where: { id } });
      return NextResponse.json({ order: updated });
    }

    if (action.action === "en_route") {
      const updated = await transitionOrderStatus({
        orderId: id,
        actorUserId: actor,
        to: "INSTRUCTOR_EN_ROUTE",
      });
      return NextResponse.json({ order: updated });
    }

    if (action.action === "start_lesson") {
      const updated = await transitionOrderStatus({
        orderId: id,
        actorUserId: actor,
        to: "LESSON_STARTED",
      });
      return NextResponse.json({ order: updated });
    }

    if (action.action === "complete_lesson") {
      const updated = await transitionOrderStatus({
        orderId: id,
        actorUserId: actor,
        to: "COMPLETED",
      });
      return NextResponse.json({ order: updated });
    }

    if (action.action === "add_review") {
      if (order.clientId !== actor) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (order.status !== "COMPLETED") {
        return NextResponse.json({ error: "Урок не завершён" }, { status: 400 });
      }
      if (order.clientRating != null) {
        return NextResponse.json({ error: "Оценка уже оставлена" }, { status: 400 });
      }
      if (!order.instructorId) {
        return NextResponse.json({ error: "Нет инструктора" }, { status: 400 });
      }

      const rating = action.rating;
      const reviewText = action.review;

      const updated = await prisma.$transaction(async (tx) => {
        const o = await tx.order.update({
          where: { id },
          data: {
            clientRating: rating,
            clientReview: reviewText ?? null,
          },
        });

        const profile = await tx.instructorProfile.findUnique({
          where: { userId: order.instructorId! },
        });
        if (profile) {
          const n = profile.reviewCount + 1;
          const avg =
            (profile.ratingAvg * profile.reviewCount + rating) / (profile.reviewCount + 1 || 1);
          await tx.instructorProfile.update({
            where: { userId: order.instructorId! },
            data: { ratingAvg: avg, reviewCount: n },
          });
        }
        return o;
      });

      return NextResponse.json({ order: updated });
    }

    if (action.action === "add_client_review") {
      if (order.instructorId !== actor) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (order.status !== "COMPLETED") {
        return NextResponse.json({ error: "Урок не завершён" }, { status: 400 });
      }
      if (order.instructorRating != null) {
        return NextResponse.json({ error: "Оценка клиенту уже оставлена" }, { status: 400 });
      }
      const updated = await prisma.order.update({
        where: { id },
        data: {
          instructorRating: action.rating,
          instructorReview: action.review ?? null,
        },
      });
      return NextResponse.json({ order: updated });
    }

    if (action.action === "set_payment_cash") {
      if (order.clientId !== actor) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (order.status !== "COMPLETED") {
        return NextResponse.json({ error: "Неверный статус" }, { status: 400 });
      }
      const updated = await prisma.order.update({
        where: { id },
        data: {
          paymentMethod: "CASH",
          paymentStatus: "PAID",
        },
      });
      return NextResponse.json({ order: updated });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (msg === "INVALID_TRANSITION")
      return NextResponse.json({ error: "Недопустимый переход статуса" }, { status: 400 });
    throw e;
  }

  return NextResponse.json({ error: "Unsupported" }, { status: 400 });
}

/** Клиент удаляет заказ из своей истории (неактивные / завершённые заявки). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, clientId: true, status: true } });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.clientId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!clientCanRemoveOrderFromHistory(order.status)) {
    return NextResponse.json(
      {
        error:
          "Этот заказ ещё активен. Отмените его или дождитесь завершения урока — после этого можно будет удалить из истории.",
      },
      { status: 400 }
    );
  }

  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
