import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_AGENT, LEGAL_SITE_URL, legalRegisteredAddress } from "@/lib/legal-entity";
import { LEGAL_ROUTES } from "@/lib/legal";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных",
  description: "Порядок обработки ПДн пользователей uTrainer",
};

export default function PrivacyPolicyPage() {
  const address = legalRegisteredAddress();

  return (
    <LegalDocLayout title="Политика обработки персональных данных">
      <p className="text-muted-foreground">
        Настоящая Политика определяет порядок обработки персональных данных Клиентов и пользователей Сайта{" "}
        <a className="text-accent underline" href={LEGAL_SITE_URL}>
          {LEGAL_SITE_URL}
        </a>{" "}
        (далее — «Сайт») и меры по обеспечению их безопасности.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Общие положения</h2>
        <p className="text-muted-foreground">
          1.1. Оператором персональных данных является <strong>{LEGAL_AGENT.fullName}</strong> (ИНН {LEGAL_AGENT.inn}).
        </p>
        <p className="text-muted-foreground">
          1.2. Настоящая Политика действует в отношении всех персональных данных, которые Оператор может получить от
          посетителей Сайта, Клиентов, Инструкторов.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Персональные данные, обрабатываемые Оператором</h2>
        <p className="text-muted-foreground">2.1. Оператор может собирать и обрабатывать:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>фамилию, имя, отчество;</li>
          <li>контактный телефон, адрес электронной почты;</li>
          <li>адрес проживания (для определения места проведения занятий);</li>
          <li>историю заказов, комментарии.</li>
        </ul>
        <p className="text-muted-foreground">
          2.2. Для Инструкторов дополнительно: ИНН, статус самозанятого/ИП, реквизиты для выплат.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Цели обработки персональных данных</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>заключение и исполнение договора-оферты (бронирование, оплата, возвраты);</li>
          <li>связь с Клиентом (подтверждение записи, уведомления об изменении статуса заказа);</li>
          <li>выплата вознаграждения Инструкторам;</li>
          <li>улучшение работы Сайта и аналитика.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Правовые основания обработки</h2>
        <p className="text-muted-foreground">
          4.1. Обработка осуществляется с согласия субъекта (путём проставления галочки при заказе, а также при
          регистрации/заполнении анкеты инструктора).
        </p>
        <p className="text-muted-foreground">
          4.2. Согласие считается данным на неопределённый срок, но может быть отозвано письменным уведомлением на email
          Оператора: <strong>{LEGAL_AGENT.email}</strong>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Порядок и условия обработки</h2>
        <p className="text-muted-foreground">
          5.1. Данные обрабатываются с использованием автоматизированных систем и без них (бумажные носители — только при
          необходимости).
        </p>
        <p className="text-muted-foreground">
          5.2. Доступ к персональным данным имеют только сотрудники (администраторы) Оператора, а также Инструкторы — в
          части, необходимой для исполнения заказа (имя, телефон, адрес занятия).
        </p>
        <p className="text-muted-foreground">
          5.3. Оператор принимает технические меры для защиты данных от несанкционированного доступа (шифрование трафика
          HTTPS, резервное копирование, антивирусное ПО).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. Передача персональных данных третьим лицам</h2>
        <p className="text-muted-foreground">
          6.1. Оператор передаёт данные Инструктору (имя, телефон, адрес) для возможности проведения занятия.
        </p>
        <p className="text-muted-foreground">
          6.2. Платёжные данные (номера карт) не обрабатываются Оператором, они передаются напрямую платёжной системе
          ЮKassa.
        </p>
        <p className="text-muted-foreground">
          6.3. По требованию уполномоченных органов данные могут быть переданы в соответствии с законодательством РФ.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. Хранение и уничтожение</h2>
        <p className="text-muted-foreground">
          7.1. Данные хранятся в течение всего срока действия договора и 5 лет после последнего взаимодействия (для
          соблюдения налогового законодательства).
        </p>
        <p className="text-muted-foreground">
          7.2. По истечении срока хранения данные уничтожаются или обезличиваются.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">8. Права субъекта</h2>
        <p className="text-muted-foreground">
          8.1. Клиент вправе запросить информацию о своих данных, потребовать их исправления или удаления, направив запрос
          на email <strong>{LEGAL_AGENT.email}</strong>.
        </p>
        <p className="text-muted-foreground">8.2. Оператор обязан ответить в течение 30 дней.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">9. Контактная информация</h2>
        <p className="text-muted-foreground">
          По вопросам обработки персональных данных обращаться: <strong>{LEGAL_AGENT.email}</strong>, телефон{" "}
          <strong>{LEGAL_AGENT.phone}</strong>.
        </p>
        <p className="text-muted-foreground">Адрес для письменных обращений: {address}.</p>
      </section>

      <p className="text-xs text-muted-foreground">
        Редакция от 04.06.2026. Оформление заказа при принятии{" "}
        <Link href={LEGAL_ROUTES.oferta} className="underline">
          оферты
        </Link>{" "}
        подразумевает ознакомление с настоящей Политикой.
      </p>
    </LegalDocLayout>
  );
}
