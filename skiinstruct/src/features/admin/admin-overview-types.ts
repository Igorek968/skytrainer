import type { OrderStatus, PaymentStatus, UserRole } from "@prisma/client";

/** Домен приложения SkiInstruct (заказы, пользователи, чаты — одна БД Prisma). */
export type AdminActivityCategory = "order" | "user" | "instructor" | "message";

export type AdminActivityItem = {
  id: string;
  at: string;
  category: AdminActivityCategory;
  /** Короткая подпись типа события в приложении */
  eventLabel: string;
  summary: string;
  meta: string | null;
};

/** Строка заказа в сводке админки (общая лента и превью выбранного участника). */
export type AdminOrderOverviewRow = {
  id: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  flexibleInstructorInvite: boolean;
  pendingExpiresAt: string | null;
  amountTotal: number | null;
  paymentStatus: PaymentStatus;
  clientName: string | null;
  clientEmail: string;
  instructorName: string | null;
};

/** Данные по одному пользователю для нижней панели (?participant=id). */
export type AdminParticipantInsights = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  };
  ordersTotal: number;
  ordersByStatus: Record<string, number>;
  pipeline: {
    awaitingPayment: number;
    pendingInstructor: number;
    inProgress: number;
    completedLast30d: number;
  };
  finance: {
    paidOrdersCount: number;
    grossPaidAsClientRub: number;
    instructorSharePaidRub: number;
  };
  activityPreview: AdminActivityItem[];
  ordersPreview: AdminOrderOverviewRow[];
};

export type AdminOverview = {
  /** Привязка сводки к продукту SkiInstruct */
  context: {
    productName: string;
    generatedAt: string;
  };
  /** Режим поиска (?user= или устаревший ?email=) */
  focus: {
    /** Строка запроса в админке */
    query: string | null;
    /** Совпадения в таблице User (имя, email); у инструкторов — специализации из профиля */
    matches: {
      id: string;
      email: string;
      name: string | null;
      role: UserRole;
      instructorSpecializations: string[] | null;
    }[];
    /** Фильтр по виду деятельности (?activity=): специализации, услуги, био, сертификация инструктора */
    activityQuery: string | null;
    /** @deprecated то же, что query — для старых клиентов */
    email: string | null;
    userFound: boolean;
    /** Заданы оба фильтра, но по виду деятельности инструкторов не нашлось — показан только поиск по пользователю */
    activityFilterSkippedNoMatches?: boolean;
    /** Заказы, где любой из найденных пользователей — клиент или инструктор */
    ordersAsClientOrInstructor: number;
  };
  activityFeed: AdminActivityItem[];
  ordersCount: number;
  usersCount: number;
  pendingInstructors: number;
  pendingList: {
    userId: string;
    email: string;
    name: string | null;
    certificationLevel: string | null;
    moderationKind: "NEW_ACCOUNT" | "PROFILE_UPDATE";
    profileDraftSubmittedAt: string | null;
    /** Только для PROFILE_UPDATE: что изменилось относительно опубликованной анкеты */
    profileChanges?: {
      field: string;
      label: string;
      kind: "added" | "removed" | "changed";
      before: string | null;
      after: string | null;
    }[];
  }[];
  pipeline: {
    onlineQueuePending: number;
    flexiblePending: number;
    inProgress: number;
    awaitingPayment: number;
    draftOrders: number;
    completedLast30d: number;
  };
  ordersByStatus: Record<string, number>;
  finance: {
    paidOrdersCount: number;
    grossPaidRub: number;
    instructorSharePaidRub: number;
    platformSharePaidRub: number;
  };
  recentOrders: AdminOrderOverviewRow[];
  /** Выбранный участник (двойной щелчок по строке поиска): узкая сводка по его заказам и чатам. */
  focusParticipant: AdminParticipantInsights | null;
};

export const adminMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);

export function adminOrderFlowLabel(o: AdminOrderOverviewRow): string {
  if (o.status !== "PENDING_INSTRUCTOR") return "—";
  if (o.flexibleInstructorInvite) return "Запись на дату";
  if (o.pendingExpiresAt) return "Онлайн-очередь (60 с)";
  return "Ожидание инструктора";
}

export function adminActivityCategoryLabel(c: AdminActivityCategory): string {
  switch (c) {
    case "order":
      return "Заказ";
    case "user":
      return "Аккаунт";
    case "instructor":
      return "Инструктор";
    case "message":
      return "Чат";
    default:
      return c;
  }
}
