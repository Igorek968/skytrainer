import Link from "next/link";
import {
  MapPin,
  Star,
  Zap,
  Users,
  ShieldCheck,
  ArrowRight,
  Mountain,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  getMarketplaceName,
  MARKETPLACE_FLOW,
  MARKETPLACE_NEARBY_RADIUS_KM,
  MARKETPLACE_ROADMAP,
  MARKETPLACE_SPORT_CATEGORIES,
  MARKETPLACE_TAGLINE,
} from "@/shared/lib/marketplace";

export function MarketplaceHome() {
  const name = getMarketplaceName();

  return (
    <div className="space-y-16 pb-16">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-muted/50 via-background to-accent/5 px-6 py-12 md:px-10 md:py-16">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium text-accent">Маркетплейс · вся Россия</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            {name}: тренер или инструктор{" "}
            <span className="text-accent">рядом с вами</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground md:text-lg">{MARKETPLACE_TAGLINE}</p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Button variant="accent" size="lg" className="min-w-[220px]" asChild>
              <Link href="/">
                Найти тренера сейчас
                <ArrowRight className="ml-2 inline h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="min-w-[220px]" asChild>
              <Link href="/instructor/apply">Стать инструктором</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link className="text-accent underline" href="/login">
              Войти
            </Link>
            {" · "}
            <Link className="text-accent underline" href="/register">
              Регистрация клиента
            </Link>
          </p>
        </div>
        <Mountain
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 text-accent/10 md:h-56 md:w-56"
          aria-hidden
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: MapPin,
            title: `Радиус ${MARKETPLACE_NEARBY_RADIUS_KM} км`,
            desc: "Онлайн-инструкторы рядом с точкой встречи",
          },
          { icon: Zap, title: "Быстрый отклик", desc: "Заявка уходит свободным тренерам — ответ за минуту" },
          { icon: Star, title: "Рейтинг", desc: "Сортировка по близости и оценкам после занятий" },
          { icon: ShieldCheck, title: "Модерация", desc: "Инструкторы проходят проверку в админке" },
        ].map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="border-border/80">
            <CardHeader className="pb-2">
              <Icon className="mb-2 h-8 w-8 text-accent" aria-hidden />
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{desc}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <h2 className="text-center text-xl font-semibold tracking-tight">Направления</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
          Один каталог для горных лыж, тенниса, походов, SUP и других видов — фильтр в поиске совпадает с анкетой
          инструктора.
        </p>
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {MARKETPLACE_SPORT_CATEGORIES.map((label) => (
            <li
              key={label}
              className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground"
            >
              {label}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-center text-xl font-semibold tracking-tight">Как это работает</h2>
        <ol className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
          {MARKETPLACE_FLOW.map((item) => (
            <li key={item.step} className="flex gap-4 rounded-lg border border-border p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                {item.step}
              </span>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Users className="mt-1 h-8 w-8 shrink-0 text-accent" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold">Для инструкторов</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Заполните заявку с достижениями и направлениями. После одобрения администратором вы появляетесь в
                поиске, включаете статус «онлайн» и принимаете заявки клиентов.
              </p>
            </div>
          </div>
          <Button variant="accent" asChild>
            <Link href="/instructor/apply">Подать заявку</Link>
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-center text-xl font-semibold tracking-tight">План развития</h2>
        <div className="mx-auto mt-6 grid max-w-4xl gap-4 md:grid-cols-3">
          {MARKETPLACE_ROADMAP.map((block) => (
            <Card key={block.phase}>
              <CardHeader>
                <CardTitle className="text-base">{block.phase}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {block.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="text-center">
        <Button size="lg" variant="accent" asChild>
          <Link href="/">Открыть поиск на карте</Link>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Локально: http://localhost:3001 · docker compose up в корне skytrainer
        </p>
      </section>
    </div>
  );
}
