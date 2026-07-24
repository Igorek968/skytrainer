import { NextResponse } from "next/server";

import { Prisma, type UserRole } from "@prisma/client";

import type { AdminOrderOverviewRow, AdminParticipantInsights } from "@/features/admin/admin-overview-types";
import { normalizeAdminSearchInput } from "@/features/admin/admin-search-params";
import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import {
  computeProfileDraftChanges,
  parseProfileDraft,
  snapshotProfileToDraft,
} from "@/lib/instructor-profile-draft";
import { prisma } from "@/lib/prisma";
import { PRODUCT_NAME } from "@/shared/lib/product";
import { orderStatusLabel } from "@/shared/lib/order-status";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
} as const;

function roleRu(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "Админ";
    case "INSTRUCTOR":
      return "Инструктор";
    case "CLIENT":
      return "Клиент";
    default:
      return role;
  }
}

function num(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === "number") return Number.isFinite(d) ? d : 0;
  if (typeof d === "object" && d !== null && "toNumber" in d && typeof (d as { toNumber: () => number }).toNumber === "function") {
    return (d as { toNumber: () => number }).toNumber();
  }
  const n = Number(d);
  return Number.isFinite(n) ? n : 0;
}

/** Один токен ищется в email, ФИО (User.name) и текстовых полях профиля инструктора — часть аккаунтов без заполненного name всё равно находится по био/контактам. */
function userSearchTokenClause(t: string): Prisma.UserWhereInput {
  return {
    OR: [
      { email: { contains: t, mode: "insensitive" } },
      { name: { contains: t, mode: "insensitive" } },
      { phone: { contains: t.replace(/\D/g, "") || t } },
      {
        instructorProfile: {
          OR: [
            { bio: { contains: t, mode: "insensitive" } },
            { certificationLevel: { contains: t, mode: "insensitive" } },
            { supportContact: { contains: t, mode: "insensitive" } },
            { inn: { contains: t } },
          ],
        },
      },
    ],
  };
}

/** Несколько слов — каждое должно где‑то совпасть (удобно для «Фамилия Имя»). */
function buildUserSearchWhere(raw: string): Prisma.UserWhereInput {
  const tokens = normalizeAdminSearchInput(raw).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { email: { equals: "__admin_search_empty__", mode: "insensitive" } };
  }
  if (tokens.length === 1) return userSearchTokenClause(tokens[0]);
  return { AND: tokens.map(userSearchTokenClause) };
}

function escapeILikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Поиск по профилю инструктора: специализации (вид деятельности), услуги, био, уровень сертификации. */
async function findUserIdsForActivityToken(token: string): Promise<Set<string>> {
  const pattern = `%${escapeILikePattern(token)}%`;
  const rows = await prisma.$queryRaw<{ userId: string }[]>(
    Prisma.sql`
      SELECT DISTINCT "userId"
      FROM "InstructorProfile"
      WHERE EXISTS (
        SELECT 1 FROM unnest("specializations") AS spec
        WHERE spec ILIKE ${pattern} ESCAPE '\\'
      )
      OR EXISTS (
        SELECT 1 FROM unnest("additionalServices") AS svc
        WHERE svc ILIKE ${pattern} ESCAPE '\\'
      )
      OR COALESCE(bio, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE("certificationLevel", '') ILIKE ${pattern} ESCAPE '\\'
    `,
  );
  return new Set(rows.map((r) => r.userId));
}

/** Несколько слов — каждое должно находиться хотя бы в одном из полей профиля (как поиск «лыжи фрирайд»). */
async function findUserIdsByActivityQuery(raw: string): Promise<string[]> {
  const tokens = normalizeAdminSearchInput(raw).split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];
  let acc: Set<string> | null = null;
  for (const token of tokens) {
    const next = await findUserIdsForActivityToken(token);
    acc =
      acc === null ? next : new Set<string>([...acc].filter((id: string) => next.has(id)));
    if (acc.size === 0) return [];
  }
  return [...(acc ?? [])].slice(0, 800);
}

const userMatchSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  createdAt: true,
  instructorProfile: { select: { specializations: true, inn: true } },
} as const;

const orderOverviewSelect = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  flexibleInstructorInvite: true,
  pendingExpiresAt: true,
  amountTotal: true,
  paymentStatus: true,
  client: { select: { name: true, email: true } },
  instructor: { select: { name: true, email: true } },
} as const;

type OrderOverviewRow = Prisma.OrderGetPayload<{ select: typeof orderOverviewSelect }>;

