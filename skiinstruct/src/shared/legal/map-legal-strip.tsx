import Link from "next/link";

import { LEGAL_ROUTES } from "@/lib/legal";
import { LEGAL_PLATFORM_NAME } from "@/lib/legal-config";
import { LEGAL_AGENT } from "@/lib/legal-entity";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** attached — под картой (надёжно с Яндекс.Картами); overlay — поверх нижнего края */
  placement?: "attached" | "overlay";
};

const START_YEAR = 2026;

/** Короткий дисклеймер у карты (как у агрегаторов: информационный сервис, услуги — у партнёров). */
export function MapLegalStrip({ className, placement = "attached" }: Props) {
  const year = new Date().getFullYear();

  const content = (
    <div className="pointer-events-auto border-t border-border bg-background/95 px-2.5 py-2 text-[10px] leading-snug text-muted-foreground shadow-md backdrop-blur-md sm:px-3 sm:text-[11px]">
        <p>
          © {START_YEAR}
          {year > START_YEAR ? `–${year}` : ""} {LEGAL_AGENT.shortName}. {LEGAL_PLATFORM_NAME} —{" "}
          <span className="font-medium text-foreground">информационный сервис</span>. Услуги обучения
          оказывают <span className="font-medium text-foreground">инструкторы-партнёры</span> (НПД/ИП), не
          оператор платформы. Занятия связаны с риском травм — см.{" "}
          <Link href={LEGAL_ROUTES.oferta} className="text-accent underline underline-offset-2">
            оферту
          </Link>
          .
        </p>
        <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
          <Link href={LEGAL_ROUTES.oferta} className="text-accent underline underline-offset-2">
            Оферта
          </Link>
          <span aria-hidden>·</span>
          <Link href={LEGAL_ROUTES.ofertaInstructor} className="text-accent underline underline-offset-2">
            Агентский договор
          </Link>
          <span aria-hidden>·</span>
          <Link href={LEGAL_ROUTES.returns} className="text-accent underline underline-offset-2">
            Возврат
          </Link>
          <span aria-hidden>·</span>
          <Link href={LEGAL_ROUTES.requisites} className="text-accent underline underline-offset-2">
            Реквизиты / ЮKassa
          </Link>
        </p>
    </div>
  );

  if (placement === "overlay") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-[5000] rounded-b-lg",
          className,
        )}
        aria-label="Правовая информация о сервисе"
      >
        {content}
      </div>
    );
  }

  return (
    <div className={cn("rounded-b-lg", className)} aria-label="Правовая информация о сервисе">
      {content}
    </div>
  );
}
