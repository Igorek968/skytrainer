import type { Metadata } from "next";
import Link from "next/link";

import {
  CLIENT_OFFER_VERSION,
  EVENT_CANCEL_FULL_REFUND_HOURS,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  INSTRUCTOR_NO_SHOW_PENALTY_PERCENT,
  PAYOUT_MIN_WITHDRAWAL_RUB,
  PLATFORM_FEE_PERCENT,
  REFERRAL_COOKIE_MAX_AGE_DAYS,
  REFERRAL_MAX_ORDERS_PER_CLIENT,
  REFERRAL_REWARD_RUB,
} from "@/lib/legal-config";
import { LEGAL_AGENT, LEGAL_SITE_URL } from "@/lib/legal-entity";
import { LegalRequisitesBlock } from "@/shared/legal/legal-requisites-block";
import { LEGAL_ROUTES } from "@/lib/legal";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";

export const metadata: Metadata = {
  title: "Договор-оферта",
  description: "Условия подбора инструктора, бронирования и оплаты на uTrainer",
};

export default function PublicOfferPage() {
  return (
    <LegalDocLayout title="Договор-оферта на оказание услуг по подбору инструктора">
      <p className="text-muted-foreground">
        <strong>{LEGAL_AGENT.fullName}</strong> (ИНН {LEGAL_AGENT.inn}, ОГРН {LEGAL_AGENT.ogrn}), действующий на
        основании свидетельства о государственной регистрации, публикует настоящий Договор-оферту (далее — «Оферта») о
        нижеследующем.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Термины и определения</h2>
        <p className="text-muted-foreground">
          <strong>Сайт</strong> — интернет-сайт, расположенный по адресу{" "}
          <a className="text-accent underline" href={LEGAL_SITE_URL}>
            {LEGAL_SITE_URL}
          </a>
          .
          <br />
          <strong>Агент</strong> — {LEGAL_AGENT.shortName}, оказывающий услуги по подбору инструктора и приёму оплаты.
          <br />
          <strong>Инструктор</strong> — физическое лицо, зарегистрированное в качестве самозанятого (НПД) или
          индивидуального предпринимателя, оказывающее услуги по обучению горным лыжам/сноуборду.
          <br />
          <strong>Клиент</strong> — дееспособное физическое лицо, желающее получить услуги Инструктора.
          <br />
          <strong>Мероприятие</strong> — групповое или индивидуальное событие (мастер-класс, выезд, тренировка с
          фиксированным временем), размещённое инструктором в разделе «Мероприятия» на Сайте.
          <br />
          <strong>Услуги Агента</strong> — информационное сопровождение, бронирование, приём оплаты и урегулирование
          споров.
          <br />
          <strong>Услуги Инструктора</strong> — непосредственное обучение катанию на горных лыжах/сноуборду.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Предмет Оферты</h2>
        <p className="text-muted-foreground">
          2.1. Агент обязуется от имени и в интересах Клиента подобрать Инструктора, забронировать время занятия,
          принять оплату, а Клиент обязуется оплатить Услуги Агента и Услуги Инструктора в порядке, предусмотренном
          Офертой.
        </p>
        <p className="text-muted-foreground">
          2.2. Фактическим исполнителем услуг является Инструктор. Агент не является исполнителем обучающих услуг, а
          лишь выступает посредником.
        </p>
        <p className="text-muted-foreground">
          2.3. Полный перечень Инструкторов, их описание, стоимость и время размещены на Сайте.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Порядок заключения Оферты</h2>
        <p className="text-muted-foreground">
          3.1. Настоящая Оферта считается акцептованной (принятой) Клиентом в момент нажатия кнопки «Оплатить»,
          «Заказать» или «Записаться» и проставления отметки о согласии с условиями Оферты,{" "}
          <Link href={LEGAL_ROUTES.privacy} className="text-accent underline">
            Политикой обработки персональных данных
          </Link>{" "}
          и{" "}
          <Link href={LEGAL_ROUTES.returns} className="text-accent underline">
            Правилами возврата
          </Link>
          .
        </p>
        <p className="text-muted-foreground">
          3.2. Акцепт означает полное и безоговорочное согласие Клиента со всеми условиями Оферты.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Стоимость, комиссия и порядок оплаты</h2>
        <p className="text-muted-foreground">
          4.1. <strong>Занятия с инструктором.</strong> Итоговая стоимость заказа, отображаемая Клиенту при оплате,
          включает:
        </p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>вознаграждение Инструктору (указано в карточке занятия);</li>
          <li>
            вознаграждение Агента (комиссию платформы) в размере <strong>{PLATFORM_FEE_PERCENT}%</strong> от стоимости
            занятия — удерживается Агентом и включена в итоговую сумму к оплате.
          </li>
        </ul>
        <p className="text-muted-foreground">
          4.2. <strong>Мероприятия.</strong> Стоимость участия, указанная при записи, также включает комиссию Агента в
          размере <strong>{PLATFORM_FEE_PERCENT}%</strong> от цены участия для каждого участника. Комиссия удерживается
          Агентом после проведения мероприятия и подтверждения участия; Инструктору перечисляется сумма за вычетом
          комиссии с каждого оплатившего участника (подробнее — в разделе 8).
        </p>
        <p className="text-muted-foreground">
          4.3. Оплата занятия с инструктором производится Клиентом единовременно в российских рублях через сервис
          ЮKassa (платёжную систему) с использованием банковской карты.
        </p>
        <p className="text-muted-foreground">
          4.4. Оплата считается произведённой после поступления денежных средств на расчётный счёт Агента:{" "}
          <strong>{LEGAL_AGENT.bankAccount}</strong> в {LEGAL_AGENT.bankName}, БИК {LEGAL_AGENT.bik}.
        </p>
        <p className="text-muted-foreground">
          4.5. После успешной оплаты Агент направляет Клиенту электронный чек (через ЮKassa) и подтверждает
          бронирование времени у Инструктора.
        </p>
        <p className="text-muted-foreground">
          4.6. Клиент вправе использовать накопленный реферальный баланс для частичной или полной оплаты заказа в
          пределах доступной суммы (раздел 9).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Права и обязанности сторон</h2>
        <p className="font-medium text-foreground">Агент обязуется:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>обеспечить функционирование Сайта, возможность бронирования и оплаты;</li>
          <li>передать заявку Инструктору и подтвердить Клиенту запись;</li>
          <li>
            организовать возврат в соответствии с{" "}
            <Link href={LEGAL_ROUTES.returns} className="text-accent underline">
              Правилами возврата
            </Link>
            .
          </li>
        </ul>
        <p className="font-medium text-foreground">Инструктор обязуется:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>провести занятие в забронированное время;</li>
          <li>
            уведомить об отмене не позднее <strong>{INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> до начала занятия;
            при нарушении срока — полный возврат клиенту и штраф{" "}
            <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы заявки согласно{" "}
            <Link href={LEGAL_ROUTES.ofertaInstructor} className="text-accent underline">
              агентскому договору
            </Link>
            ;
          </li>
          <li>иметь статус самозанятого или ИП и предоставлять Клиенту чек по требованию.</li>
        </ul>
        <p className="font-medium text-foreground">Клиент обязуется:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>своевременно оплатить заказ;</li>
          <li>прибыть на занятие вовремя;</li>
          <li>соблюдать технику безопасности.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. Ответственность</h2>
        <p className="text-muted-foreground">
          6.1. Агент не несёт ответственность за качество услуг, оказываемых Инструктором, но содействует в разрешении
          споров (помогает с возвратом, связывается с Инструктором).
        </p>
        <p className="text-muted-foreground">
          6.2. За неисполнение или ненадлежащее исполнение обязательств стороны несут ответственность в соответствии с
          законодательством РФ.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. Порядок возврата денежных средств (занятия)</h2>
        <p className="text-muted-foreground">
          7.1. Возврат производится в соответствии с{" "}
          <Link href={LEGAL_ROUTES.returns} className="text-accent underline">
            Правилами возврата
          </Link>
          , размещёнными на Сайте.
        </p>
        <p className="text-muted-foreground">
          7.2. <strong>После принятия заявки инструктором</strong> заказ невозвратный при отмене по инициативе клиента.
        </p>
        <p className="text-muted-foreground">
          7.3. До принятия заявки инструктором, при истечении срока ожидания ответа инструктора, при технической отмене
          платформой или если оплата не была произведена — <strong>100%</strong> уплаченной суммы (полный возврат или
          отмена без списания). Расчёт выполняется автоматически в сервисе.
        </p>
        <p className="text-muted-foreground">
          7.4. Отмена по вине инструктора или платформы — <strong>100%</strong>. Опоздание инструктора более{" "}
          <strong>{INSTRUCTOR_LATE_GRACE_MINUTES} мин</strong> от ETA — право клиента на полный возврат.
        </p>
        <p className="text-muted-foreground">
          7.5. Отмена инструктором менее чем за <strong>{INSTRUCTOR_CANCEL_NOTICE_HOURS} ч</strong> или неявка на
          занятие — полный возврат клиенту и штраф <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы
          заявки (удерживается платформой из выплат инструктору).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">8. Мероприятия</h2>
        <p className="text-muted-foreground">
          8.1. <strong>Мероприятием</strong> считается событие, созданное инструктором в сервисе: с указанием даты,
          времени, места (или зоны на карте), стоимости участия и лимита мест. Может включать несколько временных
          слотов («выходов»).
        </p>
        <p className="text-muted-foreground">
          8.2. <strong>Запись</strong> оформляется на Сайте с согласием с настоящей Офертой и Политикой ПДн. Для
          платных мероприятий оплата производится <strong>после проведения мероприятия</strong>: клиент подтверждает
          участие, после чего списание проходит через ЮKassa.
        </p>
        <p className="text-muted-foreground">
          8.3. <strong>Отмена записи клиентом</strong>: за <strong>{EVENT_CANCEL_FULL_REFUND_HOURS} ч и более</strong>{" "}
          до начала — полный возврат (если оплата уже проведена); менее чем за{" "}
          <strong>{EVENT_CANCEL_FULL_REFUND_HOURS} ч</strong> — без возврата. Бесплатные записи отменяются без
          финансовых последствий.
        </p>
        <p className="text-muted-foreground">
          8.4. <strong>Отмена мероприятия инструктором</strong> — полный возврат всем оплатившим участникам. Подробности
          — в{" "}
          <Link href={LEGAL_ROUTES.returns} className="text-accent underline">
            Правилах возврата
          </Link>
          .
        </p>
        <p className="text-muted-foreground">
          8.5. <strong>Неявка инструктора на мероприятие</strong> — клиент вправе запросить полный возврат после
          наступления времени начала; с инструктора удерживается штраф{" "}
          <strong>{INSTRUCTOR_NO_SHOW_PENALTY_PERCENT}%</strong> от суммы записи в пользу платформы.
        </p>
        <p className="text-muted-foreground">
          8.6. <strong>Комиссия Агента по мероприятиям</strong> — <strong>{PLATFORM_FEE_PERCENT}%</strong> от стоимости
          участия каждого клиента, оплатившего запись после проведения мероприятия. Комиссия удерживается Агентом при
          расчётах с Инструктором; доля Инструктора составляет оставшиеся <strong>{100 - PLATFORM_FEE_PERCENT}%</strong>{" "}
          от суммы, уплаченной соответствующим участником. На бесплатные записи комиссия не начисляется.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">9. Реферальная программа</h2>
        <p className="text-muted-foreground">
          9.1. Зарегистрированные пользователи (Клиенты и Инструкторы) могут участвовать в реферальной программе
          платформы, делясь персональной ссылкой с параметром <code className="text-foreground">?ref=</code> и кодом
          приглашения.
        </p>
        <p className="text-muted-foreground">
          9.2. При переходе по реферальной ссылке сведения о коде приглашения сохраняются в cookie браузера в течение{" "}
          <strong>{REFERRAL_COOKIE_MAX_AGE_DAYS} календарных дней</strong> с первого перехода. Если новый Клиент
          регистрируется в этот период, он связывается с пригласившим пользователем.
        </p>
        <p className="text-muted-foreground">
          9.3. Пригласившему пользователю (рефереру) начисляется вознаграждение{" "}
          <strong>{REFERRAL_REWARD_RUB} ₽</strong> за каждый из первых{" "}
          <strong>{REFERRAL_MAX_ORDERS_PER_CLIENT}</strong> завершённых и оплаченных заказов приглашённого Клиента,
          оформленных через платформу. Начисление производится автоматически после завершения заказа; вознаграждение не
          начисляется за заказы, по которым произведён полный возврат.
        </p>
        <p className="text-muted-foreground">
          9.4. Накопленный реферальный баланс отображается в личном кабинете. Его можно использовать для оплаты занятий
          на Сайте (списание при оформлении заказа) либо запросить вывод на банковские реквизиты, указанные в личном
          кабинете, при достижении минимальной суммы <strong>{PAYOUT_MIN_WITHDRAWAL_RUB} ₽</strong>. Вывод
          осуществляется вручную Агентом в разумный срок после проверки заявки.
        </p>
        <p className="text-muted-foreground">
          9.5. Агент вправе изменять условия реферальной программы, приостанавливать или прекращать её действие с
          публикацией актуальных условий на Сайте. Начисления по заказам, оформленным до изменения условий, производятся
          по правилам, действовавшим на момент оформления соответствующего заказа, если иное прямо не указано в
          уведомлении об изменении.
        </p>
        <p className="text-muted-foreground">
          9.6. Участие в программе не освобождает стороны от соблюдения законодательства РФ, в том числе налогового;
          пользователь самостоятельно исполняет налоговые обязательства в отношении полученных выплат, если они
          подлежат декларированию.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">10. Прочие условия</h2>
        <p className="text-muted-foreground">
          10.1. Настоящая Оферта регулируется законодательством Российской Федерации (в том числе ст. 437, 438 ГК РФ,
          Закон РФ «О защите прав потребителей» в части, применимой к договору возмездного оказания услуг).
        </p>
        <p className="text-muted-foreground">
          10.2. Агент вправе в одностороннем порядке изменять условия Оферты с уведомлением на Сайте не менее чем за 3
          дня до вступления изменений в силу.
        </p>
        <p className="text-muted-foreground">
          10.3. Все споры подлежат рассмотрению по месту регистрации Агента (Республика Коми, г. Сыктывкар, если иное не
          установлено законом).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">11. Реквизиты и контакты Агента</h2>
        <LegalRequisitesBlock />
      </section>

      <p className="text-xs text-muted-foreground">Редакция от {CLIENT_OFFER_VERSION.replace(/-/g, ".")}.</p>
    </LegalDocLayout>
  );
}
