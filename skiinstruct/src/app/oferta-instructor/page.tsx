import type { Metadata } from "next";
import Link from "next/link";

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
  NPD_RECEIPT_DEADLINE_HOURS,
  PAYOUT_MIN_WITHDRAWAL_RUB,
  PLATFORM_FEE_PERCENT,
  QUALITY_CLAIM_WINDOW_HOURS,
  REFERRAL_COOKIE_MAX_AGE_DAYS,
  REFERRAL_MAX_ORDERS_PER_CLIENT,
  REFERRAL_REWARD_RUB,
} from "@/lib/legal-config";
import { LEGAL_ROUTES } from "@/lib/legal";
import { LEGAL_AGENT, LEGAL_SITE_URL, legalRegisteredAddress } from "@/lib/legal-entity";
import { formatPayoutWindowHint } from "@/lib/services/order-payout";
import { LegalRequisitesBlock } from "@/shared/legal/legal-requisites-block";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";
import { pageMetadata, SEO_PAGES } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(SEO_PAGES.ofertaInstructor);

export default function InstructorAgencyOfferPage() {
  const payoutHint = formatPayoutWindowHint();

  return (
    <LegalDocLayout title="Договор (публичная оферта) для инструктора">
      <p className="text-muted-foreground">
        Настоящий договор является публичной офертой (ст. 437 ГК РФ) для дееспособных физических лиц,
        зарегистрированных как самозанятые или индивидуальные предприниматели (далее — «Инструктор»,
        «Принципал»). Акцепт — регистрация в сервисе с отметкой о согласии (версия {AGENCY_OFFER_VERSION}).
        Исполнитель Платформы — {LEGAL_AGENT.shortName} (ИНН {LEGAL_AGENT.inn}, ОГРН {LEGAL_AGENT.ogrn}).
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Термины</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Исполнитель / Агент</span> — {LEGAL_AGENT.shortName} (ИНН{" "}
            {LEGAL_AGENT.inn}), оператор Платформы, привлекающий Клиентов и организующий бронирование и расчёты.
          </li>
          <li>
            <span className="font-medium text-foreground">Клиент / Заказчик</span> — дееспособное физическое лицо,
            бронирующее занятие или запись на Событие через Платформу.
          </li>
          <li>
            <span className="font-medium text-foreground">Услуга инструктора</span> — занятие, оказываемое
            Инструктором лично. Договор на услугу обучения заключается между Клиентом и Инструктором; Исполнитель
            оказывает услугу по бронированию и расчётам на условиях{" "}
            <Link href={LEGAL_ROUTES.oferta} className="text-accent underline">
              клиентской оферты
            </Link>
            .
          </li>
          <li>
            <span className="font-medium text-foreground">Событие</span> — групповое или индивидуальное занятие с
            фиксированным временем (мастер-класс, выезд, тренировка), размещённое Инструктором в разделе «События».
          </li>
          <li>
            <span className="font-medium text-foreground">Сайт / Платформа</span> —{" "}
            <a className="text-accent underline" href={LEGAL_SITE_URL}>
              {LEGAL_SITE_URL}
            </a>
            .
          </li>
          <li>
            <span className="font-medium text-foreground">Комиссия Агента</span> — {PLATFORM_FEE_PERCENT}% от стоимости
            занятия или стоимости участия в Событии (удерживается при расчётах через Платформу).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Предмет</h2>
        <p className="text-muted-foreground">
          2.1. Исполнитель предоставляет Инструктору доступ к Платформе, привлекает Клиентов, принимает оплату через
          ЮKassa и перечисляет Инструктору сумму за вычетом Комиссии Агента.
        </p>
        <p className="text-muted-foreground">
          2.2. Исполнитель не оказывает обучающие услуги Клиентам самостоятельно, не руководит занятием на месте и не
          является стороной договора на обучение между Клиентом и Инструктором.
        </p>
        <p className="text-muted-foreground">
          2.3. Отношения не являются трудовыми: Инструктор самостоятельно определяет режим работы, место и методику
          занятий и несёт налоговые обязательства (НПД / ИП).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Регистрация и документы</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            ФИО, дата рождения, паспортные данные (серия, номер, дата выдачи, код подразделения) и скан разворота
            паспорта (стр. 2–3).
          </li>
          <li>
            Подтверждение статуса самозанятого или ИП, ИНН, справка из «Мой налог» или выписка ЕГРИП — при
            регистрации.
          </li>
          <li>
            Без одобрения паспорта и документа НПД/ИП статус «онлайн» и приём оплаченных заявок недоступны.
          </li>
          <li>
            Инструктор гарантирует достоверность сведений в профиле (направления, опыт, цены, расписание) и обновляет
            их при изменении.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Обязанности Инструктора</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            своевременно принимать или отклонять заявки Клиентов в интерфейсе Платформы; проводить занятие в
            забронированное время и в согласованном месте;
          </li>
          <li>
            уведомить об отмене занятия не позднее <strong>{INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> до начала (раздел
            6);
          </li>
          <li>
            иметь статус самозанятого или ИП и предоставлять Клиенту <strong>чек на услугу обучения</strong> (загрузка
            в заказ в течение {NPD_RECEIPT_DEADLINE_HOURS} ч после занятия);
          </li>
          <li>
            предупреждать Клиента о рисках занятий и обеспечивать разумные меры безопасности; соблюдать законодательство
            РФ;
          </li>
          <li>
            не принимать оплату за бронирование вне Платформы по заказам, оформленным через Сайт;
          </li>
          <li>
            после завершения занятия / События вправе оставить отзыв о Клиенте; Клиент вправе оставить отзыв об
            Инструкторе (раздел 9);
          </li>
          <li>
            по Событиям — соблюдать правила раздела 7 (создание, отмена, форс-мажор, подтверждение участников).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Расчёты и выплаты</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>Оплата Клиентом — только через Платформу (ЮKassa).</li>
          <li>
            Комиссия по занятиям: {PLATFORM_FEE_PERCENT}% от стоимости заказа (удерживается из суммы, оплаченной
            Клиентом).
          </li>
          <li>
            Комиссия по Событиям: {PLATFORM_FEE_PERCENT}% от стоимости участия каждого оплатившего клиента;
            Инструктору перечисляется {100 - PLATFORM_FEE_PERCENT}% от суммы каждого такого участника.
          </li>
          <li>Выплата Инструктору: {payoutHint}.</li>
          <li>Минимальная сумма к выводу: {PAYOUT_MIN_WITHDRAWAL_RUB} ₽ (на реквизиты в личном кабинете).</li>
          <li>
            При одобренной претензии Клиента по качеству (см.{" "}
            <Link href={LEGAL_ROUTES.returns} className="text-accent underline">
              Правила возврата
            </Link>
            ) доля Инструктора уменьшается пропорционально сумме возврата; претензия подаётся в течение{" "}
            {QUALITY_CLAIM_WINDOW_HOURS} ч после завершения занятия, пока выплата не произведена.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. Отмена, опоздание, неявка</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            Отмена Клиентом — по таблице из{" "}
            <Link href={LEGAL_ROUTES.oferta} className="text-accent underline">
              клиентской оферты
            </Link>
            : более {CANCEL_CLIENT_FULL_REFUND_HOURS} ч — 100%; от {CANCEL_CLIENT_PARTIAL_REFUND_HOURS} до{" "}
            {CANCEL_CLIENT_FULL_REFUND_HOURS} ч — {CANCEL_CLIENT_PARTIAL_PERCENT}%; менее{" "}
            {CANCEL_CLIENT_PARTIAL_REFUND_HOURS} ч — без возврата.
          </li>
          <li>
            Отмена Инструктором не позднее <strong>{INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> до занятия — полный
            возврат Клиенту без штрафа для Инструктора.
          </li>
          <li>
            Отмена менее чем за <strong>{INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> до занятия или неявка на занятие /
            Событие — полный возврат Клиенту и штраф{" "}
            <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы заявки в пользу платформы (удерживается из
            будущих выплат Инструктору).
          </li>
          <li>
            Опоздание Инструктора более <strong>{INSTRUCTOR_LATE_GRACE_MINUTES} мин</strong> от ETA — Клиент вправе
            запросить полный возврат в интерфейсе заказа.
          </li>
          <li>
            Опоздание Клиента более чем на 10 минут — Инструктор вправе отказать в оказании услуги; более чем на 30
            минут — услуга по бронированию считается оказанной в полном объёме (согласно клиентской оферте).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. События</h2>
        <p className="text-muted-foreground">
          7.1. Инструктор создаёт Событие с указанием даты, времени, места, стоимости и лимита мест. Публикация
          проходит модерацию Исполнителя.
        </p>
        <p className="text-muted-foreground">
          7.2. Для платных Событий место участника бронируется после оплаты через ЮKassa (предоплата при записи).
          Комиссия Агента — <strong>{PLATFORM_FEE_PERCENT}%</strong> от стоимости участия каждого оплатившего клиента.
        </p>
        <p className="text-muted-foreground">
          7.3. Отмена записи Клиентом: за <strong>{EVENT_CANCEL_FULL_REFUND_HOURS} ч и более</strong> до начала —
          полный возврат (если оплата проведена); менее чем за{" "}
          <strong>{EVENT_CANCEL_FULL_REFUND_HOURS} ч</strong> — без возврата.
        </p>
        <p className="text-muted-foreground">
          7.4. Отмена События Инструктором до начала — полный возврат всем оплатившим участникам. Неявка Инструктора —
          полный возврат клиентам и штраф <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> с Инструктора.
        </p>
        <p className="text-muted-foreground">
          7.5. <strong>Форс-мажорная отмена</strong> (после начала времени События): если Событие не состоялось по
          обстоятельствам непреодолимой силы или иным объективным причинам (в том числе неблагоприятные погодные
          условия, закрытие площадки, указания органов власти), Инструктор оформляет в интерфейсе Сайта отмену с
          указанием причины (до {EVENT_FORCE_MAJEURE_REASON_MAX} символов). Всем оплатившим участникам возвращается{" "}
          <strong>100%</strong> стоимости участия; штраф с Инструктора не начисляется.
        </p>
        <p className="text-muted-foreground">
          7.6. После окончания События Инструктор вправе оставить отзыв участникам, подтвердившим присутствие; Клиент
          вправе оставить отзыв об Инструкторе после окончания оплаченного События.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">8. Ответственность и риски</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            Инструктор лично оказывает Услугу Клиенту и несёт ответственность за её качество, соблюдение техники
            безопасности и законодательства.
          </li>
          <li>
            Занятия спортом связаны с риском травм. Инструктор обязан предупреждать Клиента о рисках и обеспечивать
            разумные меры безопасности в рамках занятия.
          </li>
          <li>
            Исполнитель не несёт ответственности за травмы, вред здоровью и иные последствия занятия или участия в
            Событии; претензии по существу услуги — к Инструктору. Исполнитель содействует в коммуникации и расчётах в
            рамках Платформы.
          </li>
          <li>
            Сайт — информационная площадка. Исполнитель не организует занятие на месте и не выступает организатором
            активного отдыха.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">9. Отзывы, споры, изменения</h2>
        <p className="text-muted-foreground">
          9.1. Отзывы Клиента об Инструкторе и отзывы Инструктора о Клиенте должны быть достоверными, без нецензурной
          лексики, оскорблений и персональных данных третьих лиц. Исполнитель вправе модерировать и удалять отзывы при
          нарушении правил.
        </p>
        <p className="text-muted-foreground">
          9.2. Претензии Инструктора к Исполнителю направляются письменно (в том числе на{" "}
          <a className="text-accent underline" href={`mailto:${LEGAL_AGENT.email}`}>
            {LEGAL_AGENT.email}
          </a>
          ) в разумный срок. Срок рассмотрения — до 30 дней, если иное не установлено законом. Неурегулированные споры
          рассматриваются по месту нахождения Исполнителя ({legalRegisteredAddress()}), если иное не установлено
          законом.
        </p>
        <p className="text-muted-foreground">
          9.3. Исполнитель вправе в одностороннем порядке изменять настоящую Оферту с публикацией на Сайте. Продолжение
          использования Платформы после публикации новой редакции означает согласие с изменениями, если иное не
          предусмотрено законом или интерфейсом акцепта.
        </p>
      </section>

      <section id="referral" className="space-y-3">
        <h2 className="text-lg font-semibold">10. Реферальная программа</h2>
        <p className="text-muted-foreground">
          10.1. Инструктор вправе участвовать в реферальной программе (ссылка с параметром{" "}
          <code className="text-foreground">?ref=</code>). Сведения о коде могут сохраняться в cookie до{" "}
          <strong>{REFERRAL_COOKIE_MAX_AGE_DAYS}</strong> дней.
        </p>
        <p className="text-muted-foreground">
          10.2. Вознаграждение — <strong>{REFERRAL_REWARD_RUB} ₽</strong> за каждый из первых{" "}
          <strong>{REFERRAL_MAX_ORDERS_PER_CLIENT}</strong> завершённых оплаченных заказов приглашённого клиента;
          вывод баланса — от <strong>{PAYOUT_MIN_WITHDRAWAL_RUB} ₽</strong>. Налоговые обязательства по выплатам несёт
          получатель. Исполнитель вправе изменять или прекращать программу с публикацией на Сайте.
        </p>
        <p className="text-muted-foreground">
          10.3. Ссылку можно направлять в личных сообщениях, в Telegram, VK и на площадках, где реклама услуг в РФ не
          запрещена. <strong>Запрещено</strong> рекламировать Платформу и реферальную программу в Instagram, Facebook,
          Threads и на иных ресурсах, реклама на которых запрещена законом. За приглашения с таких размещений
          вознаграждение может не начисляться.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">11. Персональные данные</h2>
        <p className="text-muted-foreground">
          Обработка данных Инструктора и данных Клиентов, ставших доступными Инструктору в связи с заказом, — в
          соответствии с{" "}
          <Link href={LEGAL_ROUTES.privacy} className="text-accent underline">
            Политикой обработки персональных данных
          </Link>
          . Инструктор обязуется не использовать контакты Клиентов вне целей оказания забронированной услуги.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">12. Форс-мажор</h2>
        <p className="text-muted-foreground">
          12.1. Стороны освобождаются от ответственности за неисполнение обязательств, вызванное обстоятельствами
          непреодолимой силы (стихийные бедствия, военные действия, решения органов власти, аварии и т.п.), при
          условии своевременного уведомления другой стороны.
        </p>
        <p className="text-muted-foreground">
          12.2. В отношении Событий форс-мажор (включая неблагоприятные погодные условия, при которых проведение
          невозможно или небезопасно) оформляется Инструктором после наступления времени начала через функцию
          «Форс-мажор отмена» с указанием причины. Последствия для оплаты — по п. 7.5 настоящей Оферты и{" "}
          <Link href={LEGAL_ROUTES.returns} className="text-accent underline">
            Правилам возврата
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">13. Реквизиты Исполнителя</h2>
        <LegalRequisitesBlock />
      </section>

      <p className="text-xs text-muted-foreground">
        Редакция {formatLegalEditionDate()}. Для клиентов действует{" "}
        <Link href={LEGAL_ROUTES.oferta} className="underline">
          договор бронирования услуг (публичная оферта)
        </Link>
        .
      </p>
    </LegalDocLayout>
  );
}
