import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { TrafficLanding } from "@/shared/marketing/traffic-landing";

export const metadata: Metadata = pageMetadata({
  title: "Инструкторам — заявки и заработок на ТвойТренер.рф",
  description:
    "Подключайтесь как инструктор: заявки от учеников рядом, оплата через ЮKassa, рейтинг и отзывы. Регистрация и модерация на ТвойТренер.рф.",
  path: "/instructor",
});

export default function InstructorTrafficLandingPage() {
  return (
    <TrafficLanding
      eyebrow="ТвойТренер.рф · для инструкторов"
      title="Заявки от учеников рядом — выходите на линию и зарабатывайте"
      lead="Зарегистрируйтесь как инструктор: укажите район работы, направления и ставку. Ученики видят, что вы «на линии», и оставляют заявку с онлайн-оплатой."
      ctaLabel="Подать заявку инструктора"
      ctaHref="/instructor/apply"
      secondaryCtaLabel="Уже есть аккаунт — войти"
      secondaryCtaHref="/instructor/login"
      bullets={[
        "Ученики приходят с рекламы и SEO сразу на профиль/карту — не на «главную со всем сразу».",
        "Статус «на линии», район и отзывы повышают доверие и конверсию в занятие.",
        "Выплаты и правила — в агентской оферте; оплата клиентов через ЮKassa.",
      ]}
    />
  );
}
