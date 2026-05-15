import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/20 py-6 text-center text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4">
        <Link className="underline decoration-muted-foreground/50 underline-offset-2 hover:text-foreground" href="/oferta">
          Публичная оферта
        </Link>
        <span className="hidden sm:inline" aria-hidden>
          ·
        </span>
        <span>Документ носит информационный характер; реквизиты исполнителя уточняйте у администрации сервиса.</span>
      </div>
    </footer>
  );
}
