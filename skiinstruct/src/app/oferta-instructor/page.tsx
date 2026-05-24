import type { Metadata } from "next";
import Link from "next/link";

import {
  AGENCY_OFFER_VERSION,
  INSTRUCTOR_CANCEL_NOTICE_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  NPD_RECEIPT_DEADLINE_HOURS,
  PAYOUT_MIN_WITHDRAWAL_RUB,
  PLATFORM_FEE_PERCENT,
} from "@/lib/legal-config";
import { LEGAL_ROUTES, legalOperatorName } from "@/lib/legal";
import { formatPayoutWindowHint } from "@/lib/services/order-payout";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";
import { LegalOperatorBanner } from "@/shared/layout/legal-operator-banner";

export const metadata: Metadata = {
  title: "Агентский договор (оферта) для инструктора",
  description: "Условия сотрудничества самозанятых и ИП с платформой",
};

export default function InstructorAgencyOfferPage() {
  const operator = legalOperatorName();
  const payoutHint = formatPayoutWindowHint();

  return (
    <LegalDocLayout title="Агентский договор (публичная оферта) для инструктора">
      <p className="text-muted-foreground">
        Настоящий договор является публичной офертой (ст. 437 ГК РФ) для дееспособных физических лиц,
        зарегистрированных как самозанятые или индивидуальные предприниматели (далее — «Инструктор»,
        «Принципал»). Акцепт — регистрация в сервисе с отметкой о согласии (версия {AGENCY_OFFER_VERSION}).
      </p>
      <LegalOperatorBanner />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Термины</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Агент</span> — {operator}, действующий за
            вознаграждение в интересах Инструктора.
          </li>
          <li>
            <span className="font-medium text-foreground">Клиент</span> — пользователь, бронирующий
            занятие через платформу.
          </li>
          <li>
            <span className="font-medium text-foreground">Услуга</span> — занятие, оказываемое
            Инструктором лично. Договор на услугу — между Клиентом и Инструктором.
          </li>
          <li>
            <span className="font-medium text-foreground">Комиссия Агента</span> —{" "}
            {PLATFORM_FEE_PERCENT}% от стоимости услуги (удерживается при расчётах через платформу).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Предмет</h2>
        <p className="text-muted-foreground">
          Агент предоставляет доступ к платформе, привлекает Клиентов, принимает оплату и перечисляет
          Инструктору сумму за вычетом Комиссии. Агент не оказывает услуги Клиентам самостоятельно.
          Отношения не являются трудовыми: Инструктор сам определяет режим работы и несёт налоговые
          обязательства.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Регистрация и документы</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>Подтверждение статуса самозанятого или ИП, ИНН, справка из «Мой налог» или выписка ИП.</li>
          <li>Действующий договор страхования ответственности — загрузка в личном кабинете.</li>
          <li>Без одобрения документов статус «онлайн» и приём оплаченных заявок недоступны.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Расчёты и выплаты</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>Оплата Клиентом — только через платформу.</li>
          <li>Комиссия Агента: {PLATFORM_FEE_PERCENT}%.</li>
          <li>Выплата Инструктору: {payoutHint}.</li>
          <li>Минимальная сумма к выводу: {PAYOUT_MIN_WITHDRAWAL_RUB} ₽ (на реквизиты в личном кабинете).</li>
          <li>
            Чек в «Мой налог» (или ККТ) — загрузка в заказ в течение {NPD_RECEIPT_DEADLINE_HOURS} ч после
            занятия.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Отмена и опоздание</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            Отмена Инструктором не позднее {INSTRUCTOR_CANCEL_NOTICE_HOURS} ч до занятия — полный возврат
            Клиенту.
          </li>
          <li>
            Опоздание более {INSTRUCTOR_LATE_GRACE_MINUTES} мин от ETA — Клиент вправе запросить полный
            возврат в интерфейсе заказа.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. Персональные данные</h2>
        <p className="text-muted-foreground">
          Обработка данных Инструктора — в соответствии с{" "}
          <Link href={LEGAL_ROUTES.privacy} className="text-accent underline">
            политикой ПДн
          </Link>
          .
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Редакция {AGENCY_OFFER_VERSION}. Для клиентов действует{" "}
        <Link href={LEGAL_ROUTES.oferta} className="underline">
          пользовательское соглашение
        </Link>
        . Текст согласован с шаблоном юриста; перед продакшеном подставьте реквизиты ООО в{" "}
        <code className="rounded bg-muted px-1 font-mono text-[11px]">NEXT_PUBLIC_LEGAL_ENTITY_NAME</code>.
      </p>
    </LegalDocLayout>
  );
}
