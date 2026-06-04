import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_AGENT, LEGAL_SITE_URL } from "@/lib/legal-entity";
import { PLATFORM_FEE_PERCENT } from "@/lib/legal-config";
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
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Основания для возврата</h2>
        <p className="font-medium text-foreground">2.1. Отмена занятия Клиентом:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            за <strong>24 часа и более</strong> до начала занятия – возвращается 100% оплаченной суммы;
          </li>
          <li>
            менее чем за <strong>24 часа</strong> – возвращается 50% суммы (50% удерживается Инструктором как компенсация
            за резервирование времени).
          </li>
        </ul>
        <p className="font-medium text-foreground">2.2. Отмена занятия Инструктором:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            возвращается 100% оплаченной суммы, если Инструктор предупредил об отмене менее чем за 3 часа до занятия или
            не явился. В этом случае Агент также предлагает альтернативного Инструктора или перенос времени без
            доплаты.
          </li>
        </ul>
        <p className="font-medium text-foreground">2.3. Некачественно оказанная услуга:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            Если Клиент докажет, что занятие проведено с нарушением условий (небезопасно, инструктор некомпетентен),
            Агент организует частичный или полный возврат по итогам разбирательства.
          </li>
        </ul>
        <p className="font-medium text-foreground">2.4. Отказ от услуг в течение 7 дней без проведения занятия:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            В соответствии со ст. 32 ЗоЗПП Клиент вправе отказаться от исполнения договора в любое время до начала
            занятия. Возврат производится за вычетом фактических расходов Агента (включая штраф Инструктора), что в
            обычной ситуации составляет 0% (если занятие ещё не началось и отмена более чем за 24 часа – возврат 100%).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Порядок действий для возврата</h2>
        <p className="text-muted-foreground">
          3.1. Клиент направляет заявление на возврат на адрес электронной почты <strong>{LEGAL_AGENT.email}</strong> или
          через форму обратной связи в личном кабинете.
        </p>
        <p className="text-muted-foreground">
          3.2. В заявлении необходимо указать: ФИО, номер заказа, причину возврата, желаемую сумму возврата (если
          частичный).
        </p>
        <p className="text-muted-foreground">
          3.3. Агент рассматривает заявление в течение 5 рабочих дней и уведомляет Клиента о решении.
        </p>
        <p className="text-muted-foreground">
          3.4. При одобрении возврата Агент инициирует возврат через платёжную систему ЮKassa в течение 1 рабочего дня.
          Срок фактического зачисления денег на карту зависит от банка Клиента (обычно 3–10 дней).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Особенности возврата при агентской схеме</h2>
        <p className="text-muted-foreground">
          4.1. Агент возвращает Клиенту деньги из собственных средств, а затем взыскивает соответствующую часть с
          Инструктора (по отдельному соглашению).
        </p>
        <p className="text-muted-foreground">
          4.2. Комиссия агента в размере {PLATFORM_FEE_PERCENT}% возврату не подлежит, если отмена произошла менее чем
          за 24 часа (поскольку работа по бронированию уже выполнена). При отмене за 24 часа и более комиссия
          возвращается полностью.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Ответственность</h2>
        <p className="text-muted-foreground">
          5.1. За нарушение сроков возврата Агент уплачивает пеню в размере 0,1% от суммы возврата за каждый день
          просрочки, но не более суммы возврата.
        </p>
        <p className="text-muted-foreground">
          5.2. Споры о качестве услуг рассматриваются с участием обеих сторон. Если Инструктор отказывается возвращать
          деньги, Агент возвращает Клиенту деньги за свой счёт и затем взыскивает убытки с Инструктора в судебном
          порядке.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. Контакты для связи по возвратам</h2>
        <p className="text-muted-foreground">
          Email: <strong>{LEGAL_AGENT.email}</strong>
          <br />
          Телефон: <strong>{LEGAL_AGENT.phone}</strong>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. Заключительные положения</h2>
        <p className="text-muted-foreground">
          7.1. Во всём, что не урегулировано настоящими Правилами, стороны руководствуются законодательством РФ.
        </p>
        <p className="text-muted-foreground">
          7.2. Актуальная версия Правил всегда доступна на этой странице. Датой последнего обновления является
          04.06.2026.
        </p>
      </section>
    </LegalDocLayout>
  );
}
