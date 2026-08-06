import { renderClientOfferBodyHtml } from "@/lib/client-booking-offer-html";
import {
  clientBookingRegistryToCsv,
  fetchClientBookingCertificateData,
  fetchClientBookingRegistryRows,
  renderClientBookingCertificateHtml,
} from "@/lib/client-booking-registry";
import {
  agencyRegistryToCsv,
  fetchAgencyCertificateData,
  fetchAgencyRegistryRows,
  renderAgencyCertificateHtml,
  type AgencyRegistryRow,
} from "@/lib/instructor-agency-registry";
import {
  escapeOfferHtml,
  renderInstructorAgencyOfferBodyHtml,
} from "@/lib/instructor-agency-offer-html";
import { legalOperatorName } from "@/lib/legal";
import {
  AGENCY_OFFER_VERSION,
  formatLegalEditionDate,
  LEGAL_PLATFORM_URL,
  PLATFORM_FEE_PERCENT,
} from "@/lib/legal-config";
import { LEGAL_AGENT, LEGAL_SITE_URL, legalRegisteredAddress } from "@/lib/legal-entity";

const escapeHtml = escapeOfferHtml;

function formatRuDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function taxStatusLabel(status: AgencyRegistryRow["taxStatus"]): string {
  if (status === "IP") return "ИП";
  if (status === "SELF_EMPLOYED") return "НПД";
  return "—";
}

function yesNo(value: boolean): string {
  return value ? "да" : "нет";
}

export function yookassaPrintStyles(): string {
  return `
    body { font-family: Georgia, "Times New Roman", serif; max-width: 800px; margin: 0 auto; padding: 1.5rem 1.25rem; color: #111; line-height: 1.55; font-size: 11pt; }
    h1 { font-size: 1.35rem; margin: 0 0 0.5rem; }
    h2 { font-size: 1.05rem; margin: 1.25rem 0 0.5rem; }
    h3 { font-size: 0.95rem; margin: 1rem 0 0.35rem; }
    p, li { margin: 0.45rem 0; }
    ul { margin: 0.35rem 0 0.75rem 1.25rem; padding: 0; }
    .muted { color: #444; font-size: 0.9rem; }
    .toc { border: 1px solid #ccc; padding: 0.75rem 1rem; margin: 1rem 0; background: #fafafa; }
    .toc ol { margin: 0.35rem 0 0 1.25rem; }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 9pt; }
    th, td { border: 1px solid #bbb; padding: 0.35rem 0.45rem; text-align: left; vertical-align: top; }
    th { background: #f2f2f2; font-weight: 600; }
    a { color: #111; }
    .page-break { page-break-before: always; break-before: page; margin-top: 2rem; padding-top: 0.5rem; }
    @media print {
      body { margin: 0; padding: 0.75rem; }
      .no-print { display: none; }
      .page-break { page-break-before: always; }
    }
  `;
}

