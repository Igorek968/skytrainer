import type { Metadata } from "next";

import { LEGAL_ROUTES } from "@/lib/legal";
import { SEO_CITIES, SEO_SPORTS, cityPath, citySportPath, sportPath } from "@/lib/seo-landings";
import { getPublicProductName } from "@/shared/lib/product";

/** Публичный телефон карточки Яндекс / контактов (E.164). */
const ORG_PHONE =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "+79103564419";

/** Текст «О компании» — тот же смысл, что в Яндекс Бизнесе. */
export const ORG_ABOUT =
  "ТвойТренер.рф — маркетплейс персональных тренировок в Сочи и дальше. Найдите инструктора, тренера или гида на карте, отправьте заявку и оплатите занятие онлайн. Инструкторам — заявки с карты, свой график и прозрачная оплата через ЮKassa. Юридический адрес — точка регистрации компании; занятия проходят у инструкторов по городу.";

export type SeoPage = {
  title: string;
  description: string;
  path: string;
};

/** Уникальные title, description и canonical path для публичных страниц. */
export const SEO_PAGES = {
  home: {
    title: "ТвойТренер.рф — маркетплейс персональных тренировок и осознанного спорта",
    description:
      "Найдите инструктора по городу и виду спорта на ТвойТренер.рф: сравните цены и отзывы, забронируйте тренировку на карте и оплатите занятие онлайн через ЮKassa.",
    path: "/",
  },
  clientSearch: {
    title: "Поиск инструктора рядом — заказ тренировки | ТвойТренер.рф",
    description:
      "Карта и фильтры ТвойТренер.рф: выберите тренера по виду спорта, цене и рейтингу рядом с вами, оформите заказ на занятие и оплатите бронирование в личном кабинете.",
    path: "/",
  },
  clientLogin: {
    title: "Вход в личный кабинет клиента | ТвойТренер.рф",
    description:
      "Авторизация клиента на ТвойТренер.рф по email и паролю: доступ к заказам, чату с инструктором, оплате занятий и истории тренировок после входа в аккаунт.",
    path: "/login",
  },
  instructorLogin: {
    title: "Вход в кабинет инструктора | ТвойТренер.рф",
    description:
      "Вход для инструкторов ТвойТренер.рф: управление расписанием, заявками клиентов, статусом «онлайн» и выплатами. Используйте email и пароль из анкеты после одобрения профиля.",
    path: "/instructor/login",
  },
  clientRegister: {
    title: "Регистрация клиента — создать аккаунт | ТвойТренер.рф",
    description:
      "Создайте аккаунт клиента на ТвойТренер.рф: укажите email и пароль, чтобы искать инструкторов на карте, бронировать персональные тренировки и оплачивать занятия онлайн.",
    path: "/register",
  },
  resetPassword: {
    title: "Восстановление пароля | ТвойТренер.рф",
    description:
      "Сброс пароля ТвойТренер.рф: введите email аккаунта — отправим ссылку для установки нового пароля. Подходит для клиентов и инструкторов, зарегистрированных на платформе.",
    path: "/reset-password",
  },
  adminLogin: {
    title: "Вход администратора платформы | ТвойТренер.рф",
    description:
      "Авторизация администратора ТвойТренер.рф: модерация заявок инструкторов, управление заказами, финансами и настройками сервиса. Доступ только для учётных записей с ролью ADMIN.",
    path: "/admin/login",
  },
  instructorApply: {
    title: "Стать инструктором — подать заявку | ТвойТренер.рф",
    description:
      "Заявка инструктора на ТвойТренер.рф: заполните анкету со ставкой, специализацией и реквизитами. После проверки администратором профиль появится в поиске для клиентов по всей России.",
    path: "/instructor/apply",
  },
  vakansiya: {
    title: "Вакансия инструктора / тренера / гида в Сочи — ТвойТренер.рф",
    description:
      "Набор инструкторов, тренеров и гидов на ТвойТренер.рф в Сочи: заявки с карты, свой график, оплата ЮKassa. Анкета онлайн без штатного оклада.",
    path: "/vakansiya",
  },
  support: {
    title: "Поддержка и помощь пользователям | ТвойТренер.рф",
    description:
      "Служба поддержки ТвойТренер.рф: вопросы об оплате через ЮKassa, работе личного кабинета, бронировании и аккаунте. Откройте чат — по конкретному занятию пишите инструктору в заказе.",
    path: "/support",
  },
  requisites: {
    title: "Реквизиты ООО «ТВОЙТРЕНЕР» — оператор платформы ТвойТренер.рф",
    description:
      "Банковские и регистрационные реквизиты оператора сервиса ТвойТренер.рф (ООО «ТВОЙТРЕНЕР»): ИНН, ОГРН, расчётный счёт и контакты для договоров, оплаты и юридических обращений.",
    path: LEGAL_ROUTES.requisites,
  },
  privacy: {
    title: "Политика конфиденциальности ТвойТренер.рф — обработка персональных данных",
    description:
      "Как ТвойТренер.рф собирает, хранит и защищает персональные данные клиентов и инструкторов: цели обработки, права пользователей, cookies, передача третьим лицам и контакты оператора.",
    path: LEGAL_ROUTES.privacy,
  },
  returns: {
    title: "Возврат и отмена занятий на ТвойТренер.рф — правила и сроки",
    description:
      "Правила отмены тренировок и возврата оплаты на ТвойТренер.рф: сроки уведомления, штрафы, частичные возвраты, претензии по качеству занятия и порядок расчётов через ЮKassa.",
    path: LEGAL_ROUTES.returns,
  },
  oferta: {
    title: "Договор бронирования услуг (публичная оферта) | ТвойТренер.рф",
    description:
      "Публичная оферта ООО «ТВОЙТРЕНЕР»: бронирование инструктора, агентская схема (комиссия 15%), оплата через ЮKassa, чек на обучение у инструктора НПД/ИП, отмена (более 24 ч — 100%, 2–24 ч — 50%).",
    path: LEGAL_ROUTES.oferta,
  },
  ofertaInstructor: {
    title: "Договор для инструкторов | ТвойТренер.рф",
    description:
      "Оферта ТвойТренер.рф для самозанятых и ИП-инструкторов: комиссия платформы, порядок выплат, чеки НПД, отмены занятий, ответственность и условия размещения профиля в поиске клиентов.",
    path: LEGAL_ROUTES.ofertaInstructor,
  },
  faq: {
    title: "Частые вопросы о ТвойТренер.рф — поиск инструктора и оплата",
    description:
      "FAQ ТвойТренер.рф: как найти проверенного инструктора на карте, оплатить через ЮKassa, отменить занятие, стать инструктором и в каких городах работает сервис.",
    path: "/faq",
  },
  guideChooseInstructor: {
    title: "Как выбрать инструктора — гайд ТвойТренер.рф",
    description:
      "Как выбрать инструктора на ТвойТренер.рф: рейтинг, отзывы, ставка ₽/час, специализация, статус «онлайн» и безопасная оплата. Пошаговый гайд для клиентов.",
    path: "/gid/kak-vybrat-instruktora",
  },
  guideFirstSkiSochi: {
    title: "Первый урок горных лыж в Сочи — гайд ТвойТренер.рф",
    description:
      "Первый урок горных лыж в Сочи и Красной Поляне: как найти инструктора на ТвойТренер.рф, что взять с собой, ориентир цены и безопасная запись с оплатой онлайн.",
    path: "/gid/pervyj-urok-gornye-lyzhi-sochi",
  },
} as const satisfies Record<string, SeoPage>;

