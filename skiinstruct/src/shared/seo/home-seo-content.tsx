import Link from "next/link";

import { SEO_CITIES, SEO_SPORTS, cityPath, sportPath } from "@/lib/seo-landings";
import { SITE_FAQS, faqPageJsonLd } from "@/lib/seo-schema";

/** SSR-блок для роботов на главной (карта ниже — клиентская). */
export function HomeSeoContent() {
  const faqLd = faqPageJsonLd(SITE_FAQS);

  return (
    <section className="mt-10 space-y-8 border-t border-border/50 pt-8" aria-label="О сервисе">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <div className="max-w-3xl space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Персональные тренировки по всей России</h2>
        <p className="text-muted-foreground leading-relaxed">
          ТвойТренер.рф — маркетплейс инструкторов и тренеров: горные лыжи, сноуборд, теннис, плавание, йога и десятки
          других направлений. Найдите проверенного специалиста на карте, сравните цены и отзывы, забронируйте занятие и
          оплатите онлайн через ЮKassa.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>В поиске только инструкторы после модерации</li>
          <li>Рейтинг и отзывы после завершённых занятий</li>
          <li>Оплата ЮKassa, правила возврата опубликованы на сайте</li>
        </ul>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Города и курорты</h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {SEO_CITIES.map((c) => (
              <li key={c.slug}>
                <Link href={cityPath(c)} className="text-primary underline-offset-2 hover:underline">
                  Инструкторы {c.prepositional}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Направления</h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {SEO_SPORTS.slice(0, 12).map((s) => (
              <li key={s.slug}>
                <Link href={sportPath(s)} className="text-primary underline-offset-2 hover:underline">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="max-w-3xl space-y-4 text-sm text-muted-foreground">
        <h3 className="text-base font-semibold text-foreground">Частые вопросы</h3>
        {SITE_FAQS.map((f) => (
          <div key={f.question} className="space-y-1">
            <p>
              <strong className="text-foreground">{f.question}</strong>
            </p>
            <p className="leading-relaxed">{f.answer}</p>
          </div>
        ))}
        <p>
          <Link href="/faq" className="text-primary underline-offset-2 hover:underline">
            Все вопросы и ответы
          </Link>
          {" · "}
          <Link href="/gid/kak-vybrat-instruktora" className="text-primary underline-offset-2 hover:underline">
            Как выбрать инструктора
          </Link>
        </p>
      </div>
    </section>
  );
}