function wrapHtmlDocument(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${yookassaPrintStyles()}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function renderYookassaCoverLetterHtml(generatedAt: string): string {
  const agent = LEGAL_AGENT;
  const site = LEGAL_SITE_URL;
  const date = formatRuDate(generatedAt);

  const body = `
  <h1>Сопроводительное письмо в ЮKassa</h1>
  <p class="muted">Дата формирования пакета: ${escapeHtml(date)}</p>

  <p>Уважаемые коллеги!</p>

  <p>
    Направляем пакет документов по запросу о сотрудничестве при оказании услуг, размещённых на сайте
    <strong>${escapeHtml(site)}</strong>.
  </p>

  <h2>1. Оператор платформы (получатель платежей)</h2>
  <p>
    <strong>${escapeHtml(agent.fullName)}</strong><br />
    ИНН ${escapeHtml(agent.inn)}, КПП ${escapeHtml(agent.kpp)}, ОГРН ${escapeHtml(agent.ogrn)}<br />
    Сайт: ${escapeHtml(site)}
  </p>

  <h2>2. Услуги на сайте</h2>
  <p>
    На платформе размещены услуги инструкторов и тренеров по видам спорта из каталога Сайта: индивидуальные занятия
    и мероприятия (мастер-классы, групповые тренировки).
  </p>

  <h2>3. Исполнители услуг</h2>
  <p>
    Непосредственные услуги клиентам оказывают <strong>независимые инструкторы</strong> — физические лица,
    зарегистрированные как самозанятые (налог на профессиональный доход, НПД) или индивидуальные предприниматели.
    ${escapeHtml(agent.shortName)} услуги обучения клиентам <strong>не оказывает</strong>.
  </p>

  <h2>4. Правовая модель</h2>
  <p>
    ${escapeHtml(agent.shortName)} выступает <strong>Агентом</strong>: предоставляет IT-платформу, привлекает клиентов,
    организует бронирование, принимает оплату через ЮKassa, удерживает агентское вознаграждение
    (<strong>${PLATFORM_FEE_PERCENT}%</strong>) и перечисляет остаток инструктору после оказания услуги.
  </p>
  <p>
    Сотрудничество с инструкторами оформлено <strong>агентским договором в форме публичной оферты</strong>
    (ст. 437–438 ГК РФ). В пакете приложены: полный текст оферты и <strong>полностью заполненные
    экземпляры договора</strong> по каждому инструктору (реквизиты сторон + текст условий + дата акцепта) —
    готовые для подписания / подтверждения сотрудничества с исполнителем.
  </p>
  <p>
    Для клиентов действует договор бронирования услуг (публичная оферта) с агентской моделью расчётов.
    В пакете — полный текст оферты, реестр клиентов и <strong>заполненные экземпляры договора</strong>
    с клиентами (реквизиты сторон + текст условий + дата акцепта). Чек на обучение выставляет Инструктор (НПД/ИП).
  </p>

  <h2>5. Состав пакета</h2>
  <ol>
    <li>Агентский договор (полный текст публичной оферты для инструкторов)</li>
    <li>Договор бронирования услуг (оферта для клиентов)</li>
    <li>Реквизиты Агента (ООО)</li>
    <li>Реестр инструкторов, акцептовавших агентскую оферту</li>
    <li>Реестр клиентов, акцептовавших договор бронирования</li>
    <li>Заполненные агентские договоры по каждому инструктору</li>
    <li>Заполненные договоры бронирования по клиентам</li>
  </ol>

  <p>Готовы предоставить дополнительные материалы по запросу.</p>

  <p>
    Контакты: ${escapeHtml(agent.email)}
  </p>
  `;

  return wrapHtmlDocument("Сопроводительное письмо — ЮKassa", body);
}

export function renderRequisitesHtml(): string {
  const agent = LEGAL_AGENT;
  const address = legalRegisteredAddress();

  const body = `
  <h1>Реквизиты Исполнителя (оператора сервиса)</h1>
  <p class="muted">Реквизиты для оплаты и договорных отношений на ${escapeHtml(LEGAL_SITE_URL)}</p>
  <p><strong>${escapeHtml(agent.fullName)}</strong></p>
  <p>ИНН ${escapeHtml(agent.inn)}<br />КПП ${escapeHtml(agent.kpp)}<br />ОГРН ${escapeHtml(agent.ogrn)}</p>
  <p>
    Расчётный счёт: <strong>${escapeHtml(agent.bankAccount)}</strong><br />
    Банк: ${escapeHtml(agent.bankName)}<br />
    БИК ${escapeHtml(agent.bik)}<br />
    Корр. счёт: ${escapeHtml(agent.corrAccount)}
  </p>
  <p>Юридический адрес: ${escapeHtml(address)}</p>
  <p>Email: ${escapeHtml(agent.email)}</p>
  `;

  return wrapHtmlDocument("Реквизиты Исполнителя", body);
}

export function renderClientOfferHtml(): string {
  const body = `
  <h1>Договор бронирования услуг (публичная оферта)</h1>
  ${renderClientOfferBodyHtml()}
  `;
  return wrapHtmlDocument("Договор бронирования услуг (оферта) для клиентов", body);
}

export function renderInstructorAgencyOfferHtml(): string {
  const body = `
  <h1>Агентский договор (публичная оферта) для инструктора</h1>
  <p class="muted">
    Версия ${escapeHtml(AGENCY_OFFER_VERSION)} · Редакция от ${escapeHtml(formatLegalEditionDate())}
  </p>
  <p>
    Ниже приведён полный текст публичной оферты. Заполненные экземпляры договора с конкретными инструкторами
    (реквизиты сторон + тот же текст условий + дата акцепта) — в разделе «Договоры с инструкторами».
  </p>
  ${renderInstructorAgencyOfferBodyHtml()}
  <div class="sig" style="margin-top:1.5rem;border-top:1px solid #ccc;padding-top:1rem;">
    <p><strong>Порядок заключения договора</strong></p>
    <p>
      Договор заключается в электронной форме путём акцепта настоящей публичной оферты при регистрации
      Инструктора на Платформе (ст. 437, 438 ГК РФ). Отдельная бумажная подпись сторон не требуется.
      Факт акцепта фиксируется в системе Платформы (дата, версия оферты) и отражается в заполненном
      экземпляре договора с каждым инструктором.
    </p>
  </div>
  `;

  return wrapHtmlDocument("Агентский договор для инструктора", body);
}

export function renderRegistryTableHtml(rows: AgencyRegistryRow[], generatedAt: string): string {
  const header = `
  <h1>Реестр инструкторов — акцепт агентского договора</h1>
  <p class="muted">
    Сформировано ${escapeHtml(legalOperatorName())} · ${escapeHtml(formatRuDate(generatedAt))} · всего: ${rows.length}
  </p>
  <table>
    <thead>
      <tr>
        <th>№</th>
        <th>ФИО</th>
        <th>Email</th>
        <th>ИНН</th>
        <th>Статус</th>
        <th>Дата акцепта</th>
        <th>Версия оферты</th>
        <th>НПД/ИП</th>
        <th>Страхование</th>
        <th>Допуск</th>
      </tr>
    </thead>
    <tbody>
  `;

  const bodyRows = rows
    .map(
      (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.name ?? "—")}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${escapeHtml(r.inn ?? "—")}</td>
        <td>${escapeHtml(taxStatusLabel(r.taxStatus))}</td>
        <td>${escapeHtml(formatRuDate(r.agencyOfferAcceptedAt))}</td>
        <td>${escapeHtml(r.agencyOfferVersion ?? "—")}</td>
        <td>${yesNo(r.taxDocumentApproved)}</td>
        <td>${yesNo(r.insuranceApproved)}</td>
        <td>${yesNo(r.canAcceptPaidOrders)}</td>
      </tr>`,
    )
    .join("");

  return `${header}${bodyRows}</tbody></table>`;
}

export function renderClientRegistryTableHtml(
  rows: Awaited<ReturnType<typeof fetchClientBookingRegistryRows>>,
  generatedAt: string,
): string {
  const header = `
  <h1>Реестр клиентов — акцепт договора бронирования</h1>
  <p class="muted">
    Сформировано ${escapeHtml(legalOperatorName())} · ${escapeHtml(formatRuDate(generatedAt))} · всего: ${rows.length}
  </p>
  <table>
    <thead>
      <tr>
        <th>№</th>
        <th>ФИО</th>
        <th>Email</th>
        <th>Телефон</th>
        <th>Дата акцепта</th>
        <th>Версия оферты</th>
        <th>Оплач. заказов</th>
        <th>Завершённых</th>
        <th>Мероприятия</th>
      </tr>
    </thead>
    <tbody>
  `;

  const bodyRows = rows
    .map(
      (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.name ?? "—")}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${escapeHtml(r.phone ?? "—")}</td>
        <td>${escapeHtml(formatRuDate(r.offerAcceptedAt))}</td>
        <td>${escapeHtml(r.offerVersion)}</td>
        <td>${r.paidOrders}</td>
        <td>${r.completedOrders}</td>
        <td>${r.paidEventRegistrations}</td>
      </tr>`,
    )
    .join("");

  return `${header}${bodyRows}</tbody></table>`;
}

