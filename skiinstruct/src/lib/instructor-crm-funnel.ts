/**
 * CRM-стадии инструкторов для админ-воронки.
 * Считаются из существующих полей (verification, compliance, online) — без нового enum в БД.
 */

export type InstructorCrmStage =
  | "moderation"
  | "docs_incomplete"
  | "docs_review"
  | "ready_offline"
  | "active_online"
  | "rejected"
  | "suspended";

export type InstructorCrmStageMeta = {
  id: InstructorCrmStage;
  label: string;
  shortLabel: string;
  /** Целевой SLA в часах; null = без таймера */
  slaHours: number | null;
  /** Действие для оператора */
  nextActionHint: string;
  order: number;
};

export const INSTRUCTOR_CRM_STAGES: InstructorCrmStageMeta[] = [
  {
    id: "moderation",
    label: "Модерация анкеты",
    shortLabel: "Модерация",
    slaHours: 24,
    nextActionHint: "Проверить и одобрить / отклонить",
    order: 1,
  },
  {
    id: "docs_incomplete",
    label: "Документы неполные",
    shortLabel: "Неполные доки",
    slaHours: 48,
    nextActionHint: "Связаться: догрузить паспорт / НПД / страховку / акцепт",
    order: 2,
  },
  {
    id: "docs_review",
    label: "Документы на проверке",
    shortLabel: "Проверка доков",
    slaHours: 48,
    nextActionHint: "Одобрить или отклонить загруженные файлы",
    order: 3,
  },
  {
    id: "ready_offline",
    label: "Готов · офлайн",
    shortLabel: "Готов",
    slaHours: null,
    nextActionHint: "Можно выходить на линию",
    order: 4,
  },
  {
    id: "active_online",
    label: "На линии",
    shortLabel: "Онлайн",
    slaHours: null,
    nextActionHint: "Принимает заявки",
    order: 5,
  },
  {
    id: "rejected",
    label: "Отклонён",
    shortLabel: "Отклонён",
    slaHours: null,
    nextActionHint: "При необходимости — повторная заявка",
    order: 6,
  },
  {
    id: "suspended",
    label: "Заблокирован",
    shortLabel: "Блок",
    slaHours: null,
    nextActionHint: "Разблокировать или оставить в архиве",
    order: 7,
  },
];

export function instructorCrmStageMeta(id: InstructorCrmStage): InstructorCrmStageMeta {
  return INSTRUCTOR_CRM_STAGES.find((s) => s.id === id) ?? INSTRUCTOR_CRM_STAGES[0]!;
}

export type AssignInstructorCrmStageInput = {
  suspendedAt: Date | string | null | undefined;
  verificationStatus: string;
  profileDraftStatus: string | null | undefined;
  canAcceptPaidOrders: boolean;
  pendingDocCount: number;
  isOnline: boolean;
};

/** Одна основная стадия на инструктора (приоритет сверху вниз). */
export function assignInstructorCrmStage(input: AssignInstructorCrmStageInput): InstructorCrmStage {
  if (input.suspendedAt) return "suspended";
  if (input.verificationStatus === "REJECTED") return "rejected";
  if (
    input.verificationStatus === "PENDING" ||
    input.profileDraftStatus === "PENDING_REVIEW"
  ) {
    return "moderation";
  }
  if (input.pendingDocCount > 0) return "docs_review";
  if (!input.canAcceptPaidOrders) return "docs_incomplete";
  if (input.isOnline) return "active_online";
  return "ready_offline";
}

export function hoursSince(isoOrDate: Date | string, now = new Date()): number {
  const t = typeof isoOrDate === "string" ? new Date(isoOrDate).getTime() : isoOrDate.getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now.getTime() - t) / (1000 * 60 * 60));
}

export function isCrmStageOverdue(
  stage: InstructorCrmStage,
  waitingHours: number,
): boolean {
  const sla = instructorCrmStageMeta(stage).slaHours;
  if (sla == null) return false;
  return waitingHours >= sla;
}

export function formatWaitingLabel(hours: number): string {
  if (hours < 1) return "<1 ч";
  if (hours < 24) return `${Math.floor(hours)} ч`;
  const days = Math.floor(hours / 24);
  const rem = Math.floor(hours % 24);
  return rem > 0 ? `${days} д ${rem} ч` : `${days} д`;
}

export function nextActionForInstructorCard(input: {
  stage: InstructorCrmStage;
  anketaComplete: boolean;
  agencyOfferAccepted: boolean;
  taxDocumentApproved: boolean;
  insuranceApproved: boolean;
  passportApproved: boolean;
  requiresPassport: boolean;
  pendingDocCount: number;
  payoutPending: boolean;
  yookassaNeedsOps: boolean;
}): string {
  const base = instructorCrmStageMeta(input.stage).nextActionHint;
  const extras: string[] = [];
  if (input.stage === "moderation" && !input.anketaComplete) {
    extras.push("анкета неполная");
  }
  if (input.stage === "docs_incomplete") {
    if (!input.agencyOfferAccepted) extras.push("нет акцепта договора");
    if (!input.taxDocumentApproved) extras.push("нет НПД/ЕГРИП");
    if (!input.insuranceApproved) extras.push("нет страховки");
    if (input.requiresPassport && !input.passportApproved) extras.push("нет паспорта");
  }
  if (input.pendingDocCount > 0 && input.stage === "docs_review") {
    extras.push(`${input.pendingDocCount} файл(ов)`);
  }
  if (input.payoutPending) extras.push("заявка на выплату");
  if (input.yookassaNeedsOps) extras.push("договор → ЮKassa");
  return extras.length ? `${base} · ${extras.join(", ")}` : base;
}
