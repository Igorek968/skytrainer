import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { TrafficLanding } from "@/shared/marketing/traffic-landing";
import { TrackedHireCta } from "@/shared/marketing/tracked-hire-cta";

const PATH = "/vakansiya";

export const metadata: Metadata = pageMetadata({
  title: "Вакансия инструктора / тренера / гида в Сочи — ТвойТренер.рф",
  description:
    "Набор инструкторов, тренеров и гидов на маркетплейс ТвойТренер.рф в Сочи: заявки с карты, свой график, оплата ЮKassa. Анкета онлайн — без штатного оклада.",
  path: PATH,
});

export default function VakansiyaPage() {
  return (
    <TrafficLanding
      eyebrow="Вакансия · ТвойТренер.рф · Сочи"
      title="Инструктор, тренер или гид — приходи на площадку"
      lead="Это не оклад в штат: вы размещаете профиль, принимаете заявки с карты, когда удобно, и получаете оплату онлайн. Сначала анкета на сайте — потом модерация и выход на линию."
      ctaLabel="Заполнить анкету"
      ctaHref="/instructor/apply?utm_source=seo&utm_medium=vakansiya&utm_campaign=hire"
      ctaSlot={
        <TrackedHireCta
          href="/instructor/apply?utm_source=seo&utm_medium=vakansiya&utm_campaign=hire"
          label="Заполнить анкету"
        />
      }
      secondaryCtaLabel="Как это работает"
      secondaryCtaHref="/landings/prichodi?utm_source=seo&utm_medium=vakansiya&utm_campaign=hire"
      bullets={[
        "Заявки от клиентов рядом — без холодных «напишите в ЛС».",
        "Ставка ваша, график ваш, оформление самозанятость / ГПХ.",
        "ИНН нужен для выплат через ЮKassa — укажите в анкете сразу.",
        "Геофокус: Сочи, Красная Поляна, Сириус и дальше.",
      ]}
    />
  );
}
