import { MARKETPLACE_SPORT_CATEGORIES } from "@/shared/lib/marketplace";
import { slugifyRu } from "@/lib/seo-slug";

export type SeoCity = {
  slug: string;
  name: string;
  genitive: string; // «в Сочи»
  prepositional: string; // «в Сочи» / «в Москве»
  regionHint: string;
};

export type SeoSport = {
  slug: string;
  label: string; // с эмодзи как в каталоге
  name: string; // без эмодзи
};

/** Города/курорты с наибольшим спросом для лендингов. */
export const SEO_CITIES: SeoCity[] = [
  {
    slug: "sochi",
    name: "Сочи",
    genitive: "Сочи",
    prepositional: "в Сочи",
    regionHint: "Красная Поляна, Роза Хутор, Газпром",
  },
  {
    slug: "krasnaya-polyana",
    name: "Красная Поляна",
    genitive: "Красной Поляны",
    prepositional: "в Красной Поляне",
    regionHint: "горнолыжные курорты Сочи",
  },
  {
    slug: "moskva",
    name: "Москва",
    genitive: "Москвы",
    prepositional: "в Москве",
    regionHint: "столица и ближайшее Подмосковье",
  },
  {
    slug: "sankt-peterburg",
    name: "Санкт-Петербург",
    genitive: "Санкт-Петербурга",
    prepositional: "в Санкт-Петербурге",
    regionHint: "город и пригороды",
  },
  {
    slug: "kazan",
    name: "Казань",
    genitive: "Казани",
    prepositional: "в Казани",
    regionHint: "Республика Татарстан",
  },
  {
    slug: "ekaterinburg",
    name: "Екатеринбург",
    genitive: "Екатеринбурга",
    prepositional: "в Екатеринбурге",
    regionHint: "Урал",
  },
  {
    slug: "novosibirsk",
    name: "Новосибирск",
    genitive: "Новосибирска",
    prepositional: "в Новосибирске",
    regionHint: "Сибирь",
  },
  {
    slug: "krasnodar",
    name: "Краснодар",
    genitive: "Краснодара",
    prepositional: "в Краснодаре",
    regionHint: "юг России",
  },
  {
    slug: "kaliningrad",
    name: "Калининград",
    genitive: "Калининграда",
    prepositional: "в Калининграде",
    regionHint: "Балтика",
  },
  {
    slug: "dombay",
    name: "Домбай",
    genitive: "Домбая",
    prepositional: "на Домбае",
    regionHint: "Кавказ, горные лыжи и сноуборд",
  },
];

function sportNameFromLabel(label: string): string {
  return label.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
}

export const SEO_SPORTS: SeoSport[] = MARKETPLACE_SPORT_CATEGORIES.map((label) => {
  const name = sportNameFromLabel(label);
  return { slug: slugifyRu(name), label, name };
});

const cityBySlug = new Map(SEO_CITIES.map((c) => [c.slug, c]));
const sportBySlug = new Map(SEO_SPORTS.map((s) => [s.slug, s]));

export function getSeoCity(slug: string): SeoCity | undefined {
  return cityBySlug.get(slug);
}

export function getSeoSport(slug: string): SeoSport | undefined {
  return sportBySlug.get(slug);
}

export function citySportPath(city: SeoCity, sport: SeoSport): string {
  return `/gorod/${city.slug}/${sport.slug}`;
}

export function cityPath(city: SeoCity): string {
  return `/gorod/${city.slug}`;
}

export function sportPath(sport: SeoSport): string {
  return `/sport/${sport.slug}`;
}

export function cityLandingCopy(city: SeoCity): { title: string; description: string; h1: string; lead: string } {
  return {
    title: `Инструкторы ${city.prepositional} — найти тренера | ТвойТренер.рф`,
    description: `Персональные тренировки ${city.prepositional} на ТвойТренер.рф: инструкторы онлайн на карте, цены и отзывы, запись и оплата занятия. ${city.regionHint}.`,
    h1: `Инструкторы и тренеры ${city.prepositional}`,
    lead: `Найдите свободного инструктора ${city.prepositional} по виду спорта: сравните рейтинг и ставку, отправьте заявку на карте и оплатите занятие онлайн.`,
  };
}

export function sportLandingCopy(sport: SeoSport): { title: string; description: string; h1: string; lead: string } {
  return {
    title: `Инструктор: ${sport.name} — поиск тренера | ТвойТренер.рф`,
    description: `Найдите инструктора по направлению «${sport.name}» на ТвойТренер.рф: карта, отзывы, цены и онлайн-запись по всей России.`,
    h1: `Инструкторы: ${sport.name}`,
    lead: `Подберите тренера по «${sport.name}»: фильтр на карте, актуальный статус «онлайн», бронирование и оплата через платформу.`,
  };
}

export function citySportLandingCopy(
  city: SeoCity,
  sport: SeoSport,
): { title: string; description: string; h1: string; lead: string } {
  return {
    title: `${sport.name} ${city.prepositional} — инструктор | ТвойТренер.рф`,
    description: `Инструктор «${sport.name}» ${city.prepositional}: поиск на карте ТвойТренер.рф, отзывы, цены, запись и оплата онлайн. ${city.regionHint}.`,
    h1: `${sport.name} ${city.prepositional}`,
    lead: `Закажите персональную тренировку «${sport.name}» ${city.prepositional}: выберите инструктора на карте, отправьте заявку и оплатите занятие на ТвойТренер.рф.`,
  };
}
