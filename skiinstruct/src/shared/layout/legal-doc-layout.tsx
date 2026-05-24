import Link from "next/link";

import { LEGAL_ROUTES } from "@/lib/legal";

export function LegalDocLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-12 text-sm leading-relaxed text-foreground">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/" className="text-accent underline underline-offset-2">
            ← На главную
          </Link>
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
        <nav className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Link className="underline underline-offset-2 hover:text-foreground" href={LEGAL_ROUTES.oferta}>
            Оферта (клиент)
          </Link>
          <Link
            className="underline underline-offset-2 hover:text-foreground"
            href={LEGAL_ROUTES.ofertaInstructor}
          >
            Агентский договор
          </Link>
          <Link className="underline underline-offset-2 hover:text-foreground" href={LEGAL_ROUTES.privacy}>
            Персональные данные
          </Link>
          <Link className="underline underline-offset-2 hover:text-foreground" href={LEGAL_ROUTES.returns}>
            Возвраты и отмена
          </Link>
        </nav>
      </div>
      {children}
    </article>
  );
}
