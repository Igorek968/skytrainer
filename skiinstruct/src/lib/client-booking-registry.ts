import { renderClientOfferBodyHtml } from "@/lib/client-booking-offer-html";
import { escapeOfferHtml } from "@/lib/instructor-agency-offer-html";
import { LEGAL_ROUTES, legalOperatorName } from "@/lib/legal";
import { CLIENT_OFFER_VERSION, LEGAL_PLATFORM_URL } from "@/lib/legal-config";
import { LEGAL_AGENT } from "@/lib/legal-entity";
import { prisma } from "@/lib/prisma";

export type ClientBookingRegistryRow = {
  userId: string;
  name: string | null;
  email: string;
  phone: string | null;
  /** Акцепт оферты при регистрации (дата создания аккаунта). */
  offerAcceptedAt: string;
  offerVersion: string;
  paidOrders: number;
  completedOrders: number;
  paidEventRegistrations: number;
  hasPaidActivity: boolean;
};

function formatRuDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export async function fetchClientBookingRegistryRows(options?: {
  paidOnly?: boolean;
}): Promise<ClientBookingRegistryRow[]> {
  const clients = await prisma.user.findMany({
    where: { role: "CLIENT" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      createdAt: true,
    },
  });

  const userIds = clients.map((u) => u.id);
  if (userIds.length === 0) return [];

  const [paidCounts, completedCounts, paidEventCounts] = await Promise.all([
    prisma.order.groupBy({
      by: ["clientId"],
      where: { clientId: { in: userIds }, paymentStatus: "PAID" },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["clientId"],
      where: { clientId: { in: userIds }, status: "COMPLETED" },
      _count: { _all: true },
    }),
    prisma.eventRegistration.groupBy({
      by: ["clientId"],
      where: { clientId: { in: userIds }, paidAt: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const paidByUser = new Map(paidCounts.map((r) => [r.clientId, r._count._all]));
  const completedByUser = new Map(completedCounts.map((r) => [r.clientId, r._count._all]));
  const paidEventsByUser = new Map(paidEventCounts.map((r) => [r.clientId, r._count._all]));

  const rows: ClientBookingRegistryRow[] = clients.map((u) => {
    const paidOrders = paidByUser.get(u.id) ?? 0;
    const completedOrders = completedByUser.get(u.id) ?? 0;
    const paidEventRegistrations = paidEventsByUser.get(u.id) ?? 0;
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      offerAcceptedAt: u.createdAt.toISOString(),
      offerVersion: CLIENT_OFFER_VERSION,
      paidOrders,
      completedOrders,
      paidEventRegistrations,
      hasPaidActivity: paidOrders > 0 || paidEventRegistrations > 0,
    };
  });

  if (options?.paidOnly) {
    return rows.filter((r) => r.hasPaidActivity);
  }
  return rows;
}

export function clientBookingRegistryToCsv(rows: ClientBookingRegistryRow[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    "userId",
    "name",
    "email",
    "phone",
    "offerAcceptedAt",
    "offerVersion",
    "paidOrders",
    "completedOrders",
    "paidEventRegistrations",
    "hasPaidActivity",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.userId,
        r.name ?? "",
        r.email,
        r.phone ?? "",
        formatRuDate(r.offerAcceptedAt),
        r.offerVersion,
        r.paidOrders,
        r.completedOrders,
        r.paidEventRegistrations,
        r.hasPaidActivity ? "да" : "нет",
      ]
        .map((c) => escape(String(c)))
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export type ClientBookingCertificateData = {
  generatedAt: string;
  agentName: string;
  agentInn: string;
  offerUrl: string;
  offerVersion: string;
  client: ClientBookingRegistryRow;
};

export async function fetchClientBookingCertificateData(
  userId: string,
): Promise<ClientBookingCertificateData | null> {
  const rows = await fetchClientBookingRegistryRows();
  const client = rows.find((r) => r.userId === userId);
  if (!client) return null;

  return {
    generatedAt: new Date().toISOString(),
    agentName: legalOperatorName(),
    agentInn: LEGAL_AGENT.inn,
    offerUrl: `${LEGAL_PLATFORM_URL}${LEGAL_ROUTES.oferta}`,
    offerVersion: client.offerVersion || CLIENT_OFFER_VERSION,
    client,
  };
}

/**
 * Заполненный договор бронирования с клиентом:
 * реквизиты сторон + текст оферты + блок акцепта.
 */
export function renderClientBookingCertificateHtml(data: ClientBookingCertificateData): string {
  const c = data.client;
  const accepted = formatRuDate(c.offerAcceptedAt);
  const generated = formatRuDate(data.generatedAt);
  const offerVersion = c.offerVersion || data.offerVersion;
  const clientName = escapeOfferHtml(c.name ?? "—");
  const clientEmail = escapeOfferHtml(c.email);
  const clientPhone = escapeOfferHtml(c.phone ?? "—");
  const agentName = escapeOfferHtml(data.agentName);
  const agentInn = escapeOfferHtml(data.agentInn);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Договор бронирования услуг с клиентом — ${clientName}</title>
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
  <h1>ДОГОВОР БРОНИРОВАНИЯ УСЛУГ<br />(публичная оферта)<br />с клиентом</h1>
  <p class="meta">
    Версия оферты: ${escapeOfferHtml(offerVersion)} · Сформировано ${agentName} · ${escapeOfferHtml(generated)}
  </p>

  <p>
    Настоящий документ является полностью заполненным экземпляром договора бронирования услуг
    (публичной оферты) между Исполнителем (Агентом) и Клиентом. Текст договора приведён ниже
    целиком; ссылка на сайт не заменяет текст условий.
  </p>

  <h2>Стороны договора</h2>
  <table>
    <tr><th>Исполнитель (Агент)</th><td>${agentName}, ИНН ${agentInn}</td></tr>
    <tr><th>Клиент</th><td>${clientName}</td></tr>
    <tr><th>Email клиента</th><td>${clientEmail}</td></tr>
    <tr><th>Телефон</th><td>${clientPhone}</td></tr>
    <tr><th>Дата и время акцепта оферты</th><td>${escapeOfferHtml(accepted)}</td></tr>
    <tr><th>Версия оферты</th><td>${escapeOfferHtml(offerVersion)}</td></tr>
    <tr><th>Оплаченных заказов</th><td>${c.paidOrders}</td></tr>
    <tr><th>Завершённых занятий</th><td>${c.completedOrders}</td></tr>
    <tr><th>Оплаченных записей на события</th><td>${c.paidEventRegistrations}</td></tr>
  </table>

  <h2>Условия договора (текст публичной оферты)</h2>
  ${renderClientOfferBodyHtml()}

  <div class="sig">
    <h2>Акцепт и заключение договора</h2>
    <p>
      Договор заключён в электронной форме путём акцепта настоящей публичной оферты при регистрации
      Клиента на Платформе и/или при оплате бронирования (ст. 437, 438 ГК РФ). Отдельная бумажная
      подпись сторон не требуется. Факт акцепта зафиксирован в информационной системе платформы
      (дата регистрации учётной записи).
    </p>
    <div class="sig-grid">
      <div>
        <p><strong>Исполнитель (Агент):</strong></p>
        <p>${agentName}<br />ИНН ${agentInn}</p>
        <p class="muted">Оферта размещена и действует на Платформе</p>
      </div>
      <div>
        <p><strong>Клиент:</strong></p>
        <p>
          ${clientName}<br />
          Email: ${clientEmail}<br />
          Телефон: ${clientPhone}<br />
          Акцепт: ${escapeOfferHtml(accepted)} · версия ${escapeOfferHtml(offerVersion)}
        </p>
      </div>
    </div>
    <p class="muted" style="margin-top:1.25rem;">
      Документ сформирован автоматически на основании данных базы платформы и готов для предоставления
      платёжному партнёру (ЮKassa) как экземпляр договора с конкретным клиентом.
    </p>
  </div>
</body>
</html>`;
}
