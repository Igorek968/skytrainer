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

export const metadata: Metadata = pageMetadata(SEO_PAGES.guideChooseInstructor);

const GUIDE_FAQS = [
  SITE_FAQS[2],
  SITE_FAQS[3],
  {
    question: "На что смотреть в профиле инструктора?",
    answer:
      "Специализации, ставка ₽/час, рейтинг, число отзывов, опыт и описание. Для срочного занятия важны статус «онлайн» и расстояние на карте.",
  },
];

export default function ChooseInstructorGuidePage() {
  const schemas = [
    breadcrumbJsonLd([
      { name: "ТвойТренер.рф", path: "/" },
      { name: "Гайды", path: "/gid/kak-vybrat-instruktora" },
      { name: "Как выбрать инструктора", path: "/gid/kak-vybrat-instruktora" },
    ]),
    howToJsonLd({
      name: "Как выбрать инструктора на ТвойТренер.рф",
      description: SEO_PAGES.guideChooseInstructor.description,
      url: SEO_PAGES.guideChooseInstructor.path,
      steps: [
        "Откройте карту и выберите вид спорта и точку встречи.",
        "Отфильтруйте выдачу: смотрите рейтинг, отзывы, ставку и статус «онлайн».",
        "Откройте профиль: специализации, опыт, описание и фото.",
        "Отправьте заявку и дождитесь подтверждения в чате заказа.",
        "Оплатите занятие через ЮKassa и после тренировки оставьте отзыв.",
      ],
    }),
    faqPageJsonLd(GUIDE_FAQS),
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
          {" · Гайд"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Как выбрать инструктора</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Короткий чек-лист, чтобы найти проверенного тренера на ТвойТренер.рф: рейтинг, отзывы, цена и безопасная
          оплата.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">На что смотреть</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <strong className="text-foreground">Модерация</strong> — в поиске только одобренные профили.
          </li>
          <li>
            <strong className="text-foreground">Рейтинг и отзывы</strong> — реальные оценки после завершённых занятий.
          </li>
          <li>
            <strong className="text-foreground">Ставка ₽/час</strong> — сравните несколько инструкторов рядом с вами.
          </li>
          <li>
            <strong className="text-foreground">Специализация</strong> — вид спорта должен совпадать с вашей задачей.
          </li>
          <li>
            <strong className="text-foreground">Онлайн и расстояние</strong> — удобно для занятия «сегодня».
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Пошагово</h2>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          {BOOKING_HOW_TO_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>
          <Link
            href="/"
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Открыть карту
          </Link>
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Частые вопросы</h2>
        {GUIDE_FAQS.map((f) => (
          <div key={f.question} className="space-y-1 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{f.question}</p>
            <p className="leading-relaxed">{f.answer}</p>
          </div>
        ))}
      </section>

      <p className="text-sm text-muted-foreground">
        Пример для курорта:{" "}
        <Link
          href="/gid/pervyj-urok-gornye-lyzhi-sochi"
          className="text-primary underline-offset-2 hover:underline"
        >
          первый урок горных лыж в Сочи
        </Link>
        .
      </p>
    </article>
  );
}
