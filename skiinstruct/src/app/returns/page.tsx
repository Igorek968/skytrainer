import type { Metadata } from "next";
import Link from "next/link";

import {
  CANCEL_CLIENT_FULL_REFUND_HOURS,
  CANCEL_CLIENT_PARTIAL_PERCENT,
  CANCEL_CLIENT_PARTIAL_REFUND_HOURS,
  EVENT_CANCEL_FULL_REFUND_HOURS,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
  PLATFORM_FEE_PERCENT,
} from "@/lib/legal-config";
import { LEGAL_AGENT, LEGAL_SITE_URL } from "@/lib/legal-entity";
import { LEGAL_ROUTES } from "@/lib/legal";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";

export const metadata: Metadata = {
  title: "Правила возврата денежных средств",
  description: "Отмена занятий, возврат оплаты через ЮKassa",
};

export default function ReturnsPolicyPage() {
  return (
    <LegalDocLayout title="Правила возврата денежных средств">
      <p className="text-muted-foreground">
        Настоящие Правила являются неотъемлемой частью{" "}
        <Link href={LEGAL_ROUTES.oferta} className="text-accent underline">
          Договора-оферты
        </Link>
        , размещённой на Сайте{" "}
        <a className="text-accent underline" href={LEGAL_SITE_URL}>
          {LEGAL_SITE_URL}
        </a>
        .
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Общие положения</h2>
        <p className="text-muted-foreground">
          1.1. Возврат денежных средств производится в случаях, предусмотренных законодательством РФ (ЗоЗПП, ГК РФ) и
          условиями настоящих Правил.
        </p>
        <p className="text-muted-foreground">
          1.2. Возврат осуществляется на ту же банковскую карту, с которой производилась оплата, в течение{" "}
          <strong>3–10 рабочих дней</strong> с момента одобрения возврата.
        </p>
        <p className="text-muted-foreground">
          1.3. Расчёт суммы возврата при отмене занятий выполняется автоматически по правилам, описанным ниже и
          реализованным в сервисе.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Занятия с инструктором</h2>
        <p className="font-medium text-foreground">2.1. Отмена до принятия заявки инструктором:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            если заказ не оплачен или инструктор ещё не принял заявку — <strong>100%</strong> (полный возврат или
            отмена без списания);
          </li>
          <li>техническая отмена платформой — <strong>100%</strong>.</li>
        </ul>
        <p className="font-medium text-foreground">2.2. После принятия инструктором:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <strong>возврат невозможен</strong> при отмене по инициативе клиента — заказ считается невозвратным с
            момента подтверждения инструктором.
          </li>
        </ul>
        <p className="font-medium text-foreground">
          2.3. Отмена клиентом до принятия инструктором (если применимо по статусу заказа):
        </p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            более <strong>{CANCEL_CLIENT_FULL_REFUND_HOURS} ч</strong> до начала занятия — возвращается{" "}
            <strong>100%</strong> оплаченной суммы;
          </li>
          <li>
            от <strong>{CANCEL_CLIENT_PARTIAL_REFUND_HOURS} ч</strong> до{" "}
            <strong>{CANCEL_CLIENT_FULL_REFUND_HOURS} ч</strong> — возвращается{" "}
            <strong>{CANCEL_CLIENT_PARTIAL_PERCENT}%</strong> (остальное удерживается инструктором как компенсация за
            резервирование времени);
          </li>
          <li>
            менее <strong>{CANCEL_CLIENT_PARTIAL_REFUND_HOURS} ч</strong> до начала — <strong>без возврата</strong>.
          </li>
        </ul>
        <p className="font-medium text-foreground">2.4. Отмена занятия инструктором или платформой:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            клиенту возвращается <strong>100%</strong> оплаченной суммы;
          </li>
          <li>
            если инструктор отменил занятие менее чем за <strong>{INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> до начала
            или не явился — клиенту также возвращается <strong>100%</strong>, а с инструктора удерживается штраф{" "}
            <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы заявки в пользу платформы (из будущих
            выплат), согласно{" "}
            <Link href={LEGAL_ROUTES.ofertaInstructor} className="text-accent underline">
              агентскому договору для инструктора
            </Link>
            ; платформа предлагает альтернативного инструктора или перенос без доплаты.
          </li>
        </ul>
        <p className="font-medium text-foreground">2.5. Опоздание инструктора:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            если инструктор не прибыл в течение <strong>{INSTRUCTOR_LATE_GRACE_MINUTES} мин</strong> после заявленного
            ETA и занятие не начато — клиент вправе запросить <strong>полный возврат</strong> в интерфейсе заказа.
          </li>
        </ul>
        <p className="font-medium text-foreground">2.6. Некачественно оказанная услуга:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            при доказанных нарушениях (небезопасно, инструктор некомпетентен) агент организует частичный или полный
            возврат по итогам разбирательства.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Мероприятия</h2>
        <p className="text-muted-foreground">
          3.1. На записи на мероприятия (групповые выезды, мастер-классы и т.п.) действуют{" "}
          <strong>отдельные правила</strong>, изложенные в разделе «Мероприятия»{" "}
          <Link href={LEGAL_ROUTES.oferta} className="text-accent underline">
            Договора-оферты
          </Link>
          .
        </p>
        <p className="text-muted-foreground">
          3.2. Кратко: оплата производится после мероприятия; при отмене записи клиентом за{" "}
          <strong>{EVENT_CANCEL_FULL_REFUND_HOURS} ч и более</strong> до начала — полный возврат (если оплата уже
          проведена); менее чем за <strong>{EVENT_CANCEL_FULL_REFUND_HOURS} ч</strong> — без возврата.
        </p>
        <p className="text-muted-foreground">
          3.3. Отмена мероприятия инструктором — полный возврат всем оплатившим участникам.
        </p>
        <p className="text-muted-foreground">
          3.4. Неявка инструктора на мероприятие или отмена менее чем за{" "}
          <strong>{INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> — полный возврат клиенту; с инструктора удерживается штраф{" "}
          <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы записи в пользу платформы (из будущих выплат).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Порядок действий для возврата</h2>
        <p className="text-muted-foreground">
          4.1. Клиент направляет заявление на возврат на адрес электронной почты <strong>{LEGAL_AGENT.email}</strong> или
          через форму обратной связи в личном кабинете.
        </p>
        <p className="text-muted-foreground">
          4.2. В заявлении необходимо указать: ФИО, номер заказа, причину возврата, желаемую сумму возврата (если
          частичный).
        </p>
        <p className="text-muted-foreground">
          4.3. Агент рассматривает заявление в течение 5 рабочих дней и уведомляет Клиента о решении.
        </p>
        <p className="text-muted-foreground">
          4.4. При одобрении возврата Агент инициирует возврат через платёжную систему ЮKassa в течение 1 рабочего дня.
          Срок фактического зачисления денег на карту зависит от банка Клиента (обычно 3–10 дней).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Особенности возврата при агентской схеме</h2>
        <p className="text-muted-foreground">
          5.1. Агент возвращает Клиенту деньги из собственных средств, а затем удерживает с Инструктора штраф{" "}
          <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы заявки при неявке или поздней отмене (из
          будущих выплат).
        </p>
        <p className="text-muted-foreground">
          5.2. Комиссия агента в размере {PLATFORM_FEE_PERCENT}% возврату не подлежит, если отмена произошла менее чем
          за {CANCEL_CLIENT_FULL_REFUND_HOURS} ч (поскольку работа по бронированию уже выполнена). При отмене за{" "}
          {CANCEL_CLIENT_FULL_REFUND_HOURS} ч и более комиссия возвращается полностью.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. Ответственность</h2>
        <p className="text-muted-foreground">
          6.1. За нарушение сроков возврата Агент уплачивает пеню в размере 0,1% от суммы возврата за каждый день
          просрочки, но не более суммы возврата.
        </p>
        <p className="text-muted-foreground">
          6.2. Споры о качестве услуг рассматриваются с участием обеих сторон. Если Инструктор отказывается возвращать
          деньги, Агент возвращает Клиенту деньги за свой счёт и затем взыскивает убытки с Инструктора в судебном
          порядке.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. Контакты для связи по возвратам</h2>
        <p className="text-muted-foreground">
          Email: <strong>{LEGAL_AGENT.email}</strong>
          <br />
          Телефон: <strong>{LEGAL_AGENT.phone}</strong>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">8. Заключительные положения</h2>
        <p className="text-muted-foreground">
          8.1. Во всём, что не урегулировано настоящими Правилами, стороны руководствуются законодательством РФ.
        </p>
        <p className="text-muted-foreground">
          8.2. Актуальная версия Правил всегда доступна на этой странице. Датой последнего обновления является{" "}
          06.06.2026.
        </p>
      </section>
    </LegalDocLayout>
  );
}
