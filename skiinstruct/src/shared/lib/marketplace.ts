import { INSTRUCTOR_ACTIVITY_LABELS } from "@/lib/services/instructor-match";
import { getPublicProductName } from "@/shared/lib/product";

/** Радиус «кто онлайн рядом» по умолчанию (км). */
export const MARKETPLACE_NEARBY_RADIUS_KM = 5;

export const MARKETPLACE_TAGLINE =
  "Маркетплейс тренеров и инструкторов по всей России — найдите свободного специалиста рядом и отправьте заявку на сегодня.";

export function getMarketplaceName(): string {
  return getPublicProductName();
}

export const MARKETPLACE_SPORT_CATEGORIES = INSTRUCTOR_ACTIVITY_LABELS;

export const MARKETPLACE_FLOW = [
  {
    step: "1",
    title: "Выберите направление и точку",
    text: "Лыжи, теннис, поход, SUP и др. Укажите место встречи на карте — поиск в радиусе 5 км, сервис работает по всей России.",
  },
  {
    step: "2",
    title: "Смотрите онлайн и рейтинг",
    text: "Список одобренных инструкторов: сначала кто онлайн рядом, затем сортировка по расстоянию и оценке.",
  },
  {
    step: "3",
    title: "Отправьте заявку",
    text: "Инструктор получает запрос и отвечает в течение минуты (или подтверждает запись на дату).",
  },
  {
    step: "4",
    title: "Занятие и отзывы",
    text: "После занятия клиент и инструктор оставляют взаимные отзывы — рейтинг влияет на выдачу.",
  },
] as const;

export const MARKETPLACE_ROADMAP = [
  { phase: "Сейчас (MVP)", items: ["Карта и поиск 5 км", "Заявка инструктору", "Модерация в админке", "Вход/регистрация клиента"] },
  {
    phase: "Далее",
    items: ["Подача заявки инструктором с анкетой", "Оплата на платформе", "Push-уведомления", "Расширенные фильтры"],
  },
  {
    phase: "Потом",
    items: ["Комиссия и выплаты", "Верификация документов", "Мобильное PWA", "Аналитика для инструкторов"],
  },
] as const;
