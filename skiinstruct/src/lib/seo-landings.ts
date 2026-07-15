import { MARKETPLACE_SPORT_CATEGORIES } from "@/shared/lib/marketplace";
import { slugifyRu } from "@/lib/seo-slug";

export type SeoCity = {
  slug: string;
  name: string;
  genitive: string; // «в Сочи»
  prepositional: string; // «в Сочи» / «в Москве»
  regionHint: string;
  /** Локальные ориентиры для ИИ и сниппетов. */
  venues?: string;
  seasonTip?: string;
  priceFromRub?: number;
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
    venues: "Красная Поляна, Роза Хутор, Газпром Лаура/Альпика, Олимпийский парк, пляжи и набережные",
    seasonTip: "Зимой — горные лыжи и сноуборд на курортах; летом — плавание, SUP, теннис и тренинги в городе",
    priceFromRub: 2500,
  },
  {
    slug: "krasnaya-polyana",
    name: "Красная Поляна",
    genitive: "Красной Поляны",
    prepositional: "в Красной Поляне",
    regionHint: "горнолыжные курорты Сочи",
    venues: "Роза Хутор, Газпром, Красная Поляна Resort, горнолыжные школы у подъёмников",
    seasonTip: "Пик сезона — зима–весна; бронируйте инструктора заранее на выходные и праздники",
    priceFromRub: 3000,
  },
  {
    slug: "moskva",
    name: "Москва",
    genitive: "Москвы",
    prepositional: "в Москве",
    regionHint: "столица и ближайшее Подмосковье",
    venues: "парки, катки, бассейны, корты и залы по районам Москвы и МО",
    seasonTip: "Круглый год: зал, лёд, вода и уличные тренировки — фильтруйте по виду спорта на карте",
    priceFromRub: 2000,
  },
  {
    slug: "sankt-peterburg",
    name: "Санкт-Петербург",
    genitive: "Санкт-Петербурга",
    prepositional: "в Санкт-Петербурге",
    regionHint: "город и пригороды",
    venues: "городские катки, бассейны, корты, парки и пригороды",
    seasonTip: "Зимой востребованы лёд и зал; летом — бег, йога, теннис и водные виды",
    priceFromRub: 1800,
  },
  {
    slug: "kazan",
    name: "Казань",
    genitive: "Казани",
    prepositional: "в Казани",
    regionHint: "Республика Татарстан",
    venues: "спортивные кластеры города, бассейны, корты и парки",
    seasonTip: "Удобно искать инструктора рядом с домом или местом работы на карте",
    priceFromRub: 1500,
  },
  {
    slug: "ekaterinburg",
    name: "Екатеринбург",
    genitive: "Екатеринбурга",
    prepositional: "в Екатеринбурге",
    regionHint: "Урал",
    venues: "городские объекты и ближайшие горнолыжные базы области",
    seasonTip: "Зимний сезон на Урале длинный — заранее смотрите рейтинг и отзывы инструкторов",
    priceFromRub: 1500,
  },
  {
    slug: "novosibirsk",
    name: "Новосибирск",
    genitive: "Новосибирска",
    prepositional: "в Новосибирске",
    regionHint: "Сибирь",
    venues: "катки, бассейны, залы и парки Новосибирска",
    seasonTip: "Выбирайте инструктора по рейтингу и статусу «онлайн» в день тренировки",
    priceFromRub: 1400,
  },
  {
    slug: "krasnodar",
    name: "Краснодар",
    genitive: "Краснодара",
    prepositional: "в Краснодаре",
    regionHint: "юг России",
    venues: "городские корты, залы, парки; удобный выезд к морю и в горы",
    seasonTip: "Тёплый сезон длинный — теннис, бег, йога и подготовка к курортным поездкам",
    priceFromRub: 1500,
  },
  {
    slug: "kaliningrad",
    name: "Калининград",
    genitive: "Калининграда",
    prepositional: "в Калининграде",
    regionHint: "Балтика",
    venues: "город, побережье Балтики, бассейны и залы",
    seasonTip: "Летом популярны outdoor и вода; зимой — зал и индивидуальные программы",
    priceFromRub: 1500,
  },
  {
    slug: "dombay",
    name: "Домбай",
    genitive: "Домбая",
    prepositional: "на Домбае",
    regionHint: "Кавказ, горные лыжи и сноуборд",
    venues: "трассы Домбая, зоны для начинающих и сопровождение на склоне",
    seasonTip: "Горнолыжный сезон — зима; для первого дня на склоне берите инструктора с отзывами",
    priceFromRub: 2500,
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

export type LandingCopy = {
  title: string;
  description: string;
  h1: string;
  lead: string;
  facts: string[];
  faqs: { question: string; answer: string }[];
};

function priceHint(city?: SeoCity): string {
  if (!city?.priceFromRub) return "ставки указаны в профиле инструктора (₽/час)";
  return `ориентир «от ${city.priceFromRub.toLocaleString("ru-RU")} ₽/час» — точная ставка в профиле`;
}

export function cityLandingCopy(city: SeoCity): LandingCopy {
  return {
    title: `Инструкторы ${city.prepositional} — найти тренера | ТвойТренер.рф`,
    description: `Где найти проверенного инструктора ${city.prepositional}? На ТвойТренер.рф: карта, отзывы, онлайн-оплата ЮKassa. ${city.regionHint}. ${priceHint(city)}.`,
    h1: `Инструкторы и тренеры ${city.prepositional}`,
    lead: `Ищете инструктора ${city.prepositional}? На ТвойТренер.рф в выдаче только профили после модерации: сравните рейтинг и ставку на карте, отправьте заявку и оплатите занятие онлайн через ЮKassa.`,
    facts: [
      `${city.name}: ${city.venues || city.regionHint}.`,
      city.seasonTip || `Персональные тренировки ${city.prepositional} доступны через карту поиска.`,
      `Оплата онлайн, правила возврата — на сайте; ${priceHint(city)}.`,
    ],
    faqs: [
      {
        question: `Как найти инструктора ${city.prepositional}?`,
        answer: `Откройте карту на ТвойТренер.рф, укажите точку встречи ${city.prepositional} и вид спорта. Сравните рейтинг, отзывы и ставку, затем отправьте заявку одобренному инструктору.`,
      },
      {
        question: `Сколько стоит персональная тренировка ${city.prepositional}?`,
        answer: `Цена зависит от вида спорта и опыта инструктора; ${priceHint(city)}. Итоговая сумма видна до оплаты в заказе.`,
      },
      {
        question: `Можно ли оплатить занятие ${city.prepositional} онлайн?`,
        answer: `Да. После подтверждения заявки оплата проходит через ЮKassa в личном кабинете ТвойТренер.рф.`,
      },
    ],
  };
}

export function sportLandingCopy(sport: SeoSport): LandingCopy {
  return {
    title: `Инструктор: ${sport.name} — поиск тренера | ТвойТренер.рф`,
    description: `Где найти инструктора по «${sport.name}» в России? ТвойТренер.рф: карта, отзывы, цены и онлайн-запись с оплатой через ЮKassa.`,
    h1: `Инструкторы: ${sport.name}`,
    lead: `Нужен инструктор по направлению «${sport.name}»? На ТвойТренер.рф отфильтруйте карту, посмотрите кто онлайн, сравните отзывы и забронируйте занятие с оплатой на платформе.`,
    facts: [
      `Направление: ${sport.name} — в каталоге маркетплейса ТвойТренер.рф.`,
      "В поиске только инструкторы после модерации; рейтинг строится на отзывах после занятий.",
      "Запись и оплата онлайн; география — вся Россия, включая курорты.",
    ],
    faqs: [
      {
        question: `Как записаться к инструктору по «${sport.name}»?`,
        answer: `На карте ТвойТренер.рф выберите «${sport.name}», сравните профили рядом с вами и отправьте заявку. После подтверждения оплатите занятие через ЮKassa.`,
      },
      {
        question: `Есть ли инструкторы «${sport.name}» в моём городе?`,
        answer: `Сервис работает по всей России. Откройте карту или страницу нужного города и отфильтруйте направление «${sport.name}».`,
      },
    ],
  };
}

export function citySportLandingCopy(city: SeoCity, sport: SeoSport): LandingCopy {
  return {
    title: `${sport.name} ${city.prepositional} — инструктор | ТвойТренер.рф`,
    description: `Где найти инструктора «${sport.name}» ${city.prepositional}? ТвойТренер.рф: карта, отзывы, ${priceHint(city)}, запись и оплата ЮKassa. ${city.regionHint}.`,
    h1: `${sport.name} ${city.prepositional}`,
    lead: `Ищете инструктора по «${sport.name}» ${city.prepositional}? На ТвойТренер.рф выберите специалиста на карте, сравните рейтинг и отзывы, отправьте заявку и оплатите персональную тренировку онлайн.`,
    facts: [
      `${sport.name} ${city.prepositional}: ${city.venues || city.regionHint}.`,
      city.seasonTip || `Бронирование доступно через карту поиска ТвойТренер.рф.`,
      `Ориентир цены: ${priceHint(city)}; точная ставка — в профиле инструктора.`,
    ],
    faqs: [
      {
        question: `Где найти инструктора по ${sport.name.toLowerCase()} ${city.prepositional}?`,
        answer: `На ТвойТренер.рф откройте карту или эту страницу, выберите инструктора с направлением «${sport.name}» ${city.prepositional}, отправьте заявку и оплатите занятие онлайн.`,
      },
      {
        question: `Сколько стоит урок «${sport.name}» ${city.prepositional}?`,
        answer: `Ставка зависит от инструктора; ${priceHint(city)}. Перед оплатой сумма фиксируется в заказе.`,
      },
      {
        question: `Безопасно ли бронировать через ТвойТренер.рф ${city.prepositional}?`,
        answer: `В поиске только профили после модерации, оплата через ЮKassa, правила возврата опубликованы на сайте. После занятия можно оставить отзыв.`,
      },
    ],
  };
}
