import Link from "next/link";

import { SEO_CITIES, SEO_SPORTS, cityPath, sportPath } from "@/lib/seo-landings";

/** SSR-блок для роботов на главной (карта ниже — клиентская). */
export function HomeSeoContent() {
  return (
    <section className="mt-10 space-y-8 border-t border-border/50 pt-8" aria-label="О сервисе">
      <div className="max-w-3xl space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Персональные тренировки по всей России</h2>
        <p className="text-muted-foreground leading-relaxed">
          ТвойТренер.рф — маркетплейс инструкторов и тренеров: горные лыжи, сноуборд, теннис, плавание, йога и десятки
          других направлений. Найдите специалиста на карте, сравните цены и отзывы, забронируйте занятие и оплатите
          онлайн через ЮKassa.
        </p>
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

      <div className="max-w-3xl space-y-2 text-sm text-muted-foreground">
        <h3 className="text-base font-semibold text-foreground">Частые вопросы</h3>
        <p>
          <strong className="text-foreground">Как найти инструктора?</strong> Откройте карту на главной, выберите вид
          спорта и точку встречи — в выдаче появятся одобренные инструкторы рядом.
        </p>
        <p>
          <strong className="text-foreground">Как оплатить?</strong> После подтверждения заявки оплата проходит онлайн
          через ЮKassa в личном кабинете.
        </p>
        <p>
          <strong className="text-foreground">Можно ли стать инструктором?</strong> Да — подайте заявку в разделе для
          инструкторов; после модерации профиль появится в поиске.
        </p>
      </div>
    </section>
  );
}
