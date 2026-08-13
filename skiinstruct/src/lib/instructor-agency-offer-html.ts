import { LEGAL_ROUTES } from "@/lib/legal";
import {
  AGENCY_OFFER_VERSION,
  CANCEL_CLIENT_FULL_REFUND_HOURS,
  CANCEL_CLIENT_PARTIAL_PERCENT,
  CANCEL_CLIENT_PARTIAL_REFUND_HOURS,
  formatLegalEditionDate,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
  LEGAL_PLATFORM_URL,
  NPD_RECEIPT_DEADLINE_HOURS,
  PAYOUT_MIN_WITHDRAWAL_RUB,
  PLATFORM_FEE_PERCENT,
  REFERRAL_MAX_ORDERS_PER_CLIENT,
  REFERRAL_REWARD_RUB,
} from "@/lib/legal-config";
import { LEGAL_AGENT, legalRegisteredAddress } from "@/lib/legal-entity";
import { formatPayoutWindowHint } from "@/lib/services/order-payout";

export function escapeOfferHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Полный текст агентской оферты (разделы 1–9) — единый источник для договора и пакета ЮKassa. */
export function renderInstructorAgencyOfferBodyHtml(): string {
  const agent = LEGAL_AGENT;
  const site = LEGAL_PLATFORM_URL;
  const clientOfferUrl = `${site}${LEGAL_ROUTES.oferta}`;
  const privacyUrl = `${site}${LEGAL_ROUTES.privacy}`;
  const payoutHint = formatPayoutWindowHint();
  const address = legalRegisteredAddress();

  return `
  <p>
    Настоящий договор является публичной офертой (ст. 437 ГК РФ) для дееспособных физических лиц,
    зарегистрированных как самозанятые или индивидуальные предприниматели (далее — «Инструктор», «Принципал»).
    Акцепт — регистрация в сервисе с отметкой о согласии (версия ${escapeOfferHtml(AGENCY_OFFER_VERSION)}).
    Исполнитель Платформы — ${escapeOfferHtml(agent.shortName)} (ИНН ${escapeOfferHtml(agent.inn)},
    ОГРН ${escapeOfferHtml(agent.ogrn)}).
  </p>

  <h2>1. Термины</h2>
  <ul>
    <li>
      <strong>Исполнитель / Агент</strong> — ${escapeOfferHtml(agent.shortName)} (ИНН ${escapeOfferHtml(agent.inn)}),
      оператор Платформы, привлекающий Клиентов и организующий бронирование и расчёты.
    </li>
    <li>
      <strong>Клиент</strong> — пользователь, бронирующий занятие через платформу.
    </li>
    <li>
      <strong>Услуга</strong> — занятие, оказываемое Инструктором лично. Договор на услугу обучения —
      между Клиентом и Инструктором; Исполнитель оказывает услугу по бронированию на условиях
      клиентской оферты (${escapeOfferHtml(clientOfferUrl)}).
    </li>
    <li>
      <strong>Комиссия</strong> — ${PLATFORM_FEE_PERCENT}% от стоимости услуги (удерживается при расчётах через платформу).
    </li>
  </ul>

  <h2>2. Предмет</h2>
  <p>
    Исполнитель предоставляет доступ к платформе, привлекает Клиентов, принимает оплату и перечисляет
    Инструктору сумму за вычетом Комиссии. Исполнитель не оказывает обучающие услуги Клиентам самостоятельно.
    Отношения не являются трудовыми: Инструктор сам определяет режим работы и несёт налоговые обязательства.
  </p>

  <h2>3. Регистрация и документы</h2>
  <ul>
    <li>ФИО, дата рождения, паспортные данные (серия, номер, дата выдачи, код подразделения) и скан разворота паспорта (стр. 2–3).</li>
    <li>Подтверждение статуса самозанятого или ИП, ИНН, справка из «Мой налог» или выписка ЕГРИП — при регистрации в анкете.</li>
    <li>Без одобрения паспорта и документа НПД/ИП статус «онлайн» и приём оплаченных заявок недоступны.</li>
  </ul>

  <h2>4. Расчёты и выплаты</h2>
  <ul>
    <li>Оплата Клиентом — только через платформу (ЮKassa).</li>
    <li>
      Комиссия по занятиям: ${PLATFORM_FEE_PERCENT}% от стоимости заказа (удерживается из суммы, оплаченной Клиентом).
    </li>
    <li>
      Комиссия по мероприятиям: ${PLATFORM_FEE_PERCENT}% от стоимости участия каждого клиента, оплатившего запись
      после проведения мероприятия; Инструктору перечисляется ${100 - PLATFORM_FEE_PERCENT}% от суммы каждого
      такого участника.
    </li>
    <li>Выплата Инструктору: ${escapeOfferHtml(payoutHint)}.</li>
    <li>Минимальная сумма к выводу: ${PAYOUT_MIN_WITHDRAWAL_RUB} ₽ (на реквизиты в личном кабинете).</li>
    <li>
      Чек в «Мой налог» (или ККТ) — загрузка в заказ в течение ${NPD_RECEIPT_DEADLINE_HOURS} ч после занятия.
    </li>
  </ul>

  <h2>5. Отмена и опоздание</h2>
  <ul>
    <li>
      Отмена Клиентом — по таблице из клиентской оферты: более ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч — 100%;
      от ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} до ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч — ${CANCEL_CLIENT_PARTIAL_PERCENT}%;
      менее ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} ч — без возврата.
    </li>
    <li>
      Отмена Инструктором не позднее <strong>${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> до занятия — полный
      возврат Клиенту без штрафа для Инструктора.
    </li>
    <li>
      Отмена менее чем за <strong>${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> до занятия или неявка на занятие /
      мероприятие — полный возврат Клиенту и штраф
      <strong>${INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы заявки в пользу платформы
      (удерживается из будущих выплат Инструктору).
    </li>
    <li>
      Опоздание более <strong>${INSTRUCTOR_LATE_GRACE_MINUTES} мин</strong> от ETA — Клиент вправе запросить полный
      возврат в интерфейсе заказа.
    </li>
  </ul>

  <h2>6. Ответственность и риски</h2>
  <ul>
    <li>
      Инструктор лично оказывает Услугу Клиенту и несёт ответственность за её качество, соблюдение техники
      безопасности и законодательства.
    </li>
    <li>
      Занятия спортом связаны с риском травм. Инструктор обязан предупреждать Клиента о рисках и обеспечивать
      разумные меры безопасности в рамках занятия.
    </li>
    <li>
      Исполнитель не несёт ответственности за травмы, вред здоровью и иные последствия занятия; претензии по
      существу услуги — к Инструктору. Исполнитель содействует в коммуникации и расчётах в рамках Платформы.
    </li>
    <li>
      Страхование ответственности (раздел 3) не освобождает Инструктора от обязанностей перед Клиентом и не
      переводит ответственность на Исполнителя.
    </li>
  </ul>

  <h2>7. Реферальная программа</h2>
  <p>
    Инструктор вправе участвовать в реферальной программе: ${REFERRAL_REWARD_RUB} ₽ за каждый из первых
    ${REFERRAL_MAX_ORDERS_PER_CLIENT} завершённых оплаченных заказов приглашённого клиента, вывод реферального
    баланса от ${PAYOUT_MIN_WITHDRAWAL_RUB} ₽. Условия могут уточняться на Сайте.
  </p>

  <h2>8. Персональные данные</h2>
  <p>
    Обработка данных Инструктора — в соответствии с политикой ПДн:
    ${escapeOfferHtml(privacyUrl)}.
  </p>

  <h2>9. Реквизиты Исполнителя (Агента)</h2>
  <p>
    <strong>${escapeOfferHtml(agent.fullName)}</strong><br />
    ИНН ${escapeOfferHtml(agent.inn)}<br />
    КПП ${escapeOfferHtml(agent.kpp)}<br />
    ОГРН ${escapeOfferHtml(agent.ogrn)}<br />
    Расчётный счёт: ${escapeOfferHtml(agent.bankAccount)}<br />
    Банк: ${escapeOfferHtml(agent.bankName)}<br />
    БИК ${escapeOfferHtml(agent.bik)}<br />
    Корр. счёт: ${escapeOfferHtml(agent.corrAccount)}<br />
    Юридический адрес: ${escapeOfferHtml(address)}<br />
    Email: ${escapeOfferHtml(agent.email)}
  </p>

  <p class="muted">
    Редакция ${escapeOfferHtml(formatLegalEditionDate())}. Для клиентов действует договор бронирования услуг:
    ${escapeOfferHtml(clientOfferUrl)}.
  </p>
`;
}
