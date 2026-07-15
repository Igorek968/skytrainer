import type { Metadata } from "next";
import Link from "next/link";

import { SEO_PAGES, pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd, faqPageJsonLd, howToJsonLd } from "@/lib/seo-schema";

export const metadata: Metadata = pageMetadata(SEO_PAGES.guideFirstSkiSochi);

const FAQS = [
  {
    question: "Где найти инструктора по горным лыжам в Сочи?",
    answer:
      "На ТвойТренер.рф откройте карту или страницу «Горные лыжи в Сочи», сравните рейтинг и отзывы, отправьте заявку и оплатите занятие через ЮKassa.",
  },
  {
    question: "Сколько стоит первый урок на Красной Поляне?",
    answer:
      "Ориентир «от 2500–3000 ₽/час» — точная ставка в профиле инструктора. Итоговая сумма фиксируется в заказе до оплаты.",
  },
  {
    question: "Нужен ли опыт, чтобы брать инструктора?",
    answer:
      "Нет. Для первого дня на склоне инструктор подберёт трассу и темп. Укажите в заявке, что вы новичок.",
  },
];

export default function FirstSkiSochiGuidePage() {
  const schemas = [
    breadcrumbJsonLd([
      { name: "ТвойТренер.рф", path: "/" },
      { name: "Сочи", path: "/gorod/sochi" },
      { name: "Первый урок горных лыж", path: "/gid/pervyj-urok-gornye-lyzhi-sochi" },
    ]),
    howToJsonLd({
      name: "Первый урок горных лыж в Сочи",
      description: SEO_PAGES.guideFirstSkiSochi.description,
      url: SEO_PAGES.guideFirstSkiSochi.path,
      steps: [
        "Выберите день и курорт (Роза Хутор, Газпром, Красная Поляна).",
        "На ТвойТренер.рф найдите инструктора «Горные лыжи» в Сочи или Красной Поляне.",
        "Напишите в заявке уровень (новичок) и желаемое время.",
        "После подтверждения оплатите занятие через ЮKassa.",
        "Возьмите шлем и удобную одежду; на месте согласуйте точку встречи у подъёмника.",
      ],
    }),
    faqPageJsonLd(FAQS),
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
          {" · "}
          <Link href="/gorod/sochi" className="underline-offset-2 hover:underline">
            Сочи
          </Link>
          {" · Гайд"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Первый урок горных лыж в Сочи
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Как безопасно начать на Красной Поляне / Роза Хутор: найти инструктора на ТвойТренер.рф, понять цену и
          подготовиться к первому дню на склоне.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">По фактам</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Локации: Красная Поляна, Роза Хутор, Газпром Лаура/Альпика.</li>
          <li>Ориентир цены персонального инструктора: от 2500–3000 ₽/час.</li>
          <li>Бронирование и оплата — онлайн на ТвойТренер.рф через ЮKassa.</li>
          <li>В поиске только инструкторы после модерации, с рейтингом и отзывами.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Как записаться</h2>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            Откройте{" "}
            <Link href="/gorod/sochi/gornye-lyzhi" className="text-primary underline-offset-2 hover:underline">
              горные лыжи в Сочи
            </Link>{" "}
            или карту на главной.
          </li>
          <li>Сравните рейтинг, отзывы и ставку.</li>
          <li>Укажите в заявке, что это первый урок.</li>
          <li>Оплатите после подтверждения и согласуйте точку встречи.</li>
        </ol>
        <p className="flex flex-wrap gap-3">
          <Link
            href="/gorod/sochi/gornye-lyzhi"
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Инструкторы: горные лыжи в Сочи
          </Link>
          <Link
            href="/gorod/krasnaya-polyana/gornye-lyzhi"
            className="text-sm text-primary underline-offset-2 hover:underline self-center"
          >
            Красная Поляна
          </Link>
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Частые вопросы</h2>
        {FAQS.map((f) => (
          <div key={f.question} className="space-y-1 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{f.question}</p>
            <p className="leading-relaxed">{f.answer}</p>
          </div>
        ))}
      </section>
    </article>
  );
}
