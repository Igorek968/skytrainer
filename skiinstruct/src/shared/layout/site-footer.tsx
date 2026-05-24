import Link from "next/link";

import { LEGAL_ROUTES } from "@/lib/legal";
import { SupportLauncher } from "@/features/support/support-launcher";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/20 py-6 text-center text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4">
        <SupportLauncher />
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link className="underline decoration-muted-foreground/50 underline-offset-2 hover:text-foreground" href={LEGAL_ROUTES.oferta}>
            Оферта (клиент)
          </Link>
          <span className="hidden sm:inline" aria-hidden>
            ·
          </span>
          <Link
            className="underline decoration-muted-foreground/50 underline-offset-2 hover:text-foreground"
            href={LEGAL_ROUTES.ofertaInstructor}
          >
            Договор инструктора
          </Link>
          <span className="hidden sm:inline" aria-hidden>
            ·
          </span>
          <Link
            className="underline decoration-muted-foreground/50 underline-offset-2 hover:text-foreground"
            href={LEGAL_ROUTES.privacy}
          >
            Персональные данные (152-ФЗ)
          </Link>
          <span className="hidden sm:inline" aria-hidden>
            ·
          </span>
          <Link
            className="underline decoration-muted-foreground/50 underline-offset-2 hover:text-foreground"
            href={LEGAL_ROUTES.returns}
          >
            Возвраты и отмена
          </Link>
          <span className="hidden sm:inline" aria-hidden>
            ·
          </span>
          <Link
            className="underline decoration-muted-foreground/50 underline-offset-2 hover:text-foreground"
            href={LEGAL_ROUTES.support}
          >
            Поддержка
          </Link>
        </div>
        <span>Документы носят информационный характер; реквизиты исполнителя задаются в настройках сервиса.</span>
      </div>
    </footer>
  );
}