/** Публичные URL для sitemap (без утилит входа и закрытых кабинетов). */
export const PUBLIC_SITEMAP_PAGES: SeoPage[] = [
  SEO_PAGES.home,
  SEO_PAGES.instructorApply,
  SEO_PAGES.vakansiya,
  SEO_PAGES.support,
  SEO_PAGES.faq,
  SEO_PAGES.guideChooseInstructor,
  SEO_PAGES.guideFirstSkiSochi,
  SEO_PAGES.oferta,
  SEO_PAGES.ofertaInstructor,
  SEO_PAGES.privacy,
  SEO_PAGES.returns,
  SEO_PAGES.requisites,
];

export function landingSitemapPages(): SeoPage[] {
  const pages: SeoPage[] = [];
  for (const city of SEO_CITIES) {
    const c = cityLandingMeta(city.slug);
    if (c) pages.push(c);
    for (const sport of SEO_SPORTS) {
      pages.push({
        title: `${sport.name} ${city.prepositional}`,
        description: "",
        path: citySportPath(city, sport),
      });
    }
  }
  for (const sport of SEO_SPORTS) {
    pages.push({
      title: sport.name,
      description: "",
      path: sportPath(sport),
    });
  }
  return pages;
}

function cityLandingMeta(slug: string): SeoPage | null {
  const city = SEO_CITIES.find((c) => c.slug === slug);
  if (!city) return null;
  return {
    title: `Инструкторы ${city.prepositional}`,
    description: "",
    path: cityPath(city),
  };
}

