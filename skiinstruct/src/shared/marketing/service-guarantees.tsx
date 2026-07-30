import Link from "next/link";
import { BadgeCheck, CreditCard, RotateCcw, Shield } from "lucide-react";

import { LEGAL_ROUTES } from "@/lib/legal";

const ITEMS = [
  {
    icon: Shield,
    title: "Проверенные инструкторы",
    text: "В поиске только анкеты после модерации, с рейтингом и отзывами учеников.",
  },
  {
    icon: CreditCard,
    title: "Оплата через ЮKassa",
    text: "Безопасный онлайн-платёж картой. Деньги не уходят «в никуда» в чат Авито.",
  },
  {
    icon: RotateCcw,
    title: "Правила возврата",
    text: "Понятные условия отмены и возврата — до занятия, а не после спора.",
  },
  {
    icon: BadgeCheck,
    title: "Оферта и реквизиты",
    text: "Юридические документы сервиса открыты: оферта, возврат, реквизиты ООО.",
  },
] as const;

type Props = {
  className?: string;
  compact?: boolean;
};

/** Блок снятия возражений: гарантии + ссылки на оферту / возврат / ЮKassa. */
export function ServiceGuarantees({ className, compact }: Props) {
  return (
    <section className={className} aria-labelledby="service-guarantees">
      <h2 id="service-guarantees" className={compact ? "text-lg font-semibold" : "text-xl font-semibold"}>
        Гарантии сервиса
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        ТвойТренер.рф — информационный сервис с оплатой через ЮKassa. Услуги оказывают
        инструкторы-партнёры.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {ITEMS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              {title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <Link href={LEGAL_ROUTES.oferta} className="text-primary underline-offset-2 hover:underline">
          Оферта
        </Link>
        <Link href={LEGAL_ROUTES.returns} className="text-primary underline-offset-2 hover:underline">
          Условия возврата
        </Link>
        <Link href={LEGAL_ROUTES.requisites} className="text-primary underline-offset-2 hover:underline">
          Реквизиты и оплата
        </Link>
        <Link href={LEGAL_ROUTES.support} className="text-primary underline-offset-2 hover:underline">
          Поддержка
        </Link>
      </p>
    </section>
  );
}
