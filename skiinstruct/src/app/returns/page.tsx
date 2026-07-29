import type { Metadata } from "next";
import Link from "next/link";

import {
  CANCEL_CLIENT_FULL_REFUND_HOURS,
  CANCEL_CLIENT_PARTIAL_PERCENT,
  CANCEL_CLIENT_PARTIAL_REFUND_HOURS,
  EVENT_CANCEL_FULL_REFUND_HOURS,
  formatLegalEditionDate,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
  PLATFORM_FEE_PERCENT,
  QUALITY_CLAIM_MIN_DESCRIPTION_CHARS,
  QUALITY_CLAIM_WINDOW_HOURS,
  QUALITY_INCOMPETENCE_REFUND_PERCENT,
  QUALITY_NO_LESSON_MAX_MINUTES,
  QUALITY_SHORT_LESSON_REFUND_MAX_PERCENT,
  QUALITY_SHORT_LESSON_REFUND_MIN_PERCENT,
  QUALITY_SHORT_LESSON_THRESHOLD_PERCENT,
} from "@/lib/legal-config";
import { qualityClaimCategoryLabels } from "@/lib/refund-policy";
import { LEGAL_AGENT, LEGAL_SITE_URL } from "@/lib/legal-entity";
import { LEGAL_ROUTES } from "@/lib/legal";
import { pageMetadata, SEO_PAGES } from "@/lib/seo";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";

export const metadata: Metadata = pageMetadata(SEO_PAGES.returns);

