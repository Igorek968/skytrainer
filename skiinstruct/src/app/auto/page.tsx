import type { Metadata } from "next";

import { AUTO_INSTRUCTOR_LABEL } from "@/lib/auto-instructor-offer";
import { pageMetadata } from "@/lib/seo";
import { TrafficLanding } from "@/shared/marketing/traffic-landing";

export const metadata: Metadata = pageMetadata({
  title: "Автоинструктор рядом — запись и оплата онлайн | ТвойТренер.рф",
  description:
    "Найдите автоинструктора рядом: проверенные анкеты, отзывы, район работы, статус «на линии». Запись и оплата через ЮKassa на ТвойТренер.рф.",
  path: "/auto",
});

const MAP_HREF = `/?specialization=${encodeURIComponent(AUTO_INSTRUCTOR_LABEL)}&utm_source=landing&utm_campaign=auto`;

export default function AutoTrafficLandingPage() {
  return (
    <TrafficLanding
      eyebrow="ТвойТренер.рф · для учеников"
      title="Автоинструктор рядом — запись за минуту"
      lead="Найдите проверенного автоинструктора на карте: район работы, отзывы и статус «на линии». Оплата онлайн через ЮKassa — без переписки вслепую."
      ctaLabel="Найти автоинструктора на карте"
      ctaHref={MAP_HREF}
      secondaryCtaLabel="Автоинструктор в Москве"
      secondaryCtaHref="/gorod/moskva/avtoinstruktor"
      bullets={[
        "Один запрос — список инструкторов рядом, без выбора «из 100 видов спорта» на первом шаге.",
        "В анкете: рейтинг, отзывы учеников, район работы и кто сейчас на линии.",
        "Оферта, возврат и оплата через ЮKassa — на виду, до клика «оплатить».",
      ]}
    />
  );
}
