import { absoluteUrl } from "@/lib/seo";

export type FaqItem = { question: string; answer: string };

export type BreadcrumbItem = { name: string; path: string };

export function faqPageJsonLd(faqs: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}

export function howToJsonLd(input: {
  name: string;
  description: string;
  steps: string[];
  url?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    url: input.url ? absoluteUrl(input.url) : undefined,
    step: input.steps.map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: `Шаг ${i + 1}`,
      text,
    })),
  };
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function reviewJsonLd(input: {
  itemName: string;
  itemUrl: string;
  ratingValue: number;
  reviewBody?: string | null;
  authorName?: string | null;
  datePublished?: string | Date | null;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: {
      "@type": "Person",
      name: input.itemName,
      url: absoluteUrl(input.itemUrl),
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: input.ratingValue,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody: input.reviewBody || undefined,
    author: {
      "@type": "Person",
      name: input.authorName?.trim() || "Ученик",
    },
    datePublished: input.datePublished
      ? new Date(input.datePublished).toISOString()
      : undefined,
  };
}

/** Общие FAQ сервиса — главная, /faq, лендинги. */
export const SITE_FAQS: FaqItem[] = [
  {
    question: "ТвойТренер.рф — это ИИ-тренер или «сайт, который тренирует»?",
    answer:
      "Нет. ТвойТренер.рф — маркетплейс живых инструкторов, тренеров и гидов. Вы выбираете реального человека на карте, сравниваете отзывы и ставку, бронируете персональную тренировку и оплачиваете онлайн через ЮKassa. Сервис не заменяет занятие программой или чат-ботом и не «тренирует» вас сам.",
  },
  {
    question: "Где заказать услуги персонального тренера или инструктора рядом?",
    answer:
      "Откройте карту на ТвойТренер.рф, отметьте точку встречи и вид спорта. В выдаче только профили после модерации: сравните рейтинг, цену ₽/час и отзывы, отправьте заявку и оплатите занятие на платформе.",
  },
  {
    question: "Где найти проверенного инструктора рядом с собой?",
    answer:
      "На ТвойТренер.рф откройте карту на главной, выберите вид спорта и точку встречи. В выдаче только инструкторы, прошедшие модерацию: сравните рейтинг, ставку и отзывы, затем отправьте заявку.",
  },
  {
    question: "Как оплатить тренировку на ТвойТренер.рф?",
    answer:
      "После подтверждения заявки инструктором оплата проходит онлайн через ЮKassa в личном кабинете клиента. Наличные вне платформы для бронирований сервиса не требуются.",
  },
  {
    question: "Можно ли отменить занятие и вернуть оплату?",
    answer:
      "Да. Правила сроков, частичных возвратов и претензий по качеству описаны в разделе «Возврат» на сайте. Отмену удобно оформить в заказе; детали зависят от времени до начала занятия.",
  },
  {
    question: "Как стать инструктором на ТвойТренер.рф?",
    answer:
      "Подайте заявку в разделе «Стать инструктором»: анкета со ставкой, специализацией и реквизитами. После проверки администратором профиль появится в поиске для клиентов по всей России.",
  },
  {
    question: "В каких городах работает сервис?",
    answer:
      "Сервис работает по всей России. Есть отдельные страницы для Сочи, Красной Поляны, Москвы, Санкт-Петербурга, Казани, Екатеринбурга, Новосибирска, Краснодара, Калининграда и Домбая — плюс поиск по карте в любом городе.",
  },
];

export const BOOKING_HOW_TO_STEPS = [
  "Откройте карту на ТвойТренер.рф и выберите вид спорта.",
  "Сравните инструкторов рядом: рейтинг, ставка (₽/час), отзывы и статус «онлайн».",
  "Отправьте заявку — инструктор отвечает в чате заказа.",
  "Оплатите занятие онлайн через ЮKassa и приходите на встречу.",
];
