import Link from "next/link";

import { SEO_CITIES, SEO_SPORTS, cityPath, citySportPath } from "@/lib/seo-landings";
import { SITE_FAQS, faqPageJsonLd } from "@/lib/seo-schema";

const SOCHI = SEO_CITIES.find((c) => c.slug === "sochi")!;

/** Компактный SSR-блок после отзывов: только Сочи + направления. */
export function HomeSeoContent() {
  const faqLd = faqPageJsonLd(SITE_FAQS.slice(0, 3));
  const sports = SEO_SPORTS.slice(0, 8);

  return (
    <section
      className="mt-6 border-t border-border/50 pt-4 text-sm"
      aria-label="Сочи и направления"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-foreground">Город</h2>
          <p>
            <Link
              href={cityPath(SOCHI)}
              className="text-primary underline-offset-2 hover:underline"
            >
              Инструкторы в Сочи
            </Link>
            <span className="text-muted-foreground"> — {SOCHI.regionHint}</span>
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            <Link href="/oferta" className="underline-offset-2 hover:underline">
              Оферта
            </Link>
            {" · "}
            <Link href="/returns" className="underline-offset-2 hover:underline">
              Возврат
            </Link>
            {" · "}
            <Link href="/auto" className="underline-offset-2 hover:underline">
              Автоинструктор
            </Link>
            {" · "}
            <Link href="/events" className="underline-offset-2 hover:underline">
              Мероприятия
            </Link>
          </p>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-foreground">Направления в Сочи</h2>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
            {sports.map((s) => (
              <li key={s.slug}>
                <Link
                  href={citySportPath(SOCHI, s)}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {s.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href={cityPath(SOCHI)} className="underline-offset-2 hover:underline">
                все…
              </Link>
            </li>
          </ul>
          <p className="text-[11px] leading-snug text-muted-foreground">
            <Link href="/faq" className="underline-offset-2 hover:underline">
              FAQ
            </Link>
            {" · "}
            <Link href="/gid/kak-vybrat-instruktora" className="underline-offset-2 hover:underline">
              Как выбрать инструктора
            </Link>
            {" · "}
            <Link href="/instructor" className="underline-offset-2 hover:underline">
              Для инструкторов
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
