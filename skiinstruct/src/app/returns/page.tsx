import type { Metadata } from "next";
import Link from "next/link";

import {
  CANCEL_CLIENT_FULL_REFUND_HOURS,
  CANCEL_CLIENT_PARTIAL_PERCENT,
  CANCEL_CLIENT_PARTIAL_REFUND_HOURS,
  INSTRUCTOR_LATE_GRACE_MINUTES,
  PLATFORM_FEE_PERCENT,
} from "@/lib/legal-config";
import { legalOperatorName } from "@/lib/legal";
import { LEGAL_ROUTES } from "@/lib/legal";
import { formatPayoutWindowHint } from "@/lib/services/order-payout";
import { LegalDocLayout } from "@/shared/layout/legal-doc-layout";
import { LegalOperatorBanner } from "@/shared/layout/legal-operator-banner";

export const metadata: Metadata = {
  title: "Возвраты и отмена заказов",
  description: "Правила платформы: отмена, возврат оплаты, ответственность инструктора",
};

export default function ReturnsPolicyPage() {
  const operator = legalOperatorName();

  return (
    <LegalDocLayout title="Возвраты и отмена (клиент и платформа)">
      <p className="text-muted-foreground">
        Документ дополняет{" "}
        <Link href={LEGAL_ROUTES.oferta} className="text-accent underline">
          пользовательское соглашение
        </Link>
        . В интерфейсе заказа при отмене показывается расчёт возврата; списание/возврат на карту — через
        платёжного партнёра (обычно 3–10 рабочих дней).
      </p>
      <LegalOperatorBanner />
      <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Оператор: <span className="font-medium text-foreground">{operator}</span>.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Отмена клиентом (после оплаты)</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            Более {CANCEL_CLIENT_FULL_REFUND_HOURS} ч до начала занятия — возврат <strong>100%</strong>.
          </li>
          <li>
            От {CANCEL_CLIENT_PARTIAL_REFUND_HOURS} до {CANCEL_CLIENT_FULL_REFUND_HOURS} ч — возврат{" "}
            <strong>{CANCEL_CLIENT_PARTIAL_PERCENT}%</strong>.
          </li>
          <li>
            Менее {CANCEL_CLIENT_PARTIAL_REFUND_HOURS} ч — <strong>без возврата</strong>.
          </li>
          <li>До принятия инструктором или до оказания услуги — полный возврат.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Отмена инструктором</h2>
        <p className="text-muted-foreground">
          Полный возврат Клиенту. При отмене инструктором менее чем за 24 ч до занятия платформа вправе
          удержать компенсацию расходов согласно агентскому договору (раздел для инструкторов).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Опоздание инструктора</h2>
        <p className="text-muted-foreground">
          Если инструктор не прибыл в течение {INSTRUCTOR_LATE_GRACE_MINUTES} минут после указанного ETA и
          урок не начат, в карточке заказа доступна кнопка «Полный возврат (опоздание)».
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Комиссия платформы</h2>
        <p className="text-muted-foreground">
          При успешном занятии удерживается комиссия {PLATFORM_FEE_PERCENT}% (указана при оплате). При
          полном возврате комиссия не удерживается. Выплаты инструкторам: {formatPayoutWindowHint()}.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Как оформить</h2>
        <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
          <li>«Отменить» в заказе — система покажет сумму возврата до подтверждения.</li>
          <li>Спор — чат заказа и{" "}
            <Link href={LEGAL_ROUTES.support} className="text-accent underline">
              поддержка
            </Link>
            .
          </li>
        </ol>
      </section>

      <p className="text-xs text-muted-foreground">
        Редакция 23.05.2026. Правила применяются автоматически в сервисе при отмене и возврате.
      </p>
    </LegalDocLayout>
  );
}
