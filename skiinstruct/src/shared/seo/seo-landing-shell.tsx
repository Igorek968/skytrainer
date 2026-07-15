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
import {
  BOOKING_HOW_TO_STEPS,
  breadcrumbJsonLd,
  faqPageJsonLd,
  howToJsonLd,
  type FaqItem,
} from "@/lib/seo-schema";

type Props = {
  title: string;
  lead: string;
  city?: SeoCity;
  sport?: SeoSport;
  facts?: string[];
  faqs?: FaqItem[];
  /** Ссылка на карту с опциональным query (будущие фильтры). */
  mapHref?: string;
};

export function SeoLandingShell({
  title,
  lead,
  city,
  sport,
  facts = [],
  faqs = [],
  mapHref = "/",
}: Props) {
  const relatedSports = SEO_SPORTS.slice(0, 12);
  const relatedCities = SEO_CITIES;

  const crumbs = [
    { name: "ТвойТренер.рф", path: "/" },
    ...(city ? [{ name: city.name, path: cityPath(city) }] : []),
    ...(sport
      ? [
          {
            name: sport.name,
            path: city ? citySportPath(city, sport) : sportPath(sport),
          },
        ]
      : []),
  ];

  const howToName = sport
    ? city
      ? `Как записаться на «${sport.name}» ${city.prepositional}`
      : `Как записаться к инструктору: ${sport.name}`
    : city
      ? `Как записаться к инструктору ${city.prepositional}`
      : "Как записаться к инструктору на ТвойТренер.рф";

  const schemas = [
    breadcrumbJsonLd(crumbs),
    howToJsonLd({
      name: howToName,
      description: lead,
      steps: BOOKING_HOW_TO_STEPS.map((step) =>
        sport ? step.replace("вид спорта", `«${sport.name}»`) : step,
      ),
    }),
    ...(faqs.length ? [faqPageJsonLd(faqs)] : []),
  ];

  return (
    <article className="mx-auto max-w-3xl space-y-8 py-2">
      {schemas.map((schema, i) => (
        <script
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <header className="space-y-3">
        <nav aria-label="Хлебные крошки" className="text-sm text-muted-foreground">
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
        </nav>
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

      {facts.length > 0 ? (
        <section className="space-y-3" aria-labelledby="seo-facts">
          <h2 id="seo-facts" className="text-xl font-semibold">
            Кратко по фактам
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="seo-how">
        <h2 id="seo-how" className="text-xl font-semibold">
          Как записаться
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>Откройте карту и выберите направление{sport ? ` «${sport.name}»` : ""}.</li>
          <li>Сравните инструкторов рядом{city ? ` ${city.prepositional}` : ""}: рейтинг, ставка, отзывы.</li>
          <li>Отправьте заявку — инструктор отвечает в чате заказа.</li>
          <li>Оплатите занятие онлайн через ЮKassa и приходите на встречу.</li>
        </ol>
      </section>

      {faqs.length > 0 ? (
        <section className="space-y-3" aria-labelledby="seo-faq">
          <h2 id="seo-faq" className="text-xl font-semibold">
            Частые вопросы
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            {faqs.map((f) => (
              <div key={f.question} className="space-y-1">
                <p className="font-semibold text-foreground">{f.question}</p>
                <p className="leading-relaxed">{f.answer}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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

      <section className="space-y-2 text-sm text-muted-foreground">
        <p>
          Полезные материалы:{" "}
          <Link href="/gid/kak-vybrat-instruktora" className="text-primary underline-offset-2 hover:underline">
            как выбрать инструктора
          </Link>
          {" · "}
          <Link href="/faq" className="text-primary underline-offset-2 hover:underline">
            FAQ
          </Link>
          {" · "}
          <Link href="/returns" className="text-primary underline-offset-2 hover:underline">
            правила возврата
          </Link>
        </p>
      </section>

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