export function siteOrigin(): string {
  const raw =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://твойтренер.рф";
  try {
    const url = new URL(raw);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      url.protocol = "https:";
    }
    return url.origin;
  } catch {
    return "http://localhost:3001";
  }
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin()}${normalized}`;
}

/** Абсолютный title, Open Graph, Twitter Card и canonical. */
export function pageMetadata(page: SeoPage): Metadata {
  const url = absoluteUrl(page.path);
  const productName = getPublicProductName();
  const ogImage = {
    url: "/brand/press/logo-horizontal-on-white.png",
    width: 1099,
    height: 516,
    alt: productName,
  };
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "ru_RU",
      url,
      siteName: productName,
      title: page.title,
      description: page.description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [ogImage.url],
    },
  };
}

function organizationSameAs(): string[] {
  const fromEnv = (process.env.SEO_SAME_AS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Публичные якоря бренда (дополняйте SEO_SAME_AS соцсетями и Картами).
  const defaults = [absoluteUrl("/"), absoluteUrl("/llms.txt")];
  return [...new Set([...fromEnv, ...defaults])];
}

export function siteJsonLd(): Record<string, unknown>[] {
  const origin = siteOrigin();
  const productName = getPublicProductName();
  const organizationId = `${origin}/#organization`;
  const websiteId = `${origin}/#website`;
  return [
    {
      "@context": "https://schema.org",
      "@type": ["Organization", "LocalBusiness"],
      "@id": organizationId,
      name: productName,
      alternateName: ["ТвойТренер", "Твой Тренер", "tvoytrener"],
      legalName: 'ООО "ТВОЙТРЕНЕР"',
      description: ORG_ABOUT,
      url: origin,
      logo: {
        "@type": "ImageObject",
        url: `${origin}/brand/press/logo-horizontal-on-white.png`,
        width: 1099,
        height: 516,
      },
      image: `${origin}/favicon-120.png`,
      email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "tvoitrenerrf@yandex.ru",
      telephone: ORG_PHONE,
      address: {
        "@type": "PostalAddress",
        streetAddress: "Урожайная улица, 35/2",
        addressLocality: "Сочи",
        addressRegion: "Краснодарский край",
        postalCode: "354375",
        addressCountry: "RU",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 43.406121,
        longitude: 39.990464,
      },
      openingHoursSpecification: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "09:00",
        closes: "21:00",
      },
      priceRange: "₽₽",
      sameAs: organizationSameAs(),
      areaServed: [
        { "@type": "City", name: "Сочи" },
        { "@type": "Country", name: "Россия" },
      ],
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer support",
          telephone: ORG_PHONE,
          email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "tvoitrenerrf@yandex.ru",
          availableLanguage: ["Russian"],
          url: origin,
        },
      ],
      knowsAbout: [
        "персональные тренировки",
        "инструктор",
        "тренер",
        "гид",
        "маркетплейс спорта",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": websiteId,
      name: productName,
      url: origin,
      description: SEO_PAGES.home.description,
      inLanguage: "ru-RU",
      publisher: { "@id": organizationId },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${origin}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}
