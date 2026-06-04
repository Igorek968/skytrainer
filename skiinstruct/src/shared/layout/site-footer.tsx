import Link from "next/link";

import { LEGAL_AGENT } from "@/lib/legal-entity";
import { LEGAL_ROUTES } from "@/lib/legal";
import { SupportLauncher } from "@/features/support/support-launcher";

export function SiteFooter() {
  const telHref = `tel:${LEGAL_AGENT.phone.replace(/[^\d+]/g, "")}`;

  return (
    <footer className="border-t border-border bg-muted/20 py-6 text-center text-xs text-muted-foreground">
      <div className="mx-auto max-w-6xl space-y-4 px-4">
        <SupportLauncher />
        <p className="leading-relaxed">
          {LEGAL_AGENT.shortName} | ИНН {LEGAL_AGENT.inn} |{" "}
          <Link className="underline underline-offset-2 hover:text-foreground" href={LEGAL_ROUTES.requisites}>
            Реквизиты
          </Link>{" "}
          |{" "}
          <Link className="underline underline-offset-2 hover:text-foreground" href={LEGAL_ROUTES.oferta}>
            Оферта
          </Link>{" "}
          |{" "}
          <Link className="underline underline-offset-2 hover:text-foreground" href={LEGAL_ROUTES.privacy}>
            Политика ПД
          </Link>{" "}
          |{" "}
          <Link className="underline underline-offset-2 hover:text-foreground" href={LEGAL_ROUTES.returns}>
            Возврат
          </Link>{" "}
          | Телефон:{" "}
          <a className="underline underline-offset-2 hover:text-foreground" href={telHref}>
            {LEGAL_AGENT.phone}
          </a>{" "}
          | Email:{" "}
          <a className="underline underline-offset-2 hover:text-foreground" href={`mailto:${LEGAL_AGENT.email}`}>
            {LEGAL_AGENT.email}
          </a>
        </p>
      </div>
    </footer>
  );
}