function mapOrderOverviewRow(o: OrderOverviewRow): AdminOrderOverviewRow {
  return {
    id: o.id,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    flexibleInstructorInvite: o.flexibleInstructorInvite,
    pendingExpiresAt: o.pendingExpiresAt ? o.pendingExpiresAt.toISOString() : null,
    amountTotal: o.amountTotal != null ? num(o.amountTotal) : null,
    paymentStatus: o.paymentStatus,
    clientName: o.client.name,
    clientEmail: o.client.email,
    instructorName: o.instructor?.name ?? null,
  };
}

async function buildFocusParticipantInsights(
  uid: string,
  thirtyDaysAgo: Date,
): Promise<AdminParticipantInsights | null> {
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, email: true, name: true, phone: true, role: true },
  });
  if (!user) return null;

  const baseWhere: Prisma.OrderWhereInput = {
    OR: [{ clientId: uid }, { instructorId: uid }],
  };

  const [
    ordersTotal,
    ordersByStatusRows,
    awaitingPayment,
    pendingInstr,
    inProgress,
    completedLast30d,
    paidAggClient,
    paidAggInstr,
    paidOrdersCountScoped,
    ordersPreviewRows,
    messagesPreview,
  ] = await prisma.$transaction([
    prisma.order.count({ where: baseWhere }),
    prisma.order.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.order.count({ where: { ...baseWhere, status: "AWAITING_PAYMENT" } }),
    prisma.order.count({ where: { ...baseWhere, status: "PENDING_INSTRUCTOR" } }),
    prisma.order.count({
      where: {
        ...baseWhere,
        status: { in: ["ACCEPTED", "INSTRUCTOR_EN_ROUTE", "LESSON_STARTED"] },
      },
    }),
    prisma.order.count({
      where: {
        ...baseWhere,
        status: "COMPLETED",
        updatedAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.order.aggregate({
      where: { clientId: uid, paymentStatus: "PAID", amountTotal: { not: null } },
      _sum: { amountTotal: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: {
        instructorId: uid,
        paymentStatus: "PAID",
        instructorShareAmount: { not: null },
      },
      _sum: { instructorShareAmount: true },
      _count: { _all: true },
    }),
    prisma.order.count({ where: { ...baseWhere, paymentStatus: "PAID" } }),
    prisma.order.findMany({
      where: baseWhere,
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: orderOverviewSelect,
    }),
    prisma.message.findMany({
      where: {
        OR: [{ senderId: uid }, { order: baseWhere }],
      },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        id: true,
        createdAt: true,
        body: true,
        orderId: true,
        sender: { select: { name: true, email: true } },
      },
    }),
  ]);

  const participantStatusCounts = Object.fromEntries(
    ordersByStatusRows.map((row) => {
      const c = row._count;
      const n =
        c && typeof c === "object" && "_all" in c && typeof c._all === "number" ? c._all : 0;
      return [row.status, n];
    }),
  ) as Record<string, number>;

  type ActivityItem = {
    id: string;
    at: string;
    category: "order" | "user" | "instructor" | "message";
    eventLabel: string;
    summary: string;
    meta: string | null;
  };

  const activityParts: ActivityItem[] = [];

  for (const o of ordersPreviewRows) {
    const createdMs = o.createdAt.getTime();
    const updatedMs = o.updatedAt.getTime();
    const isNewOrder = Math.abs(updatedMs - createdMs) < 1500;
    const clientBit = o.client.name ? `${o.client.name} · ${o.client.email}` : o.client.email;
    const instrBit = o.instructor
      ? o.instructor.name
        ? `${o.instructor.name}`
        : o.instructor.email
      : null;
    activityParts.push({
      id: `order:${o.id}`,
      at: o.updatedAt.toISOString(),
      category: "order",
      eventLabel: isNewOrder ? "Новый заказ" : "Изменение заказа",
      summary: `${orderStatusLabel(o.status)} · оплата ${o.paymentStatus}`,
      meta: instrBit ? `${clientBit} → ${instrBit}` : clientBit,
    });
  }

  for (const m of messagesPreview) {
    const senderLabel = m.sender.name?.trim() ? m.sender.name : m.sender.email;
    const compact = m.body.replace(/\s+/g, " ").trim();
    const snippet =
      compact.length > 120 ? `${compact.slice(0, 120).trim()}…` : compact || "(пустое сообщение)";
    activityParts.push({
      id: `message:${m.id}`,
      at: m.createdAt.toISOString(),
      category: "message",
      eventLabel: "Чат по заказу",
      summary: snippet,
      meta: `${senderLabel} · заказ ${m.orderId.slice(0, 8)}…`,
    });
  }

  activityParts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    user,
    ordersTotal,
    ordersByStatus: participantStatusCounts,
    pipeline: {
      awaitingPayment,
      pendingInstructor: pendingInstr,
      inProgress,
      completedLast30d,
    },
    finance: {
      paidOrdersCount: paidOrdersCountScoped,
      grossPaidAsClientRub: num(paidAggClient._sum.amountTotal),
      instructorSharePaidRub: num(paidAggInstr._sum.instructorShareAmount),
    },
    activityPreview: activityParts.slice(0, 24),
    ordersPreview: ordersPreviewRows.map(mapOrderOverviewRow),
  };
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAdminSession();
    if (isApiErrorResponse(authResult)) return authResult;

    const url = new URL(req.url);
    const focusQueryRaw = normalizeAdminSearchInput(
      url.searchParams.get("user")?.trim() ?? url.searchParams.get("email")?.trim() ?? "",
    );
    const activityQueryRaw = normalizeAdminSearchInput(url.searchParams.get("activity") ?? "");
    const participantIdRaw = url.searchParams.get("participant")?.trim() ?? "";
    const activityTokens = activityQueryRaw.split(/\s+/).filter((t) => t.length >= 2);

    const hasUserFocus = focusQueryRaw.length >= 2;
    const hasActivityFocus = activityTokens.length > 0;
    const hasFocus = hasUserFocus || hasActivityFocus;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    const [
    ordersCount,
    usersCount,
    pendingInstructors,
    onlineQueuePending,
    flexiblePending,
    inProgress,
    awaitingPayment,
    draftOrders,
    paidAggregate,
    completedLast30d,
    ordersByStatus,
  ] = await prisma.$transaction([
    prisma.order.count(),
    prisma.user.count(),
    prisma.instructorProfile.count({
      where: {
        OR: [{ verificationStatus: "PENDING" }, { profileDraftStatus: "PENDING_REVIEW" }],
      },
    }),
    prisma.order.count({
      where: {
        status: "PENDING_INSTRUCTOR",
        flexibleInstructorInvite: false,
        pendingExpiresAt: { not: null },
      },
    }),
    prisma.order.count({
      where: {
        status: "PENDING_INSTRUCTOR",
        flexibleInstructorInvite: true,
      },
    }),
    prisma.order.count({
      where: { status: { in: ["ACCEPTED", "INSTRUCTOR_EN_ROUTE", "LESSON_STARTED"] } },
    }),
    prisma.order.count({ where: { status: "AWAITING_PAYMENT" } }),
    prisma.order.count({ where: { status: "DRAFT" } }),
    prisma.order.aggregate({
      where: {
        paymentStatus: "PAID",
        amountTotal: { not: null },
      },
      _sum: { amountTotal: true, instructorShareAmount: true },
      _count: { _all: true },
    }),
    prisma.order.count({
      where: { status: "COMPLETED", updatedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.order.groupBy({
      by: ["status"],
      orderBy: { status: "asc" },
      _count: { _all: true },
    }),
  ]);

  const recentOrdersBase = await prisma.order.findMany({
    take: 50,
    orderBy: { updatedAt: "desc" },
    select: orderOverviewSelect,
  });

  let mergedOrders = recentOrdersBase;
  let ordersForFocusUser = 0;

  let matchedUsers: Array<
    Prisma.UserGetPayload<{ select: typeof userMatchSelect }>
  > = [];

  let activityFilterSkippedNoMatches = false;

  if (hasFocus) {
    if (hasUserFocus && hasActivityFocus) {
      const activityIds = await findUserIdsByActivityQuery(activityQueryRaw);
      if (activityIds.length === 0) {
        activityFilterSkippedNoMatches = true;
        matchedUsers = await prisma.user.findMany({
          where: buildUserSearchWhere(focusQueryRaw),
          take: 40,
          select: userMatchSelect,
          orderBy: { updatedAt: "desc" },
        });
      } else {
        matchedUsers = await prisma.user.findMany({
          where: {
            AND: [buildUserSearchWhere(focusQueryRaw), { id: { in: activityIds } }],
          },
          take: 40,
          select: userMatchSelect,
          orderBy: { updatedAt: "desc" },
        });
      }
    } else if (hasUserFocus) {
      matchedUsers = await prisma.user.findMany({
        where: buildUserSearchWhere(focusQueryRaw),
        take: 40,
        select: userMatchSelect,
        orderBy: { updatedAt: "desc" },
      });
    } else if (hasActivityFocus) {
      const activityIds = await findUserIdsByActivityQuery(activityQueryRaw);
      matchedUsers =
        activityIds.length === 0
          ? []
          : await prisma.user.findMany({
              where: { id: { in: activityIds } },
              take: 40,
              select: userMatchSelect,
              orderBy: { updatedAt: "desc" },
            });
    }

    const focusUserIds = matchedUsers.map((u) => u.id);

    let focusOrders: typeof recentOrdersBase = [];
    if (focusUserIds.length > 0) {
      focusOrders = await prisma.order.findMany({
        where: {
          OR: [{ clientId: { in: focusUserIds } }, { instructorId: { in: focusUserIds } }],
        },
        orderBy: { updatedAt: "desc" },
        take: 120,
        select: orderOverviewSelect,
      });
    }
    ordersForFocusUser = focusOrders.length;
    const byId = new Map<string, (typeof recentOrdersBase)[number]>();
    for (const o of focusOrders) {
      byId.set(o.id, o);
    }
    for (const o of recentOrdersBase) {
      if (!byId.has(o.id)) byId.set(o.id, o);
    }
    mergedOrders = [...byId.values()]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 90);
  }

  const focusUserFound = matchedUsers.length > 0;

  const pending = await prisma.instructorProfile.findMany({
    where: {
      OR: [{ verificationStatus: "PENDING" }, { profileDraftStatus: "PENDING_REVIEW" }],
    },
    take: 40,
    orderBy: [{ profileDraftSubmittedAt: "desc" }, { updatedAt: "desc" }],
    include: { user: { select: { email: true, name: true, phone: true, nickname: true, middleName: true } } },
  });

  const recentUsersBase = await prisma.user.findMany({
    take: 24,
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  let recentUsers = recentUsersBase;
  if (hasFocus && matchedUsers.length > 0) {
    const um = new Map(recentUsers.map((u) => [u.id, u]));
    for (const u of matchedUsers) {
      um.set(u.id, u);
    }
    recentUsers = [...um.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 40);
  }

  const orderIdsForMessages = mergedOrders.map((o) => o.id);
  const focusUserIdsForMessages = matchedUsers.map((u) => u.id);

  let messageWhere: Prisma.MessageWhereInput | undefined;
  if (!hasFocus) {
    messageWhere = undefined;
  } else {
    const parts: Prisma.MessageWhereInput[] = [];
    if (focusUserIdsForMessages.length > 0) {
      parts.push({ senderId: { in: focusUserIdsForMessages } });
    }
    if (orderIdsForMessages.length > 0) {
      parts.push({ orderId: { in: orderIdsForMessages } });
    }
    messageWhere = parts.length > 0 ? { OR: parts } : { orderId: { in: [] } };
  }

  const recentMessages = await prisma.message.findMany({
    where: messageWhere,
    take: hasFocus ? 55 : 22,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      body: true,
      orderId: true,
      sender: { select: { name: true, email: true } },
    },
  });

  const recentOrders = mergedOrders;

  const grossRub = num(paidAggregate._sum.amountTotal);
  const instructorShareRub = num(paidAggregate._sum.instructorShareAmount);
  const platformRub = Math.max(0, grossRub - instructorShareRub);

  type ActivityItem = {
    id: string;
    at: string;
    category: "order" | "user" | "instructor" | "message";
    eventLabel: string;
    summary: string;
    meta: string | null;
  };

  const activityParts: ActivityItem[] = [];

  for (const o of recentOrders) {
    const createdMs = o.createdAt.getTime();
    const updatedMs = o.updatedAt.getTime();
    const isNewOrder = Math.abs(updatedMs - createdMs) < 1500;
    const clientBit = o.client.name ? `${o.client.name} · ${o.client.email}` : o.client.email;
    const instrBit = o.instructor
      ? o.instructor.name
        ? `${o.instructor.name}`
        : o.instructor.email
      : null;
    activityParts.push({
      id: `order:${o.id}`,
      at: o.updatedAt.toISOString(),
      category: "order",
      eventLabel: isNewOrder ? "Новый заказ" : "Изменение заказа",
      summary: `${orderStatusLabel(o.status)} · оплата ${o.paymentStatus}`,
      meta: instrBit ? `${clientBit} → ${instrBit}` : clientBit,
    });
  }

  for (const u of recentUsers) {
    activityParts.push({
      id: `user:${u.id}`,
      at: u.createdAt.toISOString(),
      category: "user",
      eventLabel: "Регистрация",
      summary: `Новый аккаунт · ${roleRu(u.role)}`,
      meta: u.name?.trim() ? `${u.name} · ${u.email}` : u.email,
    });
  }

  for (const p of pending) {
    activityParts.push({
      id: `instructor-pending:${p.userId}`,
      at: p.updatedAt.toISOString(),
      category: "instructor",
      eventLabel: "Модерация",
      summary: "Заявка инструктора в очереди",
      meta: `${p.user.email}${p.user.name ? ` · ${p.user.name}` : ""}`,
    });
  }

  for (const m of recentMessages) {
    const senderLabel = m.sender.name?.trim() ? m.sender.name : m.sender.email;
    const compact = m.body.replace(/\s+/g, " ").trim();
    const snippet =
      compact.length > 120 ? `${compact.slice(0, 120).trim()}…` : compact || "(пустое сообщение)";
    activityParts.push({
      id: `message:${m.id}`,
      at: m.createdAt.toISOString(),
      category: "message",
      eventLabel: "Чат по заказу",
      summary: snippet,
      meta: `${senderLabel} · заказ ${m.orderId.slice(0, 8)}…`,
    });
  }

  activityParts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const activityFeed = activityParts.slice(0, 48);

  const statusCounts = Object.fromEntries(
    ordersByStatus.map((row) => {
      const c = row._count;
      const n =
        c && typeof c === "object" && "_all" in c && typeof c._all === "number" ? c._all : 0;
      return [row.status, n];
    }),
  ) as Record<string, number>;

    const focusParticipant =
      participantIdRaw.length > 0
        ? await buildFocusParticipantInsights(participantIdRaw, thirtyDaysAgo)
        : null;

    return NextResponse.json(
      {
        context: {
          productName: PRODUCT_NAME,
          generatedAt: new Date().toISOString(),
        },
        focus: {
          query: hasUserFocus ? focusQueryRaw : null,
          activityQuery: hasActivityFocus ? activityQueryRaw : null,
          matches: matchedUsers.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            phone: u.phone,
            role: u.role,
            instructorSpecializations: u.instructorProfile?.specializations ?? null,
            instructorInn: u.instructorProfile?.inn ?? null,
          })),
          email: hasUserFocus ? focusQueryRaw : null,
          userFound: focusUserFound,
          activityFilterSkippedNoMatches,
          ordersAsClientOrInstructor: ordersForFocusUser,
        },
        activityFeed,
        ordersCount,
        usersCount,
        pendingInstructors,
        pendingList: pending.map((p) => {
          const moderationKind =
            p.verificationStatus === "APPROVED" && p.profileDraftStatus === "PENDING_REVIEW"
              ? ("PROFILE_UPDATE" as const)
              : ("NEW_ACCOUNT" as const);
          const draft = parseProfileDraft(p.profileDraft);
          const profileChanges =
            moderationKind === "PROFILE_UPDATE" && draft
              ? computeProfileDraftChanges(snapshotProfileToDraft(p, p.user.name), draft)
              : undefined;
          const legalName =
            [draft?.lastName, draft?.firstName, draft?.middleName ?? p.user.middleName]
              .map((s) => s?.trim())
              .filter(Boolean)
              .join(" ") || null;
          const nickname = (draft?.nickname ?? p.user.nickname)?.trim() || null;
          return {
            userId: p.userId,
            email: p.user.email,
            name: nickname || p.user.name,
            legalName,
            nickname,
            phone: p.user.phone,
            inn: p.inn,
            certificationLevel: p.certificationLevel,
            moderationKind,
            profileDraftSubmittedAt: p.profileDraftSubmittedAt?.toISOString() ?? null,
            ...(profileChanges?.length ? { profileChanges } : {}),
          };
        }),
        pipeline: {
          /** Онлайн-очередь: ожидание ответа с таймером 60 с */
          onlineQueuePending,
          /** Запись на дату: офлайн-приглашение, без таймера */
          flexiblePending,
          /** Урок в работе */
          inProgress,
          awaitingPayment,
          draftOrders,
          completedLast30d,
        },
        ordersByStatus: statusCounts,
        finance: {
          paidOrdersCount: paidAggregate._count?._all ?? 0,
          grossPaidRub: grossRub,
          instructorSharePaidRub: instructorShareRub,
          platformSharePaidRub: platformRub,
        },
        recentOrders: recentOrders.map(mapOrderOverviewRow),
        focusParticipant,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (e: unknown) {
    console.error("[admin/overview]", e);
    const msg = e instanceof Error ? e.message : "Internal error";
    const hint =
      /column|does not exist|Unknown column|P2022|P2010/i.test(msg)
        ? " Похоже, схема БД не совпадает с Prisma: перезапустите контейнер skiinstruct или выполните `npx prisma db push && npx prisma generate`."
        : "";
    return NextResponse.json(
      {
        error: "overview_failed",
        message: process.env.NODE_ENV === "development" ? `${msg}${hint}` : `Не удалось загрузить сводку.${hint}`,
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
