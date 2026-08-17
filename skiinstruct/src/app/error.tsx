"use client";

import Link from "next/link";
import { useEffect } from "react";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
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

  const detail = userFacingErrorMessage(
    error,
    "Временный сбой загрузки. Обновите страницу или войдите снова.",
  );

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
      <h1 className="text-lg font-semibold">Не удалось загрузить страницу</h1>
      <p className="text-sm text-muted-foreground">
        Попробуйте обновить страницу. Если ошибка повторяется после регистрации инструктора — уменьшите
        размер сканов паспорта и НПД и отправьте анкету ещё раз.
      </p>
      {detail ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {detail}
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
          <Link href="/instructor/apply?new=1">Анкета инструктора</Link>
        </Button>
      </div>
    </div>
  );
}
