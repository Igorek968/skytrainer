import { LEGAL_ROUTES } from "@/lib/legal";
import {
  AGENCY_OFFER_VERSION,
  CANCEL_CLIENT_FULL_REFUND_HOURS,
  CANCEL_CLIENT_PARTIAL_PERCENT,
  CANCEL_CLIENT_PARTIAL_REFUND_HOURS,
  EVENT_CANCEL_FULL_REFUND_HOURS,
  EVENT_FORCE_MAJEURE_REASON_MAX,
  formatLegalEditionDate,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
  LEGAL_PLATFORM_URL,
  NPD_RECEIPT_DEADLINE_HOURS,
  PAYOUT_MIN_WITHDRAWAL_RUB,
  PLATFORM_FEE_PERCENT,
  QUALITY_CLAIM_WINDOW_HOURS,
  REFERRAL_COOKIE_MAX_AGE_DAYS,
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

/** Полный текст агентской оферты — единый источник для договора и пакета ЮKassa. */
export function renderInstructorAgencyOfferBodyHtml(): string {
  const agent = LEGAL_AGENT;
  const site = LEGAL_PLATFORM_URL;
  const clientOfferUrl = `${site}${LEGAL_ROUTES.oferta}`;
  const privacyUrl = `${site}${LEGAL_ROUTES.privacy}`;
  const returnsUrl = `${site}${LEGAL_ROUTES.returns}`;
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
      <strong>Клиент / Заказчик</strong> — дееспособное физическое лицо, бронирующее занятие или запись на Событие
      через Платформу.
    </li>
    <li>
      <strong>Услуга инструктора</strong> — занятие, оказываемое Инструктором лично. Договор на услугу обучения —
      между Клиентом и Инструктором; Исполнитель оказывает услугу по бронированию на условиях клиентской оферты
      (${escapeOfferHtml(clientOfferUrl)}).
    </li>
    <li>
      <strong>Событие</strong> — групповое или индивидуальное занятие с фиксированным временем, размещённое
      Инструктором в разделе «События».
    </li>
    <li>
      <strong>Сайт / Платформа</strong> — ${escapeOfferHtml(site)}.
    </li>
    <li>
      <strong>Комиссия Агента</strong> — ${PLATFORM_FEE_PERCENT}% от стоимости занятия или участия в Событии
      (удерживается при расчётах через Платформу).
    </li>
  </ul>

  <h2>2. Предмет</h2>
  <p>
    2.1. Исполнитель предоставляет Инструктору доступ к Платформе, привлекает Клиентов, принимает оплату через
    ЮKassa и перечисляет Инструктору сумму за вычетом Комиссии Агента.
  </p>
  <p>
    2.2. Исполнитель не оказывает обучающие услуги Клиентам самостоятельно, не руководит занятием на месте и не
    является стороной договора на обучение между Клиентом и Инструктором.
  </p>
  <p>
    2.3. Отношения не являются трудовыми: Инструктор самостоятельно определяет режим работы, место и методику
    занятий и несёт налоговые обязательства (НПД / ИП).
  </p>

  <h2>3. Регистрация и документы</h2>
  <ul>
    <li>ФИО, дата рождения, паспортные данные (серия, номер, дата выдачи, код подразделения) и скан разворота паспорта (стр. 2–3).</li>
    <li>Подтверждение статуса самозанятого или ИП, ИНН, справка из «Мой налог» или выписка ЕГРИП — при регистрации.</li>
    <li>Без одобрения паспорта и документа НПД/ИП статус «онлайн» и приём оплаченных заявок недоступны.</li>
    <li>Инструктор гарантирует достоверность сведений в профиле и обновляет их при изменении.</li>
  </ul>

  <h2>4. Обязанности Инструктора</h2>
  <ul>
    <li>своевременно принимать или отклонять заявки; проводить занятие в забронированное время и месте;</li>
    <li>уведомить об отмене не позднее <strong>${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> до начала (раздел 6);</li>
    <li>иметь статус самозанятого или ИП и предоставлять Клиенту чек на услугу обучения (загрузка в заказ в течение ${NPD_RECEIPT_DEADLINE_HOURS} ч после занятия);</li>
    <li>предупреждать Клиента о рисках и обеспечивать разумные меры безопасности; соблюдать законодательство РФ;</li>
    <li>не принимать оплату за бронирование вне Платформы по заказам, оформленным через Сайт;</li>
    <li>после завершения занятия / События вправе оставить отзыв о Клиенте; Клиент вправе оставить отзыв об Инструкторе (раздел 9);</li>
    <li>по Событиям — соблюдать правила раздела 7.</li>
  </ul>

  <h2>5. Расчёты и выплаты</h2>
  <ul>
    <li>Оплата Клиентом — только через Платформу (ЮKassa).</li>
    <li>Комиссия по занятиям: ${PLATFORM_FEE_PERCENT}% от стоимости заказа.</li>
    <li>
      Комиссия по Событиям: ${PLATFORM_FEE_PERCENT}% от стоимости участия каждого оплатившего клиента;
      Инструктору перечисляется ${100 - PLATFORM_FEE_PERCENT}% от суммы каждого такого участника.
    </li>
    <li>Выплата Инструктору: ${escapeOfferHtml(payoutHint)}.</li>
    <li>Минимальная сумма к выводу: ${PAYOUT_MIN_WITHDRAWAL_RUB} ₽.</li>
    <li>
      При одобренной претензии Клиента по качеству (Правила возврата: ${escapeOfferHtml(returnsUrl)}) доля
      Инструктора уменьшается пропорционально; претензия — в течение ${QUALITY_CLAIM_WINDOW_HOURS} ч после занятия,
      пока выплата не произведена.
    </li>
  </ul>

  <h2>6. Отмена, опоздание, неявка</h2>
  <ul>
    <li>
      Отмена Клиентом — по клиентской оферте: более ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч — 100%;
      от ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} до ${CANCEL_CLIENT_FULL_REFUND_HOURS} ч — ${CANCEL_CLIENT_PARTIAL_PERCENT}%;
      менее ${CANCEL_CLIENT_PARTIAL_REFUND_HOURS} ч — без возврата.
    </li>
    <li>
      Отмена Инструктором не позднее <strong>${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> до занятия — полный
      возврат Клиенту без штрафа.
    </li>
    <li>
      Отмена менее чем за <strong>${INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> или неявка — полный возврат Клиенту и штраф
      <strong>${INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы заявки в пользу платформы.
    </li>
    <li>
      Опоздание Инструктора более <strong>${INSTRUCTOR_LATE_GRACE_MINUTES} мин</strong> от ETA — Клиент вправе
      запросить полный возврат.
    </li>
    <li>
      Опоздание Клиента более чем на 10 минут — Инструктор вправе отказать в услуге; более чем на 30 минут —
      услуга по бронированию считается оказанной в полном объёме.
    </li>
  </ul>

  <h2>7. События</h2>
  <p>
    7.1. Инструктор создаёт Событие с указанием даты, времени, места, стоимости и лимита мест. Публикация проходит
    модерацию Исполнителя.
  </p>
  <p>
    7.2. Для платных Событий место бронируется после оплаты через ЮKassa. Комиссия Агента —
    <strong>${PLATFORM_FEE_PERCENT}%</strong> от стоимости участия каждого оплатившего клиента.
  </p>
  <p>
    7.3. Отмена записи Клиентом: за <strong>${EVENT_CANCEL_FULL_REFUND_HOURS} ч и более</strong> — полный возврат;
    менее чем за <strong>${EVENT_CANCEL_FULL_REFUND_HOURS} ч</strong> — без возврата.
  </p>
  <p>
    7.4. Отмена События Инструктором до начала — полный возврат оплатившим. Неявка Инструктора — полный возврат и штраф
    <strong>${INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong>.
  </p>
  <p>
    7.5. <strong>Форс-мажорная отмена</strong> после начала времени События (погода, закрытие площадки, указания
    органов власти и т.п.): Инструктор указывает причину (до ${EVENT_FORCE_MAJEURE_REASON_MAX} символов); участникам
    возвращается <strong>100%</strong>; штраф с Инструктора не начисляется.
  </p>
  <p>
    7.6. После окончания События Инструктор вправе оставить отзыв участникам, подтвердившим присутствие; Клиент —
    отзыв об Инструкторе после оплаченного События.
  </p>

  <h2>8. Ответственность и риски</h2>
  <ul>
    <li>Инструктор несёт ответственность за качество Услуги, технику безопасности и соблюдение законодательства.</li>
    <li>Занятия спортом связаны с риском травм; Инструктор предупреждает Клиента и обеспечивает разумные меры безопасности.</li>
    <li>Исполнитель не несёт ответственности за травмы и последствия занятия / События; претензии по существу — к Инструктору.</li>
    <li>Сайт — информационная площадка; Исполнитель не организует занятие на месте.</li>
  </ul>

  <h2>9. Отзывы, споры, изменения</h2>
  <p>
    9.1. Отзывы должны быть достоверными, без оскорблений и данных третьих лиц. Исполнитель вправе модерировать отзывы.
  </p>
  <p>
    9.2. Претензии — письменно на ${escapeOfferHtml(agent.email)}. Срок рассмотрения — до 30 дней.
    Споры — по месту нахождения Исполнителя (${escapeOfferHtml(address)}), если иное не установлено законом.
  </p>
  <p>
    9.3. Исполнитель вправе изменять Оферту с публикацией на Сайте. Продолжение использования Платформы после
    публикации означает согласие с изменениями, если иное не предусмотрено законом или интерфейсом акцепта.
  </p>

  <h2>10. Реферальная программа</h2>
  <p>
    10.1. Участие через ссылку с параметром ?ref=; cookie до ${REFERRAL_COOKIE_MAX_AGE_DAYS} дней.
  </p>
  <p>
    10.2. Вознаграждение — ${REFERRAL_REWARD_RUB} ₽ за каждый из первых ${REFERRAL_MAX_ORDERS_PER_CLIENT}
    завершённых оплаченных заказов приглашённого клиента; вывод от ${PAYOUT_MIN_WITHDRAWAL_RUB} ₽.
    Налоги — на получателе. Программа может быть изменена или прекращена с публикацией на Сайте.
  </p>

  <h2>11. Персональные данные</h2>
  <p>
    Обработка данных — по политике ПДн (${escapeOfferHtml(privacyUrl)}). Инструктор не использует контакты Клиентов
    вне целей оказания забронированной услуги.
  </p>

  <h2>12. Форс-мажор</h2>
  <p>
    12.1. Стороны освобождаются от ответственности при непреодолимой силе при условии своевременного уведомления.
  </p>
  <p>
    12.2. По Событиям форс-мажор оформляется через «Форс-мажор отмена»; последствия — п. 7.5 и Правила возврата
    (${escapeOfferHtml(returnsUrl)}).
  </p>

  <h2>13. Реквизиты Исполнителя (Агента)</h2>
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
