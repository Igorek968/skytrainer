import type { Metadata } from "next";
import Link from "next/link";

import { SEO_PAGES, pageMetadata } from "@/lib/seo";
import {
  BOOKING_HOW_TO_STEPS,
  SITE_FAQS,
  breadcrumbJsonLd,
  faqPageJsonLd,
  howToJsonLd,
} from "@/lib/seo-schema";

export const metadata: Metadata = pageMetadata(SEO_PAGES.guideWhatIs);

const PAGE_FAQS = [SITE_FAQS[0], SITE_FAQS[1], SITE_FAQS[2], SITE_FAQS[3]];

export default function WhatIsTvoyTrenerPage() {
  const schemas = [
    breadcrumbJsonLd([
      { name: "ТвойТренер.рф", path: "/" },
      { name: "Что такое ТвойТренер.рф", path: SEO_PAGES.guideWhatIs.path },
    ]),
    howToJsonLd({
      name: "Как заказать персонального тренера на ТвойТренер.рф",
      description: SEO_PAGES.guideWhatIs.description,
      url: SEO_PAGES.guideWhatIs.path,
      steps: BOOKING_HOW_TO_STEPS,
    }),
    faqPageJsonLd(PAGE_FAQS),
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
        <p className="text-sm text-muted-foreground">
          <Link href="/" className="underline-offset-2 hover:underline">
            ТвойТренер.рф
          </Link>
          {" · О сервисе"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Что такое ТвойТренер.рф
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Маркетплейс живых инструкторов, тренеров и гидов: карта, отзывы, запись и оплата онлайн. Не ИИ и не
          «сайт, который тренирует» — занятие проводит человек.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Коротко</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <strong className="text-foreground">Вы выбираете специалиста</strong> на карте по городу и виду спорта.
          </li>
          <li>
            <strong className="text-foreground">В выдаче только люди после модерации</strong> — с рейтингом, ставкой
            ₽/час и отзывами.
          </li>
          <li>
            <strong className="text-foreground">Бронирование и оплата</strong> — заявка в чате заказа, затем ЮKassa.
          </li>
          <li>
            <strong className="text-foreground">Услугу оказывает инструктор-партнёр</strong> (самозанятый или ИП), а
            платформа помогает найти и безопасно оплатить занятие.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Чем мы не являемся</h2>
        <p className="leading-relaxed text-muted-foreground">
          ТвойТренер.рф не обучает вас сам, не подбирает упражнения алгоритмом и не заменяет персональную тренировку
          с человеком. Если в поиске вы видели «твой тренер — сайт, который тренирует» — это другой продукт. Наш
          сервис — площадка, где вы нанимаете реального инструктора рядом или на курорте.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Как заказать услугу тренера</h2>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          {BOOKING_HOW_TO_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href="/"
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Открыть карту
          </Link>
          <Link
            href="/gorod/sochi"
            className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Тренер в Сочи
          </Link>
          <Link
            href="/gorod/krasnaya-polyana"
            className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Красная Поляна
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Частые вопросы</h2>
        {PAGE_FAQS.map((f) => (
          <div key={f.question} className="space-y-1 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{f.question}</p>
            <p className="leading-relaxed">{f.answer}</p>
          </div>
        ))}
      </section>
    </article>
  );
}
