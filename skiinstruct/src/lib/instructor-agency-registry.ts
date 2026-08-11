import type { InstructorTaxStatus, InstructorVerificationStatus } from "@prisma/client";

import { LEGAL_ROUTES, legalOperatorName } from "@/lib/legal";
import { AGENCY_OFFER_VERSION, LEGAL_PLATFORM_URL } from "@/lib/legal-config";
import { LEGAL_AGENT } from "@/lib/legal-entity";
import { computeComplianceFlags } from "@/lib/instructor-compliance";
import {
  escapeOfferHtml,
  renderInstructorAgencyOfferBodyHtml,
} from "@/lib/instructor-agency-offer-html";
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
  passportApproved: boolean;
  canAcceptPaidOrders: boolean;
  completedLessons: number;
  paidOrders: number;
  /** Одобрен, документы в порядке и сейчас на линии. */
  activeOnPlatform: boolean;
  /** Заполненный договор ушёл на почту ops. */
  yookassaContractNotifiedAt: string | null;
  /** Админ отметил передачу в поддержку ЮKassa. */
  yookassaContractMarkedSentAt: string | null;
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
          passportSeries: true,
          passportNumber: true,
          yookassaContractNotifiedAt: true,
          yookassaContractMarkedSentAt: true,
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
      requiresPassportApproval: Boolean(p.passportSeries && p.passportNumber),
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
      passportApproved: flags.passportApproved,
      canAcceptPaidOrders: flags.canAcceptPaidOrders,
      completedLessons: completedByUser.get(u.id) ?? 0,
      paidOrders: paidByUser.get(u.id) ?? 0,
      activeOnPlatform:
        p.verificationStatus === "APPROVED" && flags.canAcceptPaidOrders && p.isOnline,
      yookassaContractNotifiedAt: p.yookassaContractNotifiedAt?.toISOString() ?? null,
      yookassaContractMarkedSentAt: p.yookassaContractMarkedSentAt?.toISOString() ?? null,
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
    "Паспорт одобрен",
    "Может принимать оплаченные",
    "Онлайн",
    "Активен на платформе",
    "Завершённых занятий",
    "Оплаченных заказов",
    "Договор на почту ops",
    "Передано в ЮKassa",
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
        yesNo(r.passportApproved),
        yesNo(r.canAcceptPaidOrders),
        yesNo(r.isOnline),
        yesNo(r.activeOnPlatform),
        String(r.completedLessons),
        String(r.paidOrders),
        formatRuDate(r.yookassaContractNotifiedAt),
        formatRuDate(r.yookassaContractMarkedSentAt),
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

/**
 * Полностью заполненный агентский договор с инструктором:
 * реквизиты сторон + полный текст оферты (не ссылка) + блок акцепта.
 * Нужен для выгрузки в ЮKassa как готовый договор для подписания.
 */
