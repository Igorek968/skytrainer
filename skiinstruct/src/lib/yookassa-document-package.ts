import {
  agencyRegistryToCsv,
  fetchAgencyCertificateData,
  fetchAgencyRegistryRows,
  renderAgencyCertificateHtml,
  type AgencyRegistryRow,
} from "@/lib/instructor-agency-registry";
import { LEGAL_ROUTES, legalOperatorName } from "@/lib/legal";
import {
  AGENCY_OFFER_VERSION,
  CLIENT_OFFER_VERSION,
  EVENT_CANCEL_FULL_REFUND_HOURS,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
  LEGAL_PLATFORM_URL,
  NPD_RECEIPT_DEADLINE_HOURS,
  PAYOUT_MIN_WITHDRAWAL_RUB,
  PLATFORM_FEE_PERCENT,
  REFERRAL_COOKIE_MAX_AGE_DAYS,
  REFERRAL_MAX_ORDERS_PER_CLIENT,
  REFERRAL_REWARD_RUB,
} from "@/lib/legal-config";
import { LEGAL_AGENT, LEGAL_SITE_URL, legalRegisteredAddress } from "@/lib/legal-entity";
import { formatPayoutWindowHint } from "@/lib/services/order-payout";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
    ИНН ${escapeHtml(agent.inn)}, ОГРНИП ${escapeHtml(agent.ogrn)}<br />
    Сайт: ${escapeHtml(site)}
  </p>

  <h2>2. Услуги на сайте</h2>
  <p>
    На платформе размещены услуги по обучению катанию на горных лыжах и сноуборду: индивидуальные занятия
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
    (ст. 437–438 ГК РФ): ${escapeHtml(site)}${LEGAL_ROUTES.ofertaInstructor}. Акцепт фиксируется электронно
    при регистрации в сервисе (дата и версия — в реестре и справках, приложенных к пакету).
  </p>
  <p>
    Для клиентов действует договор-оферта: ${escapeHtml(site)}${LEGAL_ROUTES.oferta}.
  </p>

  <h2>5. Состав пакета</h2>
  <ol>
    <li>Агентский договор (публичная оферта для инструкторов)</li>
    <li>Договор-оферта для клиентов</li>
    <li>Реквизиты Агента</li>
    <li>Реестр инструкторов, акцептовавших агентскую оферту</li>
    <li>Справки об акцепте агентского договора по каждому инструктору из реестра</li>
  </ol>

  <p>Готовы предоставить дополнительные материалы по запросу.</p>

  <p>
    Контакты: ${escapeHtml(agent.phone)}, ${escapeHtml(agent.email)}
  </p>
  `;

  return wrapHtmlDocument("Сопроводительное письмо — ЮKassa", body);
}

export function renderRequisitesHtml(): string {
  const agent = LEGAL_AGENT;
  const address = legalRegisteredAddress();

  const body = `
  <h1>Реквизиты Агента (оператора сервиса)</h1>
  <p class="muted">Реквизиты для оплаты и договорных отношений на ${escapeHtml(LEGAL_SITE_URL)}</p>
  <p><strong>${escapeHtml(agent.fullName)}</strong></p>
  <p>ИНН ${escapeHtml(agent.inn)}<br />ОГРНИП ${escapeHtml(agent.ogrn)}</p>
  <p>
    Расчётный счёт: <strong>${escapeHtml(agent.bankAccount)}</strong><br />
    Банк: ${escapeHtml(agent.bankName)}<br />
    БИК ${escapeHtml(agent.bik)}<br />
    Корр. счёт: ${escapeHtml(agent.corrAccount)}
  </p>
  <p>Юридический адрес: ${escapeHtml(address)}</p>
  <p>Телефон: ${escapeHtml(agent.phone)}</p>
  <p>Email: ${escapeHtml(agent.email)}</p>
  `;

  return wrapHtmlDocument("Реквизиты Агента", body);
}

export function renderClientOfferHtml(): string {
  const agent = LEGAL_AGENT;
  const site = LEGAL_SITE_URL;
  const payoutHint = formatPayoutWindowHint();

  const body = `
  <h1>Договор-оферта на оказание услуг по подбору инструктора</h1>
  <p class="muted">Редакция от ${CLIENT_OFFER_VERSION.replace(/-/g, ".")}</p>
  <p>
    <strong>${escapeHtml(agent.fullName)}</strong> (ИНН ${escapeHtml(agent.inn)}, ОГРНИП ${escapeHtml(agent.ogrn)}),
    публикует настоящий Договор-оферту (далее — «Оферта»).
  </p>

  <h2>1. Термины</h2>
  <p>
    <strong>Сайт</strong> — ${escapeHtml(site)}.<br />
    <strong>Агент</strong> — ${escapeHtml(agent.shortName)}, услуги по подбору инструктора и приёму оплаты.<br />
    <strong>Инструктор</strong> — самозанятый (НПД) или ИП, оказывающий услуги по обучению горным лыжам/сноуборду.<br />
    <strong>Клиент</strong> — физическое лицо, заказывающее услуги Инструктора.<br />
    <strong>Услуги Агента</strong> — информационное сопровождение, бронирование, приём оплаты, урегулирование споров.<br />
    <strong>Услуги Инструктора</strong> — непосредственное обучение катанию.
  </p>

  <h2>2. Предмет</h2>
  <p>
    2.1. Агент подбирает Инструктора, бронирует время, принимает оплату; Клиент оплачивает услуги в порядке Оферты.<br />
    2.2. Фактическим исполнителем является Инструктор. Агент не оказывает обучающие услуги.<br />
    2.4–2.5. Договор на обучение — между Клиентом и Инструктором (с принятия заказа).<br />
    2.6. Сайт — информационная площадка; Агент не контролирует занятие на склоне.
  </p>

  <h2>3. Акцепт</h2>
  <p>
    Оферта считается принятой при нажатии «Оплатить» / «Заказать» / «Записаться» и согласии с условиями Оферты,
    Политикой ПДн и Правилами возврата. Чек на обучение выставляет Инструктор (НПД/ИП).
  </p>

  <h2>4. Стоимость и оплата</h2>
  <p>
    Стоимость включает вознаграждение Инструктору и комиссию Агента (${PLATFORM_FEE_PERCENT}% от стоимости занятия),
    удерживаемую Агентом. Оплата — в рублях через ЮKassa. Средства поступают на расчётный счёт Агента
    ${escapeHtml(agent.bankAccount)} в ${escapeHtml(agent.bankName)}.
  </p>

  <h2>5. Обязанности</h2>
  <p>Агент обеспечивает работу Сайта, передаёт заявку Инструктору, организует возвраты.</p>
  <p>Инструктор проводит занятие, имеет статус НПД/ИП и по требованию выставляет чек клиенту.</p>

  <h2>6. Ответственность</h2>
  <p>
    6.1–6.3. Платформа — поиск и бронирование; Агент не отвечает за качество урока.<br />
    6.4. Агент не несёт ответственности за травмы и вред при занятиях (риски катания — на Клиенте).<br />
    6.5–6.6. Ответственность за занятие — у Инструктора; у инструкторов требуется страхование.
  </p>
  <p>4.5. Подтверждение оплаты через ЮKassa — у Агента; чек на обучение — у Инструктора.</p>

  <h2>7–8. Возвраты и мероприятия</h2>
  <p>
    Возвраты — по Правилам возврата на Сайте. Отмена инструктором менее чем за ${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч —
    полный возврат клиенту. Опоздание инструктора более ${INSTRUCTOR_LATE_GRACE_MINUTES} мин — право клиента на полный возврат.
    По мероприятиям: отмена клиентом за ${EVENT_CANCEL_FULL_REFUND_HOURS} ч и более — полный возврат.
  </p>

  <h2>9. Реферальная программа</h2>
  <p>
    Вознаграждение ${REFERRAL_REWARD_RUB} ₽ за каждый из первых ${REFERRAL_MAX_ORDERS_PER_CLIENT} оплаченных заказов
    приглашённого клиента; cookie реферала — ${REFERRAL_COOKIE_MAX_AGE_DAYS} дней. Минимальный вывод — ${PAYOUT_MIN_WITHDRAWAL_RUB} ₽.
  </p>

  <h2>10. Прочее</h2>
  <p>Оферта регулируется законодательством РФ. Споры — по месту регистрации Агента.</p>

  <h2>11. Реквизиты Агента</h2>
  <p>
    ${escapeHtml(agent.fullName)}, ИНН ${escapeHtml(agent.inn)}, тел. ${escapeHtml(agent.phone)},
    ${escapeHtml(agent.email)}. Выплаты инструкторам: ${escapeHtml(payoutHint)}.
  </p>
  <p class="muted">Полный текст на Сайте: ${escapeHtml(site)}${LEGAL_ROUTES.oferta}</p>
  `;

  return wrapHtmlDocument("Договор-оферта для клиентов", body);
}

export function renderInstructorAgencyOfferHtml(): string {
  const agent = LEGAL_AGENT;
  const site = LEGAL_SITE_URL;
  const payoutHint = formatPayoutWindowHint();

  const body = `
  <h1>Агентский договор (публичная оферта) для инструктора</h1>
  <p class="muted">Редакция ${AGENCY_OFFER_VERSION.replace(/-/g, ".")}</p>
  <p>
    Публичная оферта (ст. 437 ГК РФ) для самозанятых и ИП (далее — «Инструктор», «Принципал»).
    Акцепт — регистрация в сервисе с отметкой о согласии.
  </p>

  <h2>1. Термины</h2>
  <ul>
    <li><strong>Агент</strong> — ${escapeHtml(agent.shortName)} (ИНН ${escapeHtml(agent.inn)}), действует за вознаграждение в интересах Инструктора.</li>
    <li><strong>Клиент</strong> — пользователь, бронирующий занятие через платформу.</li>
    <li><strong>Услуга</strong> — занятие, оказываемое Инструктором лично. Договор на услугу — между Клиентом и Инструктором.</li>
    <li><strong>Комиссия Агента</strong> — ${PLATFORM_FEE_PERCENT}% от стоимости услуги.</li>
  </ul>

  <h2>2. Предмет</h2>
  <p>
    Агент предоставляет платформу, привлекает Клиентов, принимает оплату и перечисляет Инструктору сумму за вычетом Комиссии.
    Агент не оказывает услуги Клиентам самостоятельно. Отношения не являются трудовыми.
  </p>

  <h2>3. Регистрация и документы</h2>
  <ul>
    <li>Подтверждение статуса НПД или ИП, ИНН, справка из «Мой налог» или выписка ИП.</li>
    <li>Договор страхования ответственности — загрузка в личном кабинете.</li>
    <li>Без одобрения документов приём оплаченных заявок недоступен.</li>
  </ul>

  <h2>4. Расчёты и выплаты</h2>
  <ul>
    <li>Оплата Клиентом — только через платформу (ЮKassa).</li>
    <li>Комиссия Агента: ${PLATFORM_FEE_PERCENT}% (удерживается при расчётах).</li>
    <li>Выплата Инструктору: ${escapeHtml(payoutHint)}.</li>
    <li>Минимальная сумма к выводу: ${PAYOUT_MIN_WITHDRAWAL_RUB} ₽.</li>
    <li>Чек в «Мой налог» (или ККТ) — в течение ${NPD_RECEIPT_DEADLINE_HOURS} ч после занятия.</li>
  </ul>

  <h2>5. Отмена и опоздание</h2>
  <ul>
    <li>Отмена Инструктором не позднее ${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч — полный возврат Клиенту без штрафа.</li>
    <li>Отмена менее чем за ${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч или неявка — полный возврат Клиенту и штраф ${INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}% в пользу платформы.</li>
    <li>Опоздание более ${INSTRUCTOR_LATE_GRACE_MINUTES} мин — Клиент вправе запросить полный возврат.</li>
  </ul>

  <h2>6. Ответственность и риски</h2>
  <p>
    Инструктор лично оказывает услугу и отвечает за безопасность занятия. Агент не несёт ответственности за травмы
    и вред при занятиях. Страхование (раздел 3) не переводит ответственность на Агента.
  </p>

  <h2>7–9. Реферальная программа, ПДн, реквизиты</h2>
  <p>
    Реферальная программа — на условиях клиентской оферты. Обработка ПДн — по политике на Сайте.
  </p>
  <p>
    <strong>Агент:</strong> ${escapeHtml(agent.fullName)}, ИНН ${escapeHtml(agent.inn)}, ОГРНИП ${escapeHtml(agent.ogrn)},
    р/с ${escapeHtml(agent.bankAccount)}, ${escapeHtml(agent.bankName)}, БИК ${escapeHtml(agent.bik)}.
  </p>
  <p class="muted">Полный текст на Сайте: ${escapeHtml(site)}${LEGAL_ROUTES.ofertaInstructor}</p>
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

export type YookassaPackageOptions = {
  activeOnly?: boolean;
  includeCertificates?: boolean;
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
  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.slice(0, 10);

  const rows = await fetchAgencyRegistryRows({ activeOnly });
  const csv = agencyRegistryToCsv(rows);

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
        name: `05-spravki/${safe}-${row.userId.slice(0, 8)}.html`,
        content: renderAgencyCertificateHtml(data),
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
      <li>Агентский договор (оферта для инструкторов)</li>
      <li>Договор-оферта для клиентов</li>
      <li>Реквизиты Агента</li>
      <li>Реестр инструкторов</li>
      ${includeCertificates ? "<li>Справки об акцепте по каждому инструктору</li>" : ""}
    </ol>
  </div>
  <section>${renderYookassaCoverLetterHtml(generatedAt).match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? ""}</section>
  <section class="page-break">${renderInstructorAgencyOfferHtml().match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? ""}</section>
  <section class="page-break">${renderClientOfferHtml().match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? ""}</section>
  <section class="page-break">${renderRequisitesHtml().match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? ""}</section>
  <section class="page-break">${renderRegistryTableHtml(rows, generatedAt)}</section>
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

Файлы:
- yookassa-paket-*.html — всё в одном файле (откройте в браузере → Печать → Сохранить как PDF)
- 00-soprovoditelnoe-pismo-*.html — сопроводительное письмо
- 01-agentskiy-dogovor-oferta-*.html — агентский договор для инструкторов
- 02-dogovor-oferta-klient-*.html — оферта для клиентов
- 03-rekvizity-*.html — реквизиты ИП
- 04-reestr-instruktorov-*.csv — реестр акцептов (Excel / Google Sheets)
- 05-spravki/*.html — справка об акцепте по каждому инструктору

Отправка в поддержку ЮKassa:
1. Приложите PDF из yookassa-paket (или отдельные PDF по разделам)
2. Приложите CSV-реестр
3. В тексте обращения укажите, что исполнители — инструкторы НПД/ИП по агентскому договору-оферте
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
