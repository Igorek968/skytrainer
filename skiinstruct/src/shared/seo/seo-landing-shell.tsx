import Link from "next/link";

import {
  SEO_CITIES,
  SEO_SPORTS,
  cityPath,
  citySportPath,
  sportPath,
  type SeoCity,
  type SeoSport,
} from "@/lib/seo-landings";

type Props = {
  title: string;
  lead: string;
  city?: SeoCity;
  sport?: SeoSport;
  /** Ссылка на карту с опциональным query (будущие фильтры). */
  mapHref?: string;
};

export function SeoLandingShell({ title, lead, city, sport, mapHref = "/" }: Props) {
  const relatedSports = SEO_SPORTS.slice(0, 12);
  const relatedCities = SEO_CITIES;

  return (
    <article className="mx-auto max-w-3xl space-y-8 py-2">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <Link href="/" className="underline-offset-2 hover:underline">
            ТвойТренер.рф
          </Link>
          {city ? (
            <>
              {" · "}
              <Link href={cityPath(city)} className="underline-offset-2 hover:underline">
                {city.name}
              </Link>
            </>
          ) : null}
          {sport ? (
            <>
              {" · "}
              <Link href={sportPath(sport)} className="underline-offset-2 hover:underline">
                {sport.name}
              </Link>
            </>
          ) : null}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
        <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{lead}</p>
        <p>
          <Link
            href={mapHref}
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Открыть карту и выбрать инструктора
          </Link>
        </p>
      </header>

      <section className="space-y-3" aria-labelledby="seo-how">
        <h2 id="seo-how" className="text-xl font-semibold">
          Как записаться
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>Откройте карту и выберите направление{sport ? ` «${sport.name}»` : ""}.</li>
          <li>Сравните инструкторов рядом{city ? ` ${city.prepositional}` : ""}: рейтинг, ставка, отзывы.</li>
          <li>Отправьте заявку — инструктор отвечает в чате заказа.</li>
          <li>Оплатите занятие онлайн и приходите на встречу.</li>
        </ol>
      </section>

      {!sport ? (
        <section className="space-y-3" aria-labelledby="seo-sports">
          <h2 id="seo-sports" className="text-xl font-semibold">
            Популярные направления{city ? ` ${city.prepositional}` : ""}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {relatedSports.map((s) => (
              <li key={s.slug}>
                <Link
                  href={city ? citySportPath(city, s) : sportPath(s)}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!city ? (
        <section className="space-y-3" aria-labelledby="seo-cities">
          <h2 id="seo-cities" className="text-xl font-semibold">
            Города и курорты
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {relatedCities.map((c) => (
              <li key={c.slug}>
                <Link
                  href={sport ? citySportPath(c, sport) : cityPath(c)}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {c.name}
                </Link>
                <span className="text-muted-foreground"> — {c.regionHint}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {city && sport ? (
        <section className="space-y-3" aria-labelledby="seo-more">
          <h2 id="seo-more" className="text-xl font-semibold">
            Ещё {city.prepositional}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {relatedSports
              .filter((s) => s.slug !== sport.slug)
              .slice(0, 8)
              .map((s) => (
                <li key={s.slug}>
                  <Link href={citySportPath(city, s)} className="text-primary underline-offset-2 hover:underline">
                    {s.name}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          ТвойТренер.рф — маркетплейс персональных тренировок: инструкторы по всей России, карта, отзывы и оплата
          через ЮKassa. Сервис подходит для горных лыж, сноуборда, тенниса, плавания, йоги и десятков других
          направлений.
        </p>
      </section>
    </article>
  );
}
