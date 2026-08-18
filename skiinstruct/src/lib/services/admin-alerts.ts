import type { AdminAlert, AdminAlertCategory } from "@prisma/client";

import {
  adminAlertCategoryLabel,
  type AdminAlertDTO,
  type AdminAlertQueueCounts,
} from "@/features/admin/admin-alerts-types";
import { prisma } from "@/lib/prisma";
import { sendWebPushToUser } from "@/lib/push-web";
import { getPublicProductName } from "@/shared/lib/product";

export type { AdminAlertDTO, AdminAlertQueueCounts } from "@/features/admin/admin-alerts-types";
export { adminAlertCategoryLabel } from "@/features/admin/admin-alerts-types";

function toDto(row: AdminAlert): AdminAlertDTO {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    href: row.href,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}

/** Живые очереди для бейджей в меню (не зависят от прочтения алертов). */
export async function getAdminAlertQueueCounts(): Promise<AdminAlertQueueCounts> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const [
    moderationProfiles,
    moderationEventsStandalone,
    catalogPending,
    openSupport,
    payouts,
    referralPayouts,
    compliance,
    qualityClaims,
    failedRefunds,
    overdueUrgentPending,
    unreadAlerts,
  ] = await Promise.all([
    prisma.instructorProfile.count({
      where: {
        OR: [{ verificationStatus: "PENDING" }, { profileDraftStatus: "PENDING_REVIEW" }],
      },
    }),
    prisma.instructorEvent.count({
      where: { moderationStatus: "PENDING_REVIEW", catalogItemId: null },
    }),
    prisma.instructorEvent.count({
      where: { moderationStatus: "PENDING_REVIEW", catalogItemId: { not: null } },
    }),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.instructorPayoutRequest.count({ where: { status: "PENDING" } }),
    prisma.referralPayoutRequest.count({ where: { status: "PENDING" } }),
    prisma.instructorComplianceDocument.count({ where: { status: "PENDING" } }),
    prisma.order.count({
      where: { qualityClaimedAt: { not: null, gte: weekAgo } },
    }),
    prisma.order.count({ where: { refundStatus: "FAILED" } }),
    prisma.order.count({
      where: {
        status: "PENDING_INSTRUCTOR",
        urgentInvite: true,
        pendingExpiresAt: { not: null, lt: now },
      },
    }),
    prisma.adminAlert.count({ where: { readAt: null } }),
  ]);

  return {
    moderation: moderationProfiles + moderationEventsStandalone,
    messages: openSupport,
    finance: payouts + referralPayouts,
    compliance,
    orders: qualityClaims + failedRefunds + overdueUrgentPending,
    catalog: catalogPending,
    /** Новые / непроверенные инструкторы — дублирует часть модерации, но видно в «Пользователи». */
    users: moderationProfiles,
    unreadAlerts,
  };
}

export async function listAdminAlerts(limit = 40): Promise<AdminAlertDTO[]> {
  const rows = await prisma.adminAlert.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
  });
  return rows.map(toDto);
}

export async function markAdminAlertsRead(ids?: string[]): Promise<number> {
  const where =
    ids && ids.length
      ? { id: { in: ids }, readAt: null }
      : { readAt: null };
  const res = await prisma.adminAlert.updateMany({
    where,
    data: { readAt: new Date() },
  });
  return res.count;
}

async function pushAlertToAdmins(alert: AdminAlert): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MODERATOR"] } },
    select: { id: true },
  });
  if (!admins.length) return;

  const app = getPublicProductName();
  const category = adminAlertCategoryLabel(alert.category);
  const payload = {
    title: `${app}: ${category}`,
    body: alert.title.length > 120 ? `${alert.title.slice(0, 117)}…` : alert.title,
    url: alert.href.startsWith("/") ? alert.href : `/${alert.href}`,
    tag: `admin-alert-${alert.id}`,
    kind: "admin-alert" as const,
    sound: "reminder" as const,
  };

  await Promise.all(
    admins.map((a) =>
      sendWebPushToUser(a.id, payload).catch((e) => {
        console.error("[admin-alert] push", a.id, e instanceof Error ? e.message : e);
      }),
    ),
  );
}

export type EmitAdminAlertInput = {
  category: AdminAlertCategory;
  title: string;
  body: string;
  href: string;
  dedupeKey: string;
  entityId?: string | null;
  /** По умолчанию true — Web Push всем ADMIN. */
  push?: boolean;
};

/**
 * Создаёт/переоткрывает оповещение админам.
 * Если уже есть непрочитанное с тем же dedupeKey — не спамит повторным push.
 */
