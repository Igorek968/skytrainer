import type { InstructorTaxStatus, InstructorVerificationStatus } from "@prisma/client";

import { LEGAL_ROUTES, legalOperatorName } from "@/lib/legal";
import { AGENCY_OFFER_VERSION, LEGAL_PLATFORM_URL } from "@/lib/legal-config";
import { LEGAL_AGENT } from "@/lib/legal-entity";
import { computeComplianceFlags } from "@/lib/instructor-compliance";
import { prisma } from "@/lib/prisma";

export type AgencyRegistryRow = {
  userId: string;
  name: string | null;
  email: string;
  inn: string | null;
  taxStatus: InstructorTaxStatus | null;
  agencyOfferAcceptedAt: string | null;
  agencyOfferVersion: string | null;
  verificationStatus: InstructorVerificationStatus;
  isOnline: boolean;
  taxDocumentApproved: boolean;
  insuranceApproved: boolean;
  canAcceptPaidOrders: boolean;
  completedLessons: number;
  paidOrders: number;
  /** Одобрен, документы в порядке и сейчас на линии. */
  activeOnPlatform: boolean;
};

function taxStatusLabel(status: InstructorTaxStatus | null): string {
  if (status === "IP") return "ИП";
  if (status === "SELF_EMPLOYED") return "НПД";
  return "—";
}

function yesNo(value: boolean): string {
  return value ? "да" : "нет";
}

function formatRuDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export async function fetchAgencyRegistryRows(options?: {
  activeOnly?: boolean;
}): Promise<AgencyRegistryRow[]> {
  const instructors = await prisma.user.findMany({
    where: { role: "INSTRUCTOR" },
    orderBy: [{ instructorProfile: { agencyOfferAcceptedAt: "desc" } }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      name: true,
      instructorProfile: {
        select: {
          inn: true,
          taxStatus: true,
          agencyOfferAcceptedAt: true,
          agencyOfferVersion: true,
          verificationStatus: true,
          isOnline: true,
        },
      },
    },
  });

  const userIds = instructors.map((u) => u.id);
  const [docs, completedCounts, paidCounts] = await Promise.all([
    prisma.instructorComplianceDocument.findMany({
      where: { userId: { in: userIds }, status: "APPROVED" },
      select: { userId: true, type: true },
    }),
    prisma.order.groupBy({
      by: ["instructorId"],
      where: { instructorId: { in: userIds }, status: "COMPLETED" },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["instructorId"],
      where: { instructorId: { in: userIds }, paymentStatus: "PAID" },
      _count: { _all: true },
    }),
  ]);

  const docsByUser = new Map<string, Set<string>>();
  for (const d of docs) {
    const set = docsByUser.get(d.userId) ?? new Set<string>();
    set.add(d.type);
    docsByUser.set(d.userId, set);
  }
  const completedByUser = new Map(completedCounts.map((r) => [r.instructorId!, r._count._all]));
  const paidByUser = new Map(paidCounts.map((r) => [r.instructorId!, r._count._all]));

  const rows: AgencyRegistryRow[] = [];
  for (const u of instructors) {
    const p = u.instructorProfile;
    if (!p) continue;

    const flags = computeComplianceFlags({
      agencyOfferAcceptedAt: p.agencyOfferAcceptedAt,
      taxStatus: p.taxStatus,
      approvedDocTypes: docsByUser.get(u.id) ?? new Set(),
    });

    const row: AgencyRegistryRow = {
      userId: u.id,
      name: u.name,
      email: u.email,
      inn: p.inn,
      taxStatus: p.taxStatus,
      agencyOfferAcceptedAt: p.agencyOfferAcceptedAt?.toISOString() ?? null,
      agencyOfferVersion: p.agencyOfferVersion,
      verificationStatus: p.verificationStatus,
      isOnline: p.isOnline,
      taxDocumentApproved: flags.taxDocumentApproved,
      insuranceApproved: flags.insuranceApproved,
      canAcceptPaidOrders: flags.canAcceptPaidOrders,
      completedLessons: completedByUser.get(u.id) ?? 0,
      paidOrders: paidByUser.get(u.id) ?? 0,
      activeOnPlatform:
        p.verificationStatus === "APPROVED" && flags.canAcceptPaidOrders && p.isOnline,
    };

    if (options?.activeOnly && !row.canAcceptPaidOrders) continue;
    rows.push(row);
  }

  return rows;
}

export function agencyRegistryToCsv(rows: AgencyRegistryRow[]): string {
  const header = [
    "userId",
    "ФИО",
    "Email",
    "ИНН",
    "Статус налога",
    "Дата акцепта агентской оферты",
    "Версия оферты",
    "Статус анкеты",
    "НПД/ИП одобрен",
    "Страхование одобрено",
    "Может принимать оплаченные",
    "Онлайн",
    "Активен на платформе",
    "Завершённых занятий",
    "Оплаченных заказов",
  ];

  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.userId,
        r.name ?? "",
        r.email,
        r.inn ?? "",
        taxStatusLabel(r.taxStatus),
        formatRuDate(r.agencyOfferAcceptedAt),
        r.agencyOfferVersion ?? "",
        r.verificationStatus,
        yesNo(r.taxDocumentApproved),
        yesNo(r.insuranceApproved),
        yesNo(r.canAcceptPaidOrders),
        yesNo(r.isOnline),
        yesNo(r.activeOnPlatform),
        String(r.completedLessons),
        String(r.paidOrders),
      ]
        .map((c) => escape(String(c)))
        .join(","),
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

