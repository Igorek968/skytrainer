import type { Metadata } from "next";
import Link from "next/link";

import { getPublicProductName } from "@/shared/lib/product";
import { Button } from "@/shared/ui/button";

const appName = getPublicProductName();

export const metadata: Metadata = {
  title: { absolute: `Страница не найдена | ${appName}` },
  description:
    `Запрошенная страница на ${appName} не существует. Перейдите на главную или воспользуйтесь поиском инструктора.`,
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-border bg-card p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">Ошибка 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Страница не найдена</h1>
      <p className="text-sm text-muted-foreground">
        Такой страницы на {appName} нет. Проверьте адрес или перейдите к поиску инструктора на главной.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="accent" asChild>
          <Link href="/">На главную</Link>
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/client">Поиск инструктора</Link>
        </Button>
      </div>
    </div>
  );
}
