import type { Metadata } from "next";
import Link from "next/link";

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
          3.1. Настоящая Оферта считается акцептованной (принятой) Клиентом в момент нажатия кнопки «Оплатить» или
          «Заказать» на странице оформления заказа и проставления отметки о согласии с условиями Оферты и{" "}
          <Link href={LEGAL_ROUTES.privacy} className="text-accent underline">
            Политикой обработки персональных данных
          </Link>
          .
        </p>
        <p className="text-muted-foreground">
          3.2. Акцепт означает полное и безоговорочное согласие Клиента со всеми условиями Оферты.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Стоимость и порядок оплаты</h2>
        <p className="text-muted-foreground">4.1. Общая стоимость заказа складывается из:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>вознаграждения Инструктору (указано в карточке занятия);</li>
          <li>
            вознаграждения Агента в размере {LEGAL_AGENT.agentFeePercent}% от цены занятия (включено в итоговую сумму).
          </li>
        </ul>
        <p className="text-muted-foreground">
          4.2. Оплата производится Клиентом единовременно в российских рублях через сервис ЮKassa (платёжную систему) с
          использованием банковской карты.
        </p>
        <p className="text-muted-foreground">
          4.3. Оплата считается произведённой после поступления денежных средств на расчётный счёт Агента:{" "}
          <strong>{LEGAL_AGENT.bankAccount}</strong> в {LEGAL_AGENT.bankName}, БИК {LEGAL_AGENT.bik}.
        </p>
        <p className="text-muted-foreground">
          4.4. После успешной оплаты Агент направляет Клиенту электронный чек (через ЮKassa) и подтверждает
          бронирование времени у Инструктора.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Права и обязанности сторон</h2>
        <p className="font-medium text-foreground">Агент обязуется:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>обеспечить функционирование Сайта, возможность бронирования и оплаты;</li>
          <li>передать заявку Инструктору и подтвердить Клиенту запись;</li>
          <li>
            при отказе Клиента от занятия за <strong>менее чем 24 часа</strong> — вернуть деньги за вычетом фактически
            понесённых расходов (штрафа Инструктора) согласно{" "}
            <Link href={LEGAL_ROUTES.returns} className="text-accent underline">
              Правилам возврата
            </Link>
            .
          </li>
        </ul>
        <p className="font-medium text-foreground">Инструктор обязуется:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>провести занятие в забронированное время;</li>
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
        <h2 className="text-lg font-semibold">7. Порядок возврата денежных средств</h2>
        <p className="text-muted-foreground">
          7.1. Возврат производится в соответствии с{" "}
          <Link href={LEGAL_ROUTES.returns} className="text-accent underline">
            Правилами возврата
          </Link>
          , размещёнными на Сайте.
        </p>
        <p className="text-muted-foreground">
          7.2. При отмене занятия Клиентом за <strong>24 часа и более</strong> до начала — возвращается 100% стоимости.
        </p>
        <p className="text-muted-foreground">
          7.3. При отмене менее чем за 24 часа — возвращается 50% стоимости (остальное удерживается Инструктором как
          компенсация за резервирование времени).
        </p>
        <p className="text-muted-foreground">
          7.4. В случае неоказания услуги по вине Инструктора — возвращается 100% стоимости.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">8. Прочие условия</h2>
        <p className="text-muted-foreground">
          8.1. Агент вправе в одностороннем порядке изменять условия Оферты с уведомлением на Сайте не менее чем за 3
          дня до вступления изменений в силу.
        </p>
        <p className="text-muted-foreground">
          8.2. Все споры подлежат рассмотрению по месту регистрации Агента (Республика Коми, г. Сыктывкар, если иное не
          установлено законом).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">9. Реквизиты и контакты Агента</h2>
        <LegalRequisitesBlock />
      </section>

      <p className="text-xs text-muted-foreground">Редакция от 04.06.2026.</p>
    </LegalDocLayout>
  );
}
