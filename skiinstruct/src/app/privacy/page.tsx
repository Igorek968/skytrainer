import type { Metadata } from "next";
import Link from "next/link";

import { formatLegalEditionDate, roskomnadzorRegistryNumber } from "@/lib/legal-config";
import { LEGAL_AGENT, LEGAL_SITE_URL, legalRegisteredAddress } from "@/lib/legal-entity";
import { LEGAL_ROUTES } from "@/lib/legal";
import { pageMetadata, SEO_PAGES } from "@/lib/seo";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";

export const metadata: Metadata = pageMetadata(SEO_PAGES.privacy);

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
          1.1. Оператором персональных данных является <strong>{LEGAL_AGENT.fullName}</strong> (ИНН {LEGAL_AGENT.inn},
          ОГРН {LEGAL_AGENT.ogrn}), адрес: {address}.
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
        <p className="text-muted-foreground">
          2.4. <strong>Cookies и локальное хранилище</strong> используются для входа в аккаунт, безопасности сессии,
          сохранения настроек и реферальной программы (cookie <code>utr_ref</code>). При первом посещении Сайт показывает
          уведомление; продолжая пользоваться сервисом или нажимая «Принять», вы соглашаетесь с настоящей Политикой.
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
            <strong>push-уведомления</strong> о заявках и напоминаниях о занятиях;
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
          4.2. Обработка также осуществляется в случаях, когда она необходима для исполнения договора, стороной которого
          является субъект персональных данных (п. 5 ч. 1 ст. 6 ФЗ № 152‑ФЗ).
        </p>
        <p className="text-muted-foreground">
          4.3. Согласие считается данным на неопределённый срок, но может быть отозвано письменным уведомлением на email
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
          5.2. Доступ к персональным данным имеют только уполномоченные лица Оператора (администраторы платформы), а также
          Инструкторы — в части, необходимой для исполнения заказа (имя, телефон, адрес/координаты встречи).
        </p>
        <p className="text-muted-foreground">
          5.3. Персональные данные хранятся в информационной системе персональных данных (ИСПДн) платформы{" "}
          <strong>ТвойТренер.рф</strong> на арендованном виртуальном сервере (VPS) на территории Российской Федерации.
          Инфраструктуру размещения предоставляет хостинг-провайдер <strong>ООО «Бегет»</strong> (ИНН 7801451618); ООО
          «Бегет» не является оператором персональных данных и не определяет цели обработки. Основное хранилище — СУБД
          PostgreSQL; отдельное шифрование носителей и полей базы данных не применяется.
        </p>
        <p className="text-muted-foreground">
          5.4. Трансграничная передача персональных данных при размещении ИСПДн на серверах в РФ Оператором не
          осуществляется. Отдельные сведения могут передаваться зарубежным сервисам только в случаях, указанных в разделе
          7 (например, Web Push, Google OAuth), при наличии согласия или иного основания по закону.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          6. Обеспечение безопасности персональных данных (ПП РФ № 1119, Приказ ФСТЭК № 21)
        </h2>
        <p className="text-muted-foreground">
          6.1. Оператор обеспечивает безопасность персональных данных в соответствии с Федеральным законом от 27.07.2006
          № 152‑ФЗ, Постановлением Правительства РФ от 01.11.2012 № 1119 и Приказом ФСТЭК России от 18.02.2013 № 21.
        </p>
        <p className="text-muted-foreground">
          6.2. Уровень защищённости ИСПДн: <strong>УЗ‑3</strong> (иные персональные данные; субъекты — клиенты и
          инструкторы; число субъектов до 100 000; актуальны угрозы <strong>3‑го типа</strong> — внешний нарушитель без
          физического доступа к средствам обработки).
        </p>
        <p className="font-medium text-foreground">Организационные меры:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>назначение ответственного за организацию обработки ПДн (оператор — {LEGAL_AGENT.shortName});</li>
          <li>настоящая Политика и локальные правила доступа к ИСПДн;</li>
          <li>ограничение круга лиц, допущенных к ПДн;</li>
          <li>учёт обращений субъектов и сроков хранения;</li>
          <li>реагирование на обращения и запросы субъектов в срок до 30 дней.</li>
        </ul>
        <p className="font-medium text-foreground">Технические меры:</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>защищённый канал передачи данных — протокол <strong>TLS (HTTPS)</strong>;</li>
          <li>аутентификация пользователей и разграничение доступа по ролям;</li>
          <li>хранение паролей в виде криптографического хеша <strong>bcrypt</strong>;</li>
          <li>резервное копирование;</li>
          <li>антивирусная защита инфраструктуры;</li>
          <li>ограничение сетевого доступа к серверу и СУБД.</li>
        </ul>
        <p className="text-muted-foreground">
          6.3. <strong>Средства криптографической защиты информации (СКЗИ), сертифицированные ФСБ России, не
          применяются.</strong> Для защиты канала передачи используется протокол TLS (HTTPS), сертификаты Let&apos;s
          Encrypt, веб-сервер Caddy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. Передача персональных данных третьим лицам</h2>
        <p className="text-muted-foreground">
          7.1. Оператор передаёт данные <strong>Инструктору</strong> (имя, адрес/координаты встречи) для проведения
          занятия или мероприятия. По заказу связь Инструктора с Клиентом — через чат (телефон Клиента Инструктору не
          раскрывается). <strong>Клиенту</strong> после оплаты может быть показан телефон Инструктора по явному запросу
          («Позвонить»). По записи на мероприятие телефон второй стороны может быть доступен участникам активной заявки
          по запросу в интерфейсе, также доступен чат. Номер не публикуется в открытой ленте мероприятий.
        </p>
        <p className="text-muted-foreground">
          7.2. <strong>ЮKassa</strong> (НКО «ЮМани») — приём оплаты и возвратов: сумма, идентификатор заказа; данные
          банковской карты обрабатываются только на стороне ЮKassa.
        </p>
        <p className="text-muted-foreground">
          7.3. <strong>SMTP-хостинг</strong> (почтовый сервер оператора, например Beget) — адрес email, имя, текст
          писем (сброс пароля, уведомления).
        </p>
        <p className="text-muted-foreground">
          7.4. <strong>MAX</strong> (Bot API) — текст обращений в поддержку, email/имя пользователя при создании
          тикета.
        </p>
        <p className="text-muted-foreground">
          7.5. <strong>Яндекс.Карты</strong> — координаты и адреса для отображения карты и геокодирования (при
          использовании API карт).
        </p>
        <p className="text-muted-foreground">
          7.6. <strong>Web Push</strong> (браузерные push-сервисы Google/Mozilla и др.) — push-токен подписки и текст
          уведомления.
        </p>
        <p className="text-muted-foreground">
          7.7. <strong>Google OAuth</strong> (при входе через Google) — email, имя, идентификатор аккаунта Google.
        </p>
        <p className="text-muted-foreground">
          7.8. По требованию уполномоченных органов данные могут быть переданы в соответствии с законодательством РФ.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">8. Хранение, прекращение обработки и уничтожение</h2>
        <p className="text-muted-foreground">
          8.1. Данные хранятся в течение всего срока действия договора и <strong>5 (пяти) лет</strong> после последнего
          взаимодействия с Оператором (для соблюдения налогового и иного законодательства РФ).
        </p>
        <p className="text-muted-foreground">
          8.2. Обработка прекращается при: истечении срока хранения; достижении целей обработки; отзыве согласия
          субъектом (в части, основанной на согласии); удалении учётной записи или по запросу субъекта — в пределах,
          допустимых законом; прекращении деятельности Оператора; иных основаниях, предусмотренных ФЗ № 152‑ФЗ.
        </p>
        <p className="text-muted-foreground">
          8.3. По истечении срока хранения или при наступлении оснований для прекращения обработки данные уничтожаются
          или обезличиваются.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">9. Права субъекта</h2>
        <p className="text-muted-foreground">
          9.1. Субъект персональных данных вправе запросить информацию о своих данных, потребовать их исправления или
          удаления, направив запрос на email <strong>{LEGAL_AGENT.email}</strong> или письменное обращение по адресу
          Оператора.
        </p>
        <p className="text-muted-foreground">9.2. Оператор обязан ответить в течение 30 дней.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">10. Контактная информация</h2>
        <p className="text-muted-foreground">
          По вопросам обработки персональных данных обращаться: <strong>{LEGAL_AGENT.email}</strong>.
        </p>
        <p className="text-muted-foreground">Адрес для письменных обращений: {address}.</p>
      </section>

      <p className="text-xs text-muted-foreground">
        Редакция от {formatLegalEditionDate()}. Оформление заказа при принятии{" "}
        <Link href={LEGAL_ROUTES.oferta} className="underline">
          оферты
        </Link>{" "}
        подразумевает ознакомление с настоящей Политикой.
      </p>
    </LegalDocLayout>
  );
}
