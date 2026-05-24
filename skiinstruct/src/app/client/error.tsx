"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/shared/ui/button";

export default function ClientAreaError({
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
      <h1 className="text-lg font-semibold">Не удалось открыть страницу клиента</h1>
      <p className="text-sm text-muted-foreground">
        Попробуйте обновить. Если вы входили как инструктор или админ — выйдите и войдите через{" "}
        <Link className="text-accent underline" href="/login">
          вход клиента
        </Link>
        .
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
          <Link href="/login">Войти</Link>
        </Button>
      </div>
    </div>
  );
}
