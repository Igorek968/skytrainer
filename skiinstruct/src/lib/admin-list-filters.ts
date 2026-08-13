import type { OrderStatus } from "@prisma/client";

/** Группы статусов заказов для админки. */
export const ADMIN_ORDER_GROUPS = {
  all: null,
  in_progress: ["ACCEPTED", "INSTRUCTOR_EN_ROUTE", "LESSON_STARTED"] as OrderStatus[],
  pending: ["DRAFT", "AWAITING_PAYMENT", "PENDING_INSTRUCTOR"] as OrderStatus[],
  completed: ["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"] as OrderStatus[],
} as const;

export type AdminOrderGroup = keyof typeof ADMIN_ORDER_GROUPS;

export const ADMIN_ORDER_GROUP_LABELS: Record<Exclude<AdminOrderGroup, "all">, string> = {
  in_progress: "В работе",
  pending: "Ожидание",
  completed: "Завершённые",
};

export type AdminUserRoleFilter = "all" | "CLIENT" | "INSTRUCTOR" | "ADMIN" | "MODERATOR";

export const ADMIN_USER_ROLE_LABELS: Record<AdminUserRoleFilter, string> = {
  all: "Все роли",
  CLIENT: "Клиенты",
  INSTRUCTOR: "Инструкторы",
  ADMIN: "Администраторы",
  MODERATOR: "Модераторы",
};

export function parseAdminOrderGroup(raw: string | null | undefined): AdminOrderGroup {
  if (raw === "in_progress" || raw === "pending" || raw === "completed") return raw;
  return "all";
}

export function parseAdminUserRoleFilter(raw: string | null | undefined): AdminUserRoleFilter {
  if (raw === "CLIENT" || raw === "INSTRUCTOR" || raw === "ADMIN" || raw === "MODERATOR") return raw;
  return "all";
}

export function parseAdminOnlineFilter(raw: string | null | undefined): boolean {
  return raw === "1" || raw === "true";
}
