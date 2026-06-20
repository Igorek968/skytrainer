import type { Metadata } from "next";

import { LEGAL_ROUTES } from "@/lib/legal";
import { getPublicProductName } from "@/shared/lib/product";

export type SeoPage = {
  title: string;
  description: string;
  path: string;
};

/** Уникальные title, description и canonical path для публичных страниц. */
export const SEO_PAGES = {
  home: {
    title: "Utrainer — маркетплейс персональных тренировок и осознанного спорта",
    description:
      "Найдите инструктора по городу и виду спорта на Utrainer: сравните цены и отзывы, забронируйте тренировку на карте и оплатите занятие онлайн через ЮKassa.",
    path: "/",
  },
  clientSearch: {
    title: "Поиск инструктора рядом — заказ тренировки | Utrainer",
    description:
      "Карта и фильтры Utrainer: выберите тренера по виду спорта, цене и рейтингу рядом с вами, оформите заказ на занятие и оплатите бронирование в личном кабинете.",
    path: "/client",
  },
  clientLogin: {
    title: "Вход в личный кабинет клиента | Utrainer",
    description:
      "Авторизация клиента на Utrainer по email и паролю: доступ к заказам, чату с инструктором, оплате занятий и истории тренировок после входа в аккаунт.",
    path: "/login",
  },
  instructorLogin: {
    title: "Вход в кабинет инструктора | Utrainer",
    description:
      "Вход для инструкторов Utrainer: управление расписанием, заявками клиентов, статусом «онлайн» и выплатами. Используйте email и пароль из анкеты после одобрения профиля.",
    path: "/instructor/login",
  },
  clientRegister: {
    title: "Регистрация клиента — создать аккаунт | Utrainer",
    description:
      "Создайте аккаунт клиента на Utrainer: укажите email и пароль, чтобы искать инструкторов на карте, бронировать персональные тренировки и оплачивать занятия онлайн.",
    path: "/register",
  },
  resetPassword: {
    title: "Восстановление пароля | Utrainer",
    description:
      "Сброс пароля Utrainer: введите email аккаунта — отправим ссылку для установки нового пароля. Подходит для клиентов и инструкторов, зарегистрированных на платформе.",
    path: "/reset-password",
  },
  adminLogin: {
    title: "Вход администратора платформы | Utrainer",
    description:
      "Авторизация администратора Utrainer: модерация заявок инструкторов, управление заказами, финансами и настройками сервиса. Доступ только для учётных записей с ролью ADMIN.",
    path: "/admin/login",
  },
  instructorApply: {
    title: "Стать инструктором — подать заявку | Utrainer",
    description:
      "Заявка инструктора на Utrainer: заполните анкету со ставкой, специализацией и реквизитами. После проверки администратором профиль появится в поиске для клиентов по всей России.",
    path: "/instructor/apply",
  },
  support: {
    title: "Поддержка и помощь пользователям | Utrainer",
    description:
      "Служба поддержки Utrainer: вопросы об оплате через ЮKassa, работе личного кабинета, бронировании и аккаунте. Откройте чат — по конкретному занятию пишите инструктору в заказе.",
    path: "/support",
  },
  requisites: {
    title: "Реквизиты ИП Ершов А.В. — оператор платформы Utrainer",
    description:
      "Банковские и регистрационные реквизиты оператора сервиса Utrainer (ИП Ершов А.В.): ИНН, ОГРНИП, расчётный счёт и контакты для договоров, оплаты и юридических обращений.",
    path: LEGAL_ROUTES.requisites,
  },
  privacy: {
    title: "Политика конфиденциальности Utrainer — обработка персональных данных",
    description:
      "Как Utrainer собирает, хранит и защищает персональные данные клиентов и инструкторов: цели обработки, права пользователей, cookies, передача третьим лицам и контакты оператора.",
    path: LEGAL_ROUTES.privacy,
  },
  returns: {
    title: "Возврат и отмена занятий на Utrainer — правила и сроки",
    description:
      "Правила отмены тренировок и возврата оплаты на Utrainer: сроки уведомления, штрафы, частичные возвраты, претензии по качеству занятия и порядок расчётов через ЮKassa.",
    path: LEGAL_ROUTES.returns,
  },
  oferta: {
    title: "Договор-оферта на подбор инструктора | Utrainer",
    description:
      "Публичная оферта Utrainer для клиентов: условия подбора инструктора, бронирования занятия, оплаты через ЮKassa, отмены, возвратов, ответственности сторон и порядок разрешения споров.",
    path: LEGAL_ROUTES.oferta,
  },
  ofertaInstructor: {
    title: "Агентский договор для инструкторов | Utrainer",
    description:
      "Оферта Utrainer для самозанятых и ИП-инструкторов: комиссия платформы, порядок выплат, чеки НПД, отмены занятий, ответственность и условия размещения профиля в поиске клиентов.",
    path: LEGAL_ROUTES.ofertaInstructor,
  },
} as const satisfies Record<string, SeoPage>;

/** Публичные URL для sitemap (без закрытых кабинетов и API). */
export const PUBLIC_SITEMAP_PAGES: SeoPage[] = [
  SEO_PAGES.home,
  SEO_PAGES.clientSearch,
  SEO_PAGES.clientLogin,
  SEO_PAGES.clientRegister,
  SEO_PAGES.resetPassword,
  SEO_PAGES.instructorLogin,
  SEO_PAGES.support,
  SEO_PAGES.oferta,
  SEO_PAGES.ofertaInstructor,
  SEO_PAGES.privacy,
  SEO_PAGES.returns,
  SEO_PAGES.requisites,
];

export function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3001";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3001";
  }
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin()}${normalized}`;
}

/** Абсолютный title, Open Graph, Twitter Card и canonical. */
export function pageMetadata(page: SeoPage): Metadata {
  const url = absoluteUrl(page.path);
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "ru_RU",
      url,
      siteName: getPublicProductName(),
      title: page.title,
      description: page.description,
    },
    twitter: {
      card: "summary",
      title: page.title,
      description: page.description,
    },
  };
}

export function siteJsonLd(): Record<string, unknown>[] {
  const origin = siteOrigin();
  const productName = getPublicProductName();
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: productName,
      url: origin,
      logo: `${origin}/icon.svg`,
      email: "berezka23igor@yandex.ru",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: productName,
      url: origin,
      description: SEO_PAGES.home.description,
      inLanguage: "ru-RU",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${origin}/client`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}