export async function emitAdminAlert(input: EmitAdminAlertInput): Promise<AdminAlert | null> {
  try {
    const title = input.title.trim().slice(0, 160);
    const body = input.body.trim().slice(0, 2000) || title;
    const href = input.href.trim() || "/admin";
    const dedupeKey = input.dedupeKey.trim().slice(0, 190);
    if (!title || !dedupeKey) return null;

    const existing = await prisma.adminAlert.findUnique({ where: { dedupeKey } });
    let row: AdminAlert;
    let shouldPush = false;

    if (existing) {
      if (!existing.readAt) {
        row = existing;
      } else {
        row = await prisma.adminAlert.update({
          where: { id: existing.id },
          data: {
            category: input.category,
            title,
            body,
            href,
            entityId: input.entityId ?? null,
            readAt: null,
            createdAt: new Date(),
          },
        });
        shouldPush = true;
      }
    } else {
      row = await prisma.adminAlert.create({
        data: {
          category: input.category,
          title,
          body,
          href,
          dedupeKey,
          entityId: input.entityId ?? null,
        },
      });
      shouldPush = true;
    }

    if (shouldPush && input.push !== false) {
      void pushAlertToAdmins(row);
    }
    return row;
  } catch (e) {
    console.error("[admin-alert] emit", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function emitAdminModerationProfileAlert(params: {
  userId: string;
  displayName: string;
  kind: "NEW_ACCOUNT" | "PROFILE_UPDATE";
}) {
  const name = params.displayName.trim() || "Инструктор";
  const isUpdate = params.kind === "PROFILE_UPDATE";
  return emitAdminAlert({
    category: "MODERATION",
    title: isUpdate ? `Обновление анкеты: ${name}` : `Новая анкета: ${name}`,
    body: isUpdate
      ? "Инструктор отправил изменения профиля на модерацию."
      : "Инструктор ожидает проверки аккаунта.",
    href: `/admin/moderation?participant=${encodeURIComponent(params.userId)}`,
    dedupeKey: `moderation:profile:${params.userId}`,
    entityId: params.userId,
  });
}

export async function emitAdminModerationEventAlert(params: {
  eventId: string;
  title: string;
  instructorName?: string | null;
}) {
  const eventTitle = params.title.trim() || "Событие";
  const who = params.instructorName?.trim();
  return emitAdminAlert({
    category: "MODERATION",
    title: `Событие на модерации: ${eventTitle}`,
    body: who ? `Отправитель: ${who}` : "Инструктор отправил событие на проверку.",
    href: `/admin/moderation`,
    dedupeKey: `moderation:event:${params.eventId}`,
    entityId: params.eventId,
  });
}

export async function emitAdminSupportAlert(params: {
  ticketId: string;
  messageId: string;
  userLabel: string;
  preview: string;
}) {
  const preview = params.preview.trim().slice(0, 160) || "Новое сообщение";
  return emitAdminAlert({
    category: "MESSAGES",
    title: `Поддержка: ${params.userLabel}`,
    body: preview,
    href: `/admin/messages?ticket=${params.ticketId}`,
    dedupeKey: `support:${params.ticketId}:${params.messageId}`,
    entityId: params.ticketId,
  });
}

export async function emitAdminPayoutAlert(params: {
  requestId: string;
  kind: "instructor" | "referral";
  amountRub: number;
  userLabel: string;
}) {
  const amount = Math.round(params.amountRub);
  const label = params.kind === "instructor" ? "Выплата инструктору" : "Реферальная выплата";
  return emitAdminAlert({
    category: "FINANCE",
    title: `${label}: ${amount.toLocaleString("ru-RU")} ₽`,
    body: params.userLabel,
    href: `/admin/finance`,
    dedupeKey: `finance:${params.kind}:${params.requestId}`,
    entityId: params.requestId,
  });
}

export async function emitAdminComplianceAlert(params: {
  documentId: string;
  userId: string;
  userLabel: string;
  docType: string;
}) {
  return emitAdminAlert({
    category: "COMPLIANCE",
    title: `Документ ЮKassa: ${params.userLabel}`,
    body: `Загружен файл (${params.docType}) — нужна проверка.`,
    href: `/admin/compliance?participant=${encodeURIComponent(params.userId)}`,
    dedupeKey: `compliance:doc:${params.documentId}`,
    entityId: params.documentId,
  });
}

export async function emitAdminQualityClaimAlert(params: {
  orderId: string;
  categoryLabel: string;
  clientLabel: string;
}) {
  return emitAdminAlert({
    category: "ORDERS",
    title: `Претензия по качеству`,
    body: `${params.clientLabel}: ${params.categoryLabel}`,
    href: `/admin/compliance`,
    dedupeKey: `orders:claim:${params.orderId}`,
    entityId: params.orderId,
  });
}

/** Заявка инструктора присоединиться к карточке каталога. */
export async function emitAdminCatalogJoinAlert(params: {
  eventId: string;
  catalogTitle: string;
  instructorName?: string | null;
}) {
  const who = params.instructorName?.trim() || "Инструктор";
  const card = params.catalogTitle.trim() || "Карточка каталога";
  return emitAdminAlert({
    category: "CATALOG",
    title: `Каталог: заявка на «${card}»`,
    body: `${who} ждёт одобрения участия.`,
    href: `/admin/event-catalog`,
    dedupeKey: `catalog:join:${params.eventId}`,
    entityId: params.eventId,
  });
}

/** Срыв возврата — нужна ручная проверка. */
export async function emitAdminRefundFailedAlert(params: {
  orderId: string;
  amountRub?: number | null;
  reason?: string | null;
}) {
  const amount =
    params.amountRub != null && Number.isFinite(params.amountRub)
      ? `${Math.round(params.amountRub).toLocaleString("ru-RU")} ₽`
      : null;
  return emitAdminAlert({
    category: "ORDERS",
    title: amount ? `Ошибка возврата: ${amount}` : "Ошибка возврата по заказу",
    body: (params.reason?.trim() || "Платёжный возврат не прошёл — проверьте заказ.").slice(0, 400),
    href: `/admin/orders?q=${encodeURIComponent(params.orderId)}`,
    dedupeKey: `orders:refund-failed:${params.orderId}`,
    entityId: params.orderId,
  });
}

/** Клиент заявил полный возврат из‑за опоздания инструктора. */
export async function emitAdminLateRefundAlert(params: {
  orderId: string;
  clientLabel: string;
  amountRub?: number | null;
  refundFailed?: boolean;
}) {
  const amount =
    params.amountRub != null && Number.isFinite(params.amountRub)
      ? `${Math.round(params.amountRub).toLocaleString("ru-RU")} ₽`
      : "заказ";
  return emitAdminAlert({
    category: "ORDERS",
    title: params.refundFailed
      ? `Опоздание инструктора — возврат не прошёл`
      : `Опоздание инструктора — полный возврат`,
    body: `${params.clientLabel}: ${amount}`,
    href: `/admin/orders?q=${encodeURIComponent(params.orderId)}`,
    dedupeKey: `orders:late-refund:${params.orderId}`,
    entityId: params.orderId,
  });
}

/** Оплаченная заявка ждёт ответа инструктора (мониторинг воронки). */
export async function emitAdminPendingOrderAlert(params: {
  orderId: string;
  clientLabel: string;
  instructorLabel?: string | null;
  urgent: boolean;
  amountRub?: number | null;
}) {
  const amount =
    params.amountRub != null && Number.isFinite(params.amountRub)
      ? `${Math.round(params.amountRub).toLocaleString("ru-RU")} ₽`
      : null;
  const who = params.instructorLabel?.trim() || "инструктор";
  return emitAdminAlert({
    category: "ORDERS",
    title: params.urgent ? `Срочная заявка ожидает ответа` : `Заявка ожидает инструктора`,
    body: [params.clientLabel, who, amount].filter(Boolean).join(" · "),
    href: `/admin/orders?status=PENDING_INSTRUCTOR&q=${encodeURIComponent(params.orderId)}`,
    dedupeKey: `orders:pending:${params.orderId}`,
    entityId: params.orderId,
    /** Не срочные — только в колокольчик, без push-спама. */
    push: params.urgent,
  });
}

/** Срочная заявка истекла / инструктор отказал — заказ EXPIRED. */
export async function emitAdminOrderExpiredAlert(params: {
  orderId: string;
  reason: "timeout" | "reject" | "unavailable";
  clientLabel?: string | null;
  paid: boolean;
}) {
  const reasonLabel =
    params.reason === "reject"
      ? "Инструктор отклонил заявку"
      : params.reason === "unavailable"
        ? "Инструктор недоступен"
        : "Истёк срок ответа инструктора";
  return emitAdminAlert({
    category: "ORDERS",
    title: params.paid ? `Заказ закрыт без назначения (оплачен)` : `Заказ закрыт без назначения`,
    body: [reasonLabel, params.clientLabel?.trim()].filter(Boolean).join(" · "),
    href: `/admin/orders?q=${encodeURIComponent(params.orderId)}`,
    dedupeKey: `orders:expired:${params.orderId}`,
    entityId: params.orderId,
    push: params.paid,
  });
}

/** Новый пользователь-инструктор (если ещё не ушло в модерацию анкеты). */
export async function emitAdminNewInstructorAlert(params: {
  userId: string;
  displayName: string;
}) {
  const name = params.displayName.trim() || "Инструктор";
  return emitAdminAlert({
    category: "USERS",
    title: `Новый инструктор: ${name}`,
    body: "Зарегистрировался — проверьте анкету и доступ.",
    href: `/admin/users?q=${encodeURIComponent(params.userId)}`,
    dedupeKey: `users:instructor:${params.userId}`,
    entityId: params.userId,
  });
}