export type AgencyCertificateData = {
  generatedAt: string;
  agentName: string;
  agentInn: string;
  offerUrl: string;
  offerVersion: string;
  instructor: AgencyRegistryRow;
};

export async function fetchAgencyCertificateData(userId: string): Promise<AgencyCertificateData | null> {
  const rows = await fetchAgencyRegistryRows();
  const instructor = rows.find((r) => r.userId === userId);
  if (!instructor) return null;

  return {
    generatedAt: new Date().toISOString(),
    agentName: legalOperatorName(),
    agentInn: LEGAL_AGENT.inn,
    offerUrl: `${LEGAL_PLATFORM_URL}${LEGAL_ROUTES.ofertaInstructor}`,
    offerVersion: instructor.agencyOfferVersion ?? AGENCY_OFFER_VERSION,
    instructor,
  };
}

export function renderAgencyCertificateHtml(data: AgencyCertificateData): string {
  const i = data.instructor;
  const accepted = formatRuDate(i.agencyOfferAcceptedAt);
  const generated = formatRuDate(data.generatedAt);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Справка об акцепте агентского договора — ${i.name ?? i.email}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #111; line-height: 1.5; }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .muted { color: #444; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; margin: 1.25rem 0; font-size: 0.95rem; }
    th, td { border: 1px solid #ccc; padding: 0.5rem 0.65rem; text-align: left; vertical-align: top; }
    th { width: 42%; background: #f7f7f7; font-weight: 600; }
    p { margin: 0.75rem 0; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Справка об акцепте агентского договора (оферты)</h1>
  <p class="muted">Сформировано платформой ${data.agentName} · ${generated}</p>

  <p>
    Настоящая справка подтверждает, что инструктор, указанный ниже, акцептовал публичную оферту
    агентского договора, размещённую по адресу <a href="${data.offerUrl}">${data.offerUrl}</a>
    (версия ${data.offerVersion}), и прошёл проверку документов в информационной системе платформы.
  </p>

  <table>
    <tr><th>Агент (оператор платформы)</th><td>${data.agentName}, ИНН ${data.agentInn}</td></tr>
    <tr><th>Инструктор (принципал)</th><td>${i.name ?? "—"}</td></tr>
    <tr><th>Email</th><td>${i.email}</td></tr>
    <tr><th>ИНН инструктора</th><td>${i.inn ?? "—"}</td></tr>
    <tr><th>Налоговый статус</th><td>${taxStatusLabel(i.taxStatus)}</td></tr>
    <tr><th>Дата и время акцепта оферты</th><td>${accepted}</td></tr>
    <tr><th>Версия оферты</th><td>${i.agencyOfferVersion ?? data.offerVersion}</td></tr>
    <tr><th>Статус анкеты</th><td>${i.verificationStatus}</td></tr>
    <tr><th>Документ НПД/ИП</th><td>${yesNo(i.taxDocumentApproved)}</td></tr>
    <tr><th>Страхование</th><td>${yesNo(i.insuranceApproved)}</td></tr>
    <tr><th>Допуск к оплаченным заявкам</th><td>${yesNo(i.canAcceptPaidOrders)}</td></tr>
    <tr><th>Завершённых занятий</th><td>${i.completedLessons}</td></tr>
    <tr><th>Оплаченных заказов</th><td>${i.paidOrders}</td></tr>
  </table>

  <p class="muted">
    Акцепт оферты зафиксирован электронно при регистрации или в личном кабинете инструктора.
    Документ сформирован автоматически на основании данных базы платформы и не требует подписи инструктора на бумаге
    при использовании модели публичной оферты (ст. 437–438 ГК РФ).
  </p>
</body>
</html>`;
}

export type PendingComplianceItem = {
  documentId: string;
  userId: string;
  name: string | null;
  email: string;
  type: string;
  fileUrl: string;
  createdAt: string;
  inn: string | null;
  taxStatus: InstructorTaxStatus | null;
  agencyOfferAcceptedAt: string | null;
};

export async function fetchPendingComplianceDocuments(): Promise<PendingComplianceItem[]> {
  const docs = await prisma.instructorComplianceDocument.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          email: true,
          name: true,
          instructorProfile: {
            select: {
              inn: true,
              taxStatus: true,
              agencyOfferAcceptedAt: true,
            },
          },
        },
      },
    },
  });

  return docs.map((d) => ({
    documentId: d.id,
    userId: d.userId,
    name: d.user.name,
    email: d.user.email,
    type: d.type,
    fileUrl: d.fileUrl,
    createdAt: d.createdAt.toISOString(),
    inn: d.user.instructorProfile?.inn ?? null,
    taxStatus: d.user.instructorProfile?.taxStatus ?? null,
    agencyOfferAcceptedAt: d.user.instructorProfile?.agencyOfferAcceptedAt?.toISOString() ?? null,
  }));
}

export function complianceDocTypeLabel(type: string): string {
  switch (type) {
    case "TAX_STATUS_NPD":
      return "Справка НПД / «Мой налог»";
    case "TAX_STATUS_IP":
      return "Выписка ИП";
    case "INSURANCE":
      return "Страхование ответственности";
    default:
      return type;
  }
}
