import { LEGAL_ROUTES } from "@/lib/legal";
import {
  CANCEL_CLIENT_FULL_REFUND_HOURS,
  CANCEL_CLIENT_PARTIAL_PERCENT,
  CANCEL_CLIENT_PARTIAL_REFUND_HOURS,
  CLIENT_OFFER_VERSION,
  EVENT_CANCEL_FULL_REFUND_HOURS,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
  PLATFORM_FEE_PERCENT,
} from "@/lib/legal-config";
import { LEGAL_AGENT, LEGAL_SITE_URL } from "@/lib/legal-entity";
import { escapeOfferHtml } from "@/lib/instructor-agency-offer-html";

/** Текст условий клиентской оферты (без обёртки документа) — для пакета ЮKassa и заполненных договоров. */
export function renderClientOfferBodyHtml(): string {
  const agent = LEGAL_AGENT;
  const site = LEGAL_SITE_URL;

  return `
  <p class="muted">Редакция от ${CLIENT_OFFER_VERSION.replace(/-/g, ".")}</p>
  <p>
    <strong>${escapeOfferHtml(agent.fullName)}</strong> (ИНН ${escapeOfferHtml(agent.inn)}, КПП ${escapeOfferHtml(agent.kpp)},
    ОГРН ${escapeOfferHtml(agent.ogrn)}) — Исполнитель (Агент), оператор Платформы
    <a href="${escapeOfferHtml(site)}">${escapeOfferHtml(site)}</a>.
  </p>

  <h2>1. Термины</h2>
  <p>
    <strong>Исполнитель / Агент</strong> — ${escapeOfferHtml(agent.shortName)}: поиск Инструктора, бронирование, приём оплаты;
    не является исполнителем услуг обучения.<br />
    <strong>Инструктор</strong> — самозанятый (НПД) или ИП, оказывает занятие лично.<br />
    <strong>Клиент</strong> — физическое лицо, бронирующее занятие.<br />
    <strong>Комиссия Агента</strong> — ${PLATFORM_FEE_PERCENT}% от стоимости занятия / участия в событии.<br />
    <strong>Услуга инструктора</strong> — обучение и проведение занятия; договор на неё — между Клиентом и Инструктором.
  </p>

  <h2>2. Предмет и акцепт</h2>
  <p>
    2.1. Агент оказывает услугу по бронированию и приёму оплаты; фактический исполнитель обучения — Инструктор.<br />
    2.2. Акцепт — регистрация с согласием с Офертой, а также оплата / «Оплатить» / «Заказать» / «Записаться»
    и согласие с Офертой, Политикой ПДн и Правилами возврата.<br />
    2.3. Чек на обучение выставляет Инструктор (НПД/ИП). Подтверждение оплаты через ЮKassa — у Агента.
  </p>

  <h2>3. Стоимость и оплата</h2>
  <p>
    Итоговая сумма включает вознаграждение Инструктору и Комиссию Агента (${PLATFORM_FEE_PERCENT}%).
    Оплата — в рублях через ЮKassa на р/с Агента ${escapeOfferHtml(agent.bankAccount)} в ${escapeOfferHtml(agent.bankName)},
    БИК ${escapeOfferHtml(agent.bik)}.
  </p>

  <h2>4. Возвраты (отмена клиентом)</h2>
  <table>
    <tr><th>Срок до занятия</th><th>Возврат</th></tr>
    <tr><td>Более ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч</td><td>100%</td></tr>
    <tr><td>От ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} до ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч</td><td>${CANCEL_CLIENT_PARTIAL_PERCENT}%</td></tr>
    <tr><td>Менее ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} ч</td><td>Без возврата</td></tr>
  </table>
  <p>
    Отмена инструктором — 100% клиенту; менее чем за ${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч или неявка —
    также штраф ${INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}% с инструктора. Опоздание инструктора более
    ${INSTRUCTOR_LATE_GRACE_MINUTES} мин от ETA — право на полный возврат.
    Подробности: ${escapeOfferHtml(site)}${LEGAL_ROUTES.returns}.
  </p>

  <h2>5. События</h2>
  <p>
    Комиссия Агента ${PLATFORM_FEE_PERCENT}%. Отмена клиентом за ${EVENT_CANCEL_FULL_REFUND_HOURS} ч и более — 100%;
    позже — без возврата. Отмена инструктором — полный возврат участникам.
  </p>

  <h2>6. Ответственность</h2>
  <p>
    Платформа — информационная площадка. Агент не отвечает за качество занятия и травмы при оказании Услуг Инструктора.
    Ответственность за занятие — у Инструктора; требуется страхование (см. оферту инструктора).
  </p>

  <h2>7. Реквизиты Агента</h2>
  <p>
    ${escapeOfferHtml(agent.fullName)}, ИНН ${escapeOfferHtml(agent.inn)}, КПП ${escapeOfferHtml(agent.kpp)},
    ОГРН ${escapeOfferHtml(agent.ogrn)}, email ${escapeOfferHtml(agent.email)}.
  </p>
  <p class="muted">Полный текст на Сайте: ${escapeOfferHtml(site)}${LEGAL_ROUTES.oferta}</p>
  `;
}
