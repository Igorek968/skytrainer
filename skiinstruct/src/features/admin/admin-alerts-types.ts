export type AdminAlertCategory =
  | "MODERATION"
  | "MESSAGES"
  | "COMPLIANCE"
  | "FINANCE"
  | "ORDERS"
  | "CATALOG"
  | "USERS";

export type AdminNavBadgeKey =
  | "moderation"
  | "messages"
  | "finance"
  | "compliance"
  | "orders"
  | "catalog"
  | "users";

export type AdminAlertQueueCounts = Record<AdminNavBadgeKey, number> & {
  unreadAlerts: number;
};

export type AdminAlertDTO = {
  id: string;
  category: AdminAlertCategory;
  title: string;
  body: string;
  href: string;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
};

const CATEGORY_LABEL: Record<AdminAlertCategory, string> = {
  MODERATION: "Модерация",
  MESSAGES: "Сообщения",
  COMPLIANCE: "ЮKassa / договор",
  FINANCE: "Финансы",
  ORDERS: "Заказы",
  CATALOG: "Каталог",
  USERS: "Пользователи",
};

export function adminAlertCategoryLabel(c: AdminAlertCategory): string {
  return CATEGORY_LABEL[c] ?? c;
}

/** Какой бейдж меню соответствует пункту nav. */
export function adminNavBadgeForHref(href: string): AdminNavBadgeKey | null {
  if (href.startsWith("/admin/instructors")) return "moderation";
  if (href.startsWith("/admin/moderation")) return "moderation";
  if (href.startsWith("/admin/messages")) return "messages";
  if (href.startsWith("/admin/finance")) return "finance";
  if (href.startsWith("/admin/compliance")) return "compliance";
  if (href.startsWith("/admin/orders") || href.startsWith("/admin/pipeline")) return "orders";
  if (href.startsWith("/admin/event-catalog")) return "catalog";
  if (href.startsWith("/admin/users")) return "users";
  return null;
}
