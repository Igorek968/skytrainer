"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/shared/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
      <h1 className="text-lg font-semibold">Не удалось загрузить страницу</h1>
      <p className="text-sm text-muted-foreground">
        Попробуйте обновить страницу. Если вы переключались между кабинетом клиента, инструктора и админа —
        выйдите и войдите снова в нужный раздел.
      </p>
      {error.message ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
          {error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="accent" onClick={() => reset()}>
          Повторить
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/">На главную</Link>
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/instructor/login">Вход инструктора</Link>
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/login">Вход администратора</Link>
        </Button>
      </div>
    </div>
  );
}