export function renderAgencyCertificateHtml(data: AgencyCertificateData): string {
  const i = data.instructor;
  const accepted = formatRuDate(i.agencyOfferAcceptedAt);
  const generated = formatRuDate(data.generatedAt);
  const offerVersion = i.agencyOfferVersion ?? data.offerVersion;
  const instructorName = escapeOfferHtml(i.name ?? "—");
  const instructorEmail = escapeOfferHtml(i.email);
  const instructorInn = escapeOfferHtml(i.inn ?? "—");
  const taxLabel = escapeOfferHtml(taxStatusLabel(i.taxStatus));
  const agentName = escapeOfferHtml(data.agentName);
  const agentInn = escapeOfferHtml(data.agentInn);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Агентский договор с инструктором — ${instructorName}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; max-width: 780px; margin: 2rem auto; padding: 0 1rem 3rem; color: #111; line-height: 1.5; font-size: 11pt; }
    h1 { font-size: 1.3rem; margin: 0 0 0.35rem; text-align: center; }
    h2 { font-size: 1.05rem; margin: 1.35rem 0 0.5rem; }
    .meta { text-align: center; color: #444; font-size: 0.9rem; margin-bottom: 1.25rem; }
    .muted { color: #444; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0 1.25rem; font-size: 0.95rem; }
    th, td { border: 1px solid #ccc; padding: 0.45rem 0.6rem; text-align: left; vertical-align: top; }
    th { width: 40%; background: #f7f7f7; font-weight: 600; }
    p, li { margin: 0.45rem 0; }
    ul { margin: 0.35rem 0 0.75rem 1.25rem; padding: 0; }
    .sig { margin-top: 1.75rem; border-top: 1px solid #ccc; padding-top: 1rem; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1rem; }
    @media print {
      body { margin: 0; padding: 0.5rem; }
      a { color: #000; text-decoration: none; }
    }
    @media (max-width: 640px) { .sig-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>АГЕНТСКИЙ ДОГОВОР<br />(публичная оферта)<br />с инструктором</h1>
  <p class="meta">
    Версия оферты: ${escapeOfferHtml(offerVersion)} · Сформировано ${agentName} · ${escapeOfferHtml(generated)}
  </p>

  <p>
    Настоящий документ является полностью заполненным экземпляром агентского договора
    (публичной оферты) между Агентом и Инструктором (Принципалом). Текст договора приведён ниже
    целиком; ссылка на сайт не заменяет текст условий.
  </p>

  <h2>Стороны договора</h2>
  <table>
    <tr><th>Агент (оператор платформы)</th><td>${agentName}, ИНН ${agentInn}</td></tr>
    <tr><th>Инструктор (принципал)</th><td>${instructorName}</td></tr>
    <tr><th>Email инструктора</th><td>${instructorEmail}</td></tr>
    <tr><th>ИНН инструктора</th><td>${instructorInn}</td></tr>
    <tr><th>Налоговый статус</th><td>${taxLabel}</td></tr>
    <tr><th>Дата и время акцепта оферты</th><td>${escapeOfferHtml(accepted)}</td></tr>
    <tr><th>Версия оферты при акцепте</th><td>${escapeOfferHtml(offerVersion)}</td></tr>
    <tr><th>Статус анкеты на платформе</th><td>${escapeOfferHtml(i.verificationStatus)}</td></tr>
    <tr><th>Документ НПД/ИП</th><td>${yesNo(i.taxDocumentApproved)}</td></tr>
    <tr><th>Страхование</th><td>${yesNo(i.insuranceApproved)}</td></tr>
    <tr><th>Паспорт</th><td>${yesNo(i.passportApproved)}</td></tr>
    <tr><th>Допуск к оплаченным заявкам</th><td>${yesNo(i.canAcceptPaidOrders)}</td></tr>
  </table>

  <h2>Условия договора (текст публичной оферты)</h2>
  ${renderInstructorAgencyOfferBodyHtml()}

  <div class="sig">
    <h2>Акцепт и заключение договора</h2>
    <p>
      Договор заключён в электронной форме путём акцепта настоящей публичной оферты при регистрации
      Инструктора на Платформе (ст. 437, 438 ГК РФ). Отдельная бумажная подпись сторон не требуется.
      Факт акцепта зафиксирован в информационной системе платформы.
    </p>
    <div class="sig-grid">
      <div>
        <p><strong>Агент (Исполнитель):</strong></p>
        <p>${agentName}<br />ИНН ${agentInn}</p>
        <p class="muted">Оферта размещена и действует на Платформе</p>
      </div>
      <div>
        <p><strong>Принципал (Инструктор):</strong></p>
        <p>
          ${instructorName}<br />
          ИНН ${instructorInn}<br />
          Email: ${instructorEmail}<br />
          Налоговый статус: ${taxLabel}<br />
          Акцепт: ${escapeOfferHtml(accepted)} · версия ${escapeOfferHtml(offerVersion)}
        </p>
      </div>
    </div>
    <p class="muted" style="margin-top:1.25rem;">
      Документ сформирован автоматически на основании данных базы платформы и готов для предоставления
      платёжному партнёру (ЮKassa) как экземпляр договора с конкретным инструктором.
    </p>
  </div>
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
  birthDate: string | null;
  passportSeries: string | null;
  passportNumber: string | null;
  passportDepartmentCode: string | null;
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
          birthDate: true,
          instructorProfile: {
            select: {
              inn: true,
              taxStatus: true,
              agencyOfferAcceptedAt: true,
              passportSeries: true,
              passportNumber: true,
              passportDepartmentCode: true,
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
    birthDate: d.user.birthDate?.toISOString().slice(0, 10) ?? null,
    passportSeries: d.user.instructorProfile?.passportSeries ?? null,
    passportNumber: d.user.instructorProfile?.passportNumber ?? null,
    passportDepartmentCode: d.user.instructorProfile?.passportDepartmentCode ?? null,
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
    case "PASSPORT":
      return "Паспорт (стр. 2–3)";
    default:
      return type;
  }
}
