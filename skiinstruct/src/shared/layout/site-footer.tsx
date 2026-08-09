import Link from "next/link";

import { formatLegalEditionDate, LEGAL_PLATFORM_NAME } from "@/lib/legal-config";
import { LEGAL_AGENT } from "@/lib/legal-entity";
import { LEGAL_ROUTES } from "@/lib/legal";
import {
  SUPPORT_TELEGRAM_HANDLE,
  brandTelegramChannelUrl,
  supportEmail,
  supportMaxUrl,
} from "@/lib/support-config";
import { SupportLauncher } from "@/features/support/support-launcher";

export function SiteFooter() {
  const email = supportEmail();
  const telegramUrl = brandTelegramChannelUrl({ campaign: "footer", content: "public" });
  const maxUrl = supportMaxUrl();

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
          <Link
            className="underline underline-offset-2 hover:text-foreground"
            href={LEGAL_ROUTES.ofertaInstructor}
          >
            Оферта инструктора
          </Link>{" "}
          |{" "}
          <Link className="underline underline-offset-2 hover:text-foreground" href={LEGAL_ROUTES.privacy}>
            Политика ПД
          </Link>{" "}
          |{" "}
          <Link className="underline underline-offset-2 hover:text-foreground" href={LEGAL_ROUTES.returns}>
            Возврат
          </Link>{" "}
          |{" "}
          <Link className="underline underline-offset-2 hover:text-foreground" href={LEGAL_ROUTES.support}>
            Поддержка
          </Link>{" "}
          |{" "}
          <Link className="underline underline-offset-2 hover:text-foreground" href="/faq">
            FAQ
          </Link>{" "}
          |{" "}
          <Link className="underline underline-offset-2 hover:text-foreground" href="/gid/kak-vybrat-instruktora">
            Как выбрать инструктора
          </Link>
        </p>
        <p className="leading-relaxed">
          Email:{" "}
          <a className="underline underline-offset-2 hover:text-foreground" href={`mailto:${email}`}>
            {email}
          </a>
          {" · "}
          Канал Telegram:{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {SUPPORT_TELEGRAM_HANDLE}
          </a>
          {" · "}
          MAX (администратор):{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href={maxUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            написать в MAX
          </a>
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground/90">
          © 2026{new Date().getFullYear() > 2026 ? `–${new Date().getFullYear()}` : ""} {LEGAL_AGENT.shortName}.{" "}
          {LEGAL_PLATFORM_NAME} — информационный сервис; услуги обучения оказывают инструкторы-партнёры (НПД/ИП).
        </p>
        <p className="text-[11px] text-muted-foreground/90">
          Редакция документов от {formatLegalEditionDate()}
        </p>
      </div>
    </footer>
  );
}