export default function ReturnsPolicyPage() {
  return (
    <LegalDocLayout title="Правила возврата денежных средств">
      <p className="text-muted-foreground">
        Настоящие Правила являются неотъемлемой частью{" "}
        <Link href={LEGAL_ROUTES.oferta} className="text-accent underline">
          Договора бронирования услуг (публичной оферты)
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
          условиями настоящих Правил и Оферты.
        </p>
        <p className="text-muted-foreground">
          1.2. Возврат осуществляется на ту же банковскую карту, с которой производилась оплата, в срок до{" "}
          <strong>10 рабочих дней</strong> с момента подтверждения отмены (обычно зачисление на карту занимает 3–10
          рабочих дней в зависимости от банка).
        </p>
        <p className="text-muted-foreground">
          1.3. Расчёт суммы возврата при отмене занятий выполняется автоматически по правилам, описанным ниже и
          реализованным в сервисе.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Занятия с инструктором</h2>
        <p className="font-medium text-foreground">2.1. Отмена по инициативе клиента (п. 5.6 Оферты):</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-sm text-muted-foreground">
            <thead>
              <tr className="border-b border-border text-left text-foreground">
                <th className="py-2 pr-4 font-medium">Срок отмены до начала занятия</th>
                <th className="py-2 font-medium">Сумма возврата</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-4">Более {CANCEL_CLIENT_FULL_REFUND_HOURS} часов</td>
                <td className="py-2">
                  <strong className="text-foreground">100%</strong> (полный возврат)
                </td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-4">
                  От {CANCEL_CLIENT_PARTIAL_REFUND_HOURS} до {CANCEL_CLIENT_FULL_REFUND_HOURS} часов
                </td>
                <td className="py-2">
                  <strong className="text-foreground">{CANCEL_CLIENT_PARTIAL_PERCENT}%</strong> от стоимости услуги
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Менее {CANCEL_CLIENT_PARTIAL_REFUND_HOURS} часов</td>
                <td className="py-2">
                  <strong className="text-foreground">Без возврата</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground">
          До принятия заявки инструктором, при истечении срока ожидания ответа инструктора или если оплата не была
          произведена — <strong>100%</strong> уплаченной суммы (полный возврат или отмена без списания).
        </p>
        <p className="font-medium text-foreground">2.2. Отмена занятия инструктором или платформой:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            клиенту возвращается <strong>100%</strong> оплаченной суммы (п. 5.7–5.8 Оферты);
          </li>
          <li>
            если инструктор отменил занятие менее чем за <strong>{INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> до начала
            или не явился — клиенту также возвращается <strong>100%</strong>, а с инструктора удерживается штраф{" "}
            <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы заявки в пользу платформы (из будущих
            выплат), согласно{" "}
            <Link href={LEGAL_ROUTES.ofertaInstructor} className="text-accent underline">
              договору для инструктора
            </Link>
            ; платформа предлагает альтернативного инструктора или перенос без доплаты.
          </li>
        </ul>
        <p className="font-medium text-foreground">2.3. Опоздание инструктора:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            если инструктор не прибыл в течение <strong>{INSTRUCTOR_LATE_GRACE_MINUTES} мин</strong> после заявленного
            ETA и занятие не начато — клиент вправе запросить <strong>полный возврат</strong> в интерфейсе заказа.
          </li>
        </ul>
        <p className="font-medium text-foreground">2.4. Некачественно оказанная услуга (алгоритм в сервисе):</p>
        <p className="text-muted-foreground">
          Претензию можно подать в заказе в течение <strong>{QUALITY_CLAIM_WINDOW_HOURS} ч</strong> после завершения
          занятия, пока выплата инструктору не произведена. Расчёт выполняется автоматически по категории и данным заказа
          (время начала/окончания, длительность, оценка).
        </p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <strong>{qualityClaimCategoryLabels.UNSAFE}</strong> — <strong>100%</strong> при оценке ≤ 2 и описании от{" "}
            {QUALITY_CLAIM_MIN_DESCRIPTION_CHARS} символов;
          </li>
          <li>
            <strong>{qualityClaimCategoryLabels.NO_LESSON}</strong> — <strong>100%</strong>, если урок не начинался или
            длился менее {QUALITY_NO_LESSON_MAX_MINUTES} мин;
          </li>
          <li>
            <strong>{qualityClaimCategoryLabels.SHORT_LESSON}</strong> — от{" "}
            {QUALITY_SHORT_LESSON_REFUND_MIN_PERCENT}% до {QUALITY_SHORT_LESSON_REFUND_MAX_PERCENT}%, если фактическая
            длительность менее {QUALITY_SHORT_LESSON_THRESHOLD_PERCENT}% от заказанной (пропорционально недополученному
            времени);
          </li>
          <li>
            <strong>{qualityClaimCategoryLabels.INCOMPETENCE}</strong> и{" "}
            <strong>{qualityClaimCategoryLabels.WRONG_SERVICE}</strong> —{" "}
            <strong>{QUALITY_INCOMPETENCE_REFUND_PERCENT}%</strong> при оценке ≤ 3 и описании от{" "}
            {QUALITY_CLAIM_MIN_DESCRIPTION_CHARS} символов.
          </li>
        </ul>
        <p className="text-muted-foreground">
          Возврат инициируется через ЮKassa; доля инструктора уменьшается пропорционально. Повторная претензия по одному
          заказу не принимается.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Мероприятия</h2>
        <p className="text-muted-foreground">
          3.1. На записи на мероприятия (групповые выезды, мастер-классы и т.п.) действуют отдельные правила.
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
          через форму обратной связи в личном кабинете. Отмена в интерфейсе заказа инициирует автоматический расчёт.
        </p>
        <p className="text-muted-foreground">
          4.2. В заявлении необходимо указать: ФИО, номер заказа, причину возврата, желаемую сумму возврата (если
          частичный).
        </p>
        <p className="text-muted-foreground">
          4.3. Исполнитель рассматривает заявление в течение 5 рабочих дней и уведомляет Клиента о решении.
        </p>
        <p className="text-muted-foreground">
          4.4. При одобрении возврата Исполнитель инициирует возврат через платёжную систему ЮKassa. Срок фактического
          зачисления денег на карту — до 10 рабочих дней с момента подтверждения отмены.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Особенности возврата</h2>
        <p className="text-muted-foreground">
          5.1. При отмене по вине инструктора Исполнитель возвращает Клиенту деньги, а затем удерживает с Инструктора
          штраф <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы заявки при неявке или поздней отмене
          (из будущих выплат).
        </p>
        <p className="text-muted-foreground">
          5.2. При полном возврате Клиенту возвращается вся уплаченная сумма, включая комиссию платформы (
          {PLATFORM_FEE_PERCENT}%). При частичном возврате ({CANCEL_CLIENT_PARTIAL_PERCENT}%) сумма рассчитывается от
          стоимости оплаченной услуги.
        </p>
        <p className="text-muted-foreground">
          5.3. По мероприятиям комиссия платформы ({PLATFORM_FEE_PERCENT}% от стоимости участия каждого клиента)
          удерживается при расчётах после проведения мероприятия; при полном возврате участнику возвращается уплаченная
          им сумма целиком.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. Ответственность</h2>
        <p className="text-muted-foreground">
          6.1. За нарушение сроков возврата Исполнитель уплачивает пеню в размере 0,1% от суммы возврата за каждый день
          просрочки, но не более суммы возврата.
        </p>
        <p className="text-muted-foreground">
          6.2. Претензии по качеству урока (п. 2.4) рассчитываются автоматически в сервисе; при одобренном возврате
          Исполнитель уменьшает долю Инструктора пропорционально. Споры, не покрытые алгоритмом, — через{" "}
          <Link href={LEGAL_ROUTES.support} className="text-accent underline">
            поддержку
          </Link>{" "}
          в течение 5 рабочих дней.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. Контакты для связи по возвратам</h2>
        <p className="text-muted-foreground">
          Email: <strong>{LEGAL_AGENT.email}</strong>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">8. Заключительные положения</h2>
        <p className="text-muted-foreground">
          8.1. Во всём, что не урегулировано настоящими Правилами, стороны руководствуются законодательством РФ и{" "}
          <Link href={LEGAL_ROUTES.oferta} className="text-accent underline">
            Офертой
          </Link>
          .
        </p>
        <p className="text-muted-foreground">
          8.2. Актуальная версия Правил всегда доступна на этой странице. Датой последнего обновления является{" "}
          {formatLegalEditionDate()}.
        </p>
      </section>
    </LegalDocLayout>
  );
}