export type YookassaPackageOptions = {
  activeOnly?: boolean;
  includeCertificates?: boolean;
  /** Заполненные договоры с клиентами (по умолчанию — только с оплаченной активностью). */
  includeClientCertificates?: boolean;
  /** Все клиенты, а не только с оплатами (для includeClientCertificates). */
  allClients?: boolean;
};

export type YookassaPackageFiles = {
  generatedAt: string;
  rowCount: number;
  files: Array<{ name: string; content: string; mimeType: string }>;
};

export async function buildYookassaPackageFiles(
  options?: YookassaPackageOptions,
): Promise<YookassaPackageFiles> {
  const activeOnly = options?.activeOnly ?? false;
  const includeCertificates = options?.includeCertificates ?? true;
  const includeClientCertificates = options?.includeClientCertificates ?? true;
  const allClients = options?.allClients ?? false;
  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.slice(0, 10);

  const rows = await fetchAgencyRegistryRows({ activeOnly });
  const clientRows = await fetchClientBookingRegistryRows({ paidOnly: !allClients });
  const csv = agencyRegistryToCsv(rows);
  const clientCsv = clientBookingRegistryToCsv(clientRows);

  const files: YookassaPackageFiles["files"] = [
    {
      name: `00-soprovoditelnoe-pismo-${stamp}.html`,
      content: renderYookassaCoverLetterHtml(generatedAt),
      mimeType: "text/html; charset=utf-8",
    },
    {
      name: `01-agentskiy-dogovor-oferta-${stamp}.html`,
      content: renderInstructorAgencyOfferHtml(),
      mimeType: "text/html; charset=utf-8",
    },
    {
      name: `02-dogovor-oferta-klient-${stamp}.html`,
      content: renderClientOfferHtml(),
      mimeType: "text/html; charset=utf-8",
    },
    {
      name: `03-rekvizity-${stamp}.html`,
      content: renderRequisitesHtml(),
      mimeType: "text/html; charset=utf-8",
    },
    {
      name: `04-reestr-instruktorov-${stamp}.csv`,
      content: csv,
      mimeType: "text/csv; charset=utf-8",
    },
    {
      name: `04b-reestr-klientov-${stamp}.csv`,
      content: clientCsv,
      mimeType: "text/csv; charset=utf-8",
    },
  ];

  if (includeCertificates) {
    for (const row of rows) {
      const data = await fetchAgencyCertificateData(row.userId);
      if (!data) continue;
      const safe =
        (row.name ?? row.email)
          .replace(/[^\p{L}\p{N}._-]+/gu, "_")
          .slice(0, 48) || row.userId.slice(0, 8);
      files.push({
        name: `05-dogovory/${safe}-${row.userId.slice(0, 8)}.html`,
        content: renderAgencyCertificateHtml(data),
        mimeType: "text/html; charset=utf-8",
      });
    }
  }

  if (includeClientCertificates) {
    for (const row of clientRows) {
      const data = await fetchClientBookingCertificateData(row.userId);
      if (!data) continue;
      const safe =
        (row.name ?? row.email)
          .replace(/[^\p{L}\p{N}._-]+/gu, "_")
          .slice(0, 48) || row.userId.slice(0, 8);
      files.push({
        name: `06-dogovory-klienty/${safe}-${row.userId.slice(0, 8)}.html`,
        content: renderClientBookingCertificateHtml(data),
        mimeType: "text/html; charset=utf-8",
      });
    }
  }

  const combinedBody = `
  <div class="no-print" style="border:1px solid #ccc;padding:1rem;margin-bottom:1.5rem;background:#f9f9f9;">
    <strong>Как сохранить в PDF:</strong> Файл → Печать (Ctrl+P) → «Сохранить как PDF».
    Для отдельных PDF по разделам используйте файлы из папки пакета или печать с выбором страниц.
  </div>
  <div class="toc">
    <strong>Содержание пакета для ЮKassa</strong>
    <ol>
      <li>Сопроводительное письмо</li>
      <li>Агентский договор (полный текст оферты для инструкторов)</li>
      <li>Договор-оферта для клиентов</li>
      <li>Реквизиты Агента</li>
      <li>Реестр инструкторов</li>
      <li>Реестр клиентов</li>
      ${includeCertificates ? "<li>Заполненные договоры с каждым инструктором</li>" : ""}
      ${includeClientCertificates ? "<li>Заполненные договоры с клиентами</li>" : ""}
    </ol>
  </div>
  <section>${renderYookassaCoverLetterHtml(generatedAt).match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? ""}</section>
  <section class="page-break">${renderInstructorAgencyOfferHtml().match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? ""}</section>
  <section class="page-break">${renderClientOfferHtml().match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? ""}</section>
  <section class="page-break">${renderRequisitesHtml().match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? ""}</section>
  <section class="page-break">${renderRegistryTableHtml(rows, generatedAt)}</section>
  <section class="page-break">${renderClientRegistryTableHtml(clientRows, generatedAt)}</section>
  ${
    includeCertificates
      ? (
          await Promise.all(
            rows.map(async (row) => {
              const data = await fetchAgencyCertificateData(row.userId);
              if (!data) return "";
              const inner =
                renderAgencyCertificateHtml(data).match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "";
              return `<section class="page-break">${inner}</section>`;
            }),
          )
        ).join("")
      : ""
  }
  ${
    includeClientCertificates
      ? (
          await Promise.all(
            clientRows.map(async (row) => {
              const data = await fetchClientBookingCertificateData(row.userId);
              if (!data) return "";
              const inner =
                renderClientBookingCertificateHtml(data)
                  .match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "";
              return `<section class="page-break">${inner}</section>`;
            }),
          )
        ).join("")
      : ""
  }
  `;

  files.unshift({
    name: `yookassa-paket-${stamp}.html`,
    content: wrapHtmlDocument(`Пакет документов ЮKassa — ${LEGAL_PLATFORM_URL}`, combinedBody),
    mimeType: "text/html; charset=utf-8",
  });

  const readme = `Пакет документов для ЮKassa
Сформирован: ${formatRuDate(generatedAt)}
Сайт: ${LEGAL_PLATFORM_URL}
Инструкторов в реестре: ${rows.length}${activeOnly ? " (только с полным допуском)" : ""}
Клиентов в реестре: ${clientRows.length}${allClients ? "" : " (с оплаченной активностью)"}

Файлы:
- yookassa-paket-*.html — всё в одном файле (откройте в браузере → Печать → Сохранить как PDF)
- 00-soprovoditelnoe-pismo-*.html — сопроводительное письмо
- 01-agentskiy-dogovor-oferta-*.html — полный текст агентской оферты для инструкторов
- 02-dogovor-oferta-klient-*.html — оферта для клиентов
- 03-rekvizity-*.html — реквизиты ООО (Агента)
- 04-reestr-instruktorov-*.csv — реестр акцептов инструкторов
- 04b-reestr-klientov-*.csv — реестр клиентов (акцепт договора бронирования)
- 05-dogovory/*.html — заполненный агентский договор с каждым инструктором
- 06-dogovory-klienty/*.html — заполненный договор бронирования с каждым клиентом

Отправка в поддержку ЮKassa:
1. Приложите PDF из yookassa-paket (или отдельные PDF по разделам)
2. Приложите CSV-реестры
3. В тексте обращения укажите: исполнители — инструкторы НПД/ИП по агентским договорам; с клиентами — договор бронирования услуг (оферта с акцептом)
`;

  files.push({
    name: "README.txt",
    content: readme,
    mimeType: "text/plain; charset=utf-8",
  });

  return { generatedAt, rowCount: rows.length, files };
}

export async function buildYookassaPackageHtml(options?: YookassaPackageOptions): Promise<string> {
  const pkg = await buildYookassaPackageFiles(options);
  const main = pkg.files.find((f) => f.name.startsWith("yookassa-paket-"));
  return main?.content ?? "";
}
