import type { Metadata } from "next";
import Link from "next/link";

import { roskomnadzorRegistryNumber } from "@/lib/legal-config";
import { LEGAL_AGENT, LEGAL_SITE_URL, legalRegisteredAddress } from "@/lib/legal-entity";
import { LEGAL_ROUTES } from "@/lib/legal";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных",
  description: "Порядок обработки ПДн пользователей uTrainer",
};

export default function PrivacyPolicyPage() {
  const address = legalRegisteredAddress();
  const pdnRegistry = roskomnadzorRegistryNumber();

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
        {pdnRegistry ? (
          <p className="text-muted-foreground">
            1.3. Оператор уведомил Роскомнадзор об обработке персональных данных (рег. номер {pdnRegistry}).
          </p>
        ) : (
          <p className="text-muted-foreground">
            1.3. Оператор уведомил Роскомнадзор об обработке персональных данных (рег. номер будет указан после
            получения уведомления).
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Персональные данные, обрабатываемые Оператором</h2>
        <p className="text-muted-foreground">2.1. Оператор может собирать и обрабатывать:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>фамилию, имя, отчество;</li>
          <li>контактный телефон, адрес электронной почты;</li>
          <li>адрес проживания (для определения места проведения занятий);</li>
          <li>
            <strong>геолокацию</strong> (координаты с согласия браузера — для карты и подбора ближайших инструкторов);
          </li>
          <li>
            <strong>идентификаторы устройств и сессий</strong> (cookies, user-agent, IP-адрес при обращении к Сайту);
          </li>
          <li>
            <strong>push-токены</strong> (подписки Web Push для уведомлений о заказах и напоминаниях);
          </li>
          <li>историю заказов, комментарии, переписку с поддержкой.</li>
        </ul>
        <p className="text-muted-foreground">
          2.2. Для Инструкторов дополнительно: ИНН, статус самозанятого/ИП, реквизиты для выплат, документы
          (страхование, справки).
        </p>
        <p className="text-muted-foreground">
          2.3. <strong>Геолокация</strong> запрашивается отдельно через стандартный диалог браузера. Отказ не блокирует
          основной функционал (регистрация, заказы, оплата), но ограничивает работу карты: не отображаются ближайшие
          инструкторы и точка «где я».
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Цели обработки персональных данных</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>заключение и исполнение договора-оферты (бронирование, оплата, возвраты);</li>
          <li>связь с Клиентом (подтверждение записи, уведомления об изменении статуса заказа);</li>
          <li>
            <strong>показ ближайших инструкторов на карте</strong> и расчёт расстояния до точки встречи;
          </li>
          <li>
            <strong>отправка SMS</strong> (коды входа, сервисные уведомления) и <strong>push-уведомлений</strong> о
            заявках, напоминаниях о занятиях;
          </li>
          <li>выплата вознаграждения Инструкторам;</li>
          <li>обработка обращений в службу поддержки;</li>
          <li>улучшение работы Сайта и аналитика.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Правовые основания обработки</h2>
        <p className="text-muted-foreground">
          4.1. Обработка осуществляется с согласия субъекта (путём проставления галочки при заказе, записи на
          мероприятие, а также при регистрации/заполнении анкеты инструктора). Геолокация — отдельное согласие
          браузера.
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
          6.1. Оператор передаёт данные <strong>Инструктору</strong> (имя, телефон, адрес/координаты встречи) для
          проведения занятия или мероприятия.
        </p>
        <p className="text-muted-foreground">
          6.2. <strong>ЮKassa</strong> (НКО «ЮМани») — приём оплаты и возвратов: сумма, идентификатор заказа; данные
          банковской карты обрабатываются только на стороне ЮKassa.
        </p>
        <p className="text-muted-foreground">
          6.3. <strong>Twilio</strong> или иной SMS-провайдер (по настройке) — номер телефона и текст сервисного
          сообщения для кодов входа.
        </p>
        <p className="text-muted-foreground">
          6.4. <strong>SMTP-хостинг</strong> (почтовый сервер оператора, например Beget) — адрес email, имя, текст
          писем (сброс пароля, уведомления).
        </p>
        <p className="text-muted-foreground">
          6.5. <strong>MAX</strong> (Bot API) — текст обращений в поддержку, email/имя пользователя при создании
          тикета.
        </p>
        <p className="text-muted-foreground">
          6.6. <strong>Яндекс.Карты</strong> — координаты и адреса для отображения карты и геокодирования (при
          использовании API карт).
        </p>
        <p className="text-muted-foreground">
          6.7. <strong>Web Push</strong> (браузерные push-сервисы Google/Mozilla и др.) — push-токен подписки и текст
          уведомления.
        </p>
        <p className="text-muted-foreground">
          6.8. <strong>Google OAuth</strong> (при входе через Google) — email, имя, идентификатор аккаунта Google.
        </p>
        <p className="text-muted-foreground">
          6.9. По требованию уполномоченных органов данные могут быть переданы в соответствии с законодательством РФ.
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
        Редакция от 06.06.2026. Оформление заказа при принятии{" "}
        <Link href={LEGAL_ROUTES.oferta} className="underline">
          оферты
        </Link>{" "}
        подразумевает ознакомление с настоящей Политикой.
      </p>
    </LegalDocLayout>
  );
}
