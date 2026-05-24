import type { Metadata } from "next";
import Link from "next/link";

import { legalOperatorName } from "@/lib/legal";
import { LEGAL_ROUTES } from "@/lib/legal";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных",
  description: "152-ФЗ: цели, категории данных, права субъекта",
};

export default function PrivacyPolicyPage() {
  const operator = legalOperatorName();

  return (
    <LegalDocLayout title="Политика обработки персональных данных">
      <p className="text-muted-foreground">
        Настоящая Политика определяет порядок обработки персональных данных (ПДн) пользователей сервиса «Инструктор для
        тебя» в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».
      </p>
      <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Оператор ПДн: <span className="font-medium text-foreground">{operator}</span>. Реквизиты и контакт для обращений
        по ПДн — через{" "}
        <Link href={LEGAL_ROUTES.support} className="text-accent underline">
          поддержку платформы
        </Link>
        .
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Цели обработки</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>регистрация и аутентификация в Сервисе;</li>
          <li>оформление и сопровождение заказов на занятия с инструктором;</li>
          <li>оплата через платёжного партнёра (при подключении);</li>
          <li>обмен сообщениями по заказу и в чате поддержки платформы;</li>
          <li>уведомления о статусах заказа (в т.ч. push при согласии пользователя);</li>
          <li>модерация анкет инструкторов и безопасность Сервиса.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Категории данных</h2>
        <p className="text-muted-foreground">
          Клиенты: ФИО, телефон, email, данные платежей, геолокация (с согласия), история заказов, переписка, cookie,
          IP. Инструкторы: паспортные данные и ИНН — только если загружены для верификации, банковские реквизиты
          (маскированные), фото/видео профиля, документы НПД/ИП и страхования. Маркетинговые рассылки — только при
          отдельном согласии.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2.1. Хранение</h2>
        <p className="text-muted-foreground">
          Данные хранятся на серверах в Российской Федерации (хостинг оператора). Срок — пока действует учётная запись и
          в пределах сроков, установленных законом (в т.ч. для бухгалтерии и споров по заказам).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Правовые основания</h2>
        <p className="text-muted-foreground">
          Обработка осуществляется на основании согласия субъекта ПДн, исполнения договора (оферты) с пользователем, а
          также законных интересов Оператора в части обеспечения работоспособности и безопасности Сервиса.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Передача третьим лицам</h2>
        <p className="text-muted-foreground">
          ПДн могут передаваться инструктору — в объёме, необходимом для исполнения заказа; платёжному провайдеру — для
          проведения оплаты; хостинг-провайдеру и иным подрядчикам — при наличии договоров о конфиденциальности. Передача
          в мессенджер поддержки (Telegram) — только текста обращения и контактного email, если настроена интеграция.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Срок хранения</h2>
        <p className="text-muted-foreground">
          Данные хранятся в течение срока использования Сервиса и до 3 лет после удаления учётной записи или последнего
          заказа, если иной срок не установлен законом. Обращения в поддержку — до закрытия тикета и 1 года для разбора
          споров.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. Права субъекта ПДн</h2>
        <p className="text-muted-foreground">
          Вы вправе запросить уточнение, блокирование или удаление ПДн, отозвать согласие (при этом часть функций Сервиса
          может стать недоступна), обратиться с жалобой в Роскомнадзор. Запрос направляется через{" "}
          <Link href={LEGAL_ROUTES.support} className="text-accent underline">
            поддержку
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. Cookies</h2>
        <p className="text-muted-foreground">
          Сервис использует технические cookies для входа в учётную запись и сохранения сессии чата поддержки. Отключение
          cookies в браузере может ограничить работу Сервиса.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Редакция от 21.05.2026. Использование Сервиса после регистрации или оформления заказа при принятии{" "}
        <Link href={LEGAL_ROUTES.oferta} className="underline">
          оферты
        </Link>{" "}
        подразумевает ознакомление с настоящей Политикой.
      </p>
    </LegalDocLayout>
  );
}
