/** Метка опубликованного события на карте клиента (по venueLat/venueLng). */

import { publicUploadAbsoluteDisplaySrc } from "@/lib/public-uploads-display";

export type EventMapPin = {
  id: string;
  /** id карточки ленты (`catalog:…` / `event:…`) — для полноэкранного просмотра. */
  feedCardId: string;
  title: string;
  lat: number;
  lng: number;
  priceRub?: number | null;
  instructorName?: string | null;
  venueAddress?: string | null;
  photoUrl?: string | null;
  /** Рейтинг инструктора (или лучший среди офферов каталога). */
  ratingAvg?: number | null;
};

/** Уровень детализации (оставлен для совместимости; метка всегда фото + название). */
export type EventMarkerDetail = "far" | "mid" | "close";

/** Всегда полный вид: фото события в кружке и название. */
export function resolveEventMarkerDetail(_zoom?: number): EventMarkerDetail {
  return "close";
}

export const EVENT_MARKER_WIDTH = 120;
export const EVENT_MARKER_HEIGHT_FAR = 100;
export const EVENT_MARKER_HEIGHT_MID = 100;
export const EVENT_MARKER_HEIGHT_CLOSE = 100;

export function eventMarkerHeight(_detail?: EventMarkerDetail): number {
  return EVENT_MARKER_HEIGHT_CLOSE;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatEventPinPrice(priceRub: number | null | undefined): string | null {
  if (priceRub == null || !Number.isFinite(priceRub)) return null;
  return `${Math.round(priceRub).toLocaleString("ru-RU")} ₽`;
}

/** Подпись на карте — название события. */
export function eventMapLabel(pin: EventMapPin): string {
  const title = pin.title.trim() || "Событие";
  return title.length > 36 ? `${title.slice(0, 34)}…` : title;
}

export function resolveEventMarkerPhoto(pin: Pick<EventMapPin, "photoUrl">): string | null {
  return publicUploadAbsoluteDisplaySrc(pin.photoUrl);
}

function buildStarRatingLine(rating: number): string {
  const clamped = Math.max(0, Math.min(5, rating));
  const stars = Array.from({ length: 5 }, (_, index) => (clamped >= index + 1 - 0.25 ? "★" : "☆")).join(
    "",
  );
  return `${stars} ${clamped.toFixed(1)}`;
}

function eventTitleInitials(title: string): string {
  const t = title.trim();
  if (!t) return "С";
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

function buildEventPhotoHtml(pin: EventMapPin, label: string): string {
  const photoUrl = resolveEventMarkerPhoto(pin);
  const inner = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" alt="${label}" width="56" height="56" class="event-map-marker__photo-img" loading="lazy" />`
    : `<span class="event-map-marker__photo-fallback">${escapeHtml(eventTitleInitials(pin.title))}</span>`;
  return `<div class="event-map-marker__photo">${inner}</div>`;
}

export function buildEventBalloonHtml(pin: EventMapPin): string {
  const price = formatEventPinPrice(pin.priceRub);
  const photoUrl = resolveEventMarkerPhoto(pin);
  const parts: string[] = [];
  if (photoUrl) {
    parts.push(
      `<div style="margin-bottom:8px;overflow:hidden;border-radius:8px;height:88px;background:#ffedd5"><img src="${escapeHtml(photoUrl)}" alt="" width="220" height="88" style="width:100%;height:100%;object-fit:cover" /></div>`,
    );
  }
  parts.push(
    `<div style="font:600 13px/1.3 system-ui,sans-serif;color:#0f172a;max-width:220px">${escapeHtml(pin.title)}</div>`,
  );
  if (pin.ratingAvg != null && Number.isFinite(pin.ratingAvg) && pin.ratingAvg > 0) {
    parts.push(
      `<div style="margin-top:4px;font:12px/1.3 system-ui,sans-serif;color:#334155">${escapeHtml(buildStarRatingLine(pin.ratingAvg))}</div>`,
    );
  }
  if (pin.instructorName?.trim()) {
    parts.push(
      `<div style="margin-top:4px;font:12px/1.3 system-ui,sans-serif;color:#64748b">${escapeHtml(pin.instructorName.trim())}</div>`,
    );
  }
  if (pin.venueAddress?.trim()) {
    parts.push(
      `<div style="margin-top:4px;font:11px/1.35 system-ui,sans-serif;color:#64748b">${escapeHtml(pin.venueAddress.trim())}</div>`,
    );
  }
  if (price) {
    parts.push(
      `<div style="margin-top:6px;font:600 12px/1.2 system-ui,sans-serif;color:#0f766e">${escapeHtml(price)}</div>`,
    );
  }
  parts.push(
    `<div style="margin-top:8px;font:11px/1.3 system-ui,sans-serif;color:#94a3b8">Двойной клик — открыть событие</div>`,
  );
  return parts.join("");
}

/** HTML иконки: название события и фото в кружке. */
export function buildEventMarkerHtml(pin: EventMapPin, _detail?: EventMarkerDetail): string {
  const label = escapeHtml(eventMapLabel(pin));
  return `<div class="event-map-marker event-map-marker--close">
  <div class="event-map-marker__name" title="${label}">${label}</div>
  ${buildEventPhotoHtml(pin, label)}
  <div class="event-map-marker__tail" aria-hidden="true"></div>
</div>`;
}

export function createEventLeafletIconHtml(pin: EventMapPin, detail: EventMarkerDetail = "mid"): string {
  return buildEventMarkerHtml(pin, detail);
}

export function eventLeafletIconSize(detail: EventMarkerDetail): [number, number] {
  return [EVENT_MARKER_WIDTH, eventMarkerHeight(detail)];
}

export function eventLeafletIconAnchor(detail: EventMarkerDetail): [number, number] {
  const h = eventMarkerHeight(detail);
  return [EVENT_MARKER_WIDTH / 2, h];
}

export function buildEventsSignature(list: EventMapPin[]): string {
  return list
    .map(
      (e) =>
        `${e.id}|${e.feedCardId}|${e.lat}|${e.lng}|${e.title}|${e.priceRub ?? ""}|${e.photoUrl ?? ""}|${e.ratingAvg ?? ""}`,
    )
    .join("\n");
}

type YmapsLayoutFactory = {
  createClass: (template: string, overrides?: Record<string, unknown>) => unknown;
};

type YmapsWithShape = {
  templateLayoutFactory: YmapsLayoutFactory;
  shape: { Rectangle: new (geometry: unknown) => unknown };
  geometry: { pixel: { Rectangle: new (coordinates: number[][]) => unknown } };
};

/** Максимальный hit-box (уровень close). */
const EVENT_YANDEX_HIT_H = EVENT_MARKER_HEIGHT_CLOSE;

/**
 * Метка: название сверху, фото события в кружке, якорь снизу по центру.
 */
const EVENT_YANDEX_LAYOUT = [
  '<div style="position:relative;width:0;height:0;">',
  `<div class="event-map-marker event-map-marker--yandex" style="position:absolute;left:-${EVENT_MARKER_WIDTH / 2}px;top:-${EVENT_YANDEX_HIT_H}px;display:flex;width:${EVENT_MARKER_WIDTH}px;min-height:${EVENT_YANDEX_HIT_H}px;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;pointer-events:auto;user-select:none;">`,
  '<div class="event-map-marker__name" title="{{ properties.eventLabel }}">{{ properties.eventLabel }}</div>',
  '<div class="event-map-marker__photo">',
  "{% if properties.markerPhotoUrl %}",
  '<img src="{{ properties.markerPhotoUrl }}" alt="{{ properties.eventLabel }}" width="56" height="56" style="width:100%;height:100%;object-fit:cover;" />',
  "{% else %}",
  '<span class="event-map-marker__photo-fallback">{{ properties.markerInitials }}</span>',
  "{% endif %}",
  "</div>",
  '<div class="event-map-marker__tail" aria-hidden="true"></div>',
  "</div></div>",
].join("");

let eventYandexLayout: unknown = null;

export function getEventYandexLayout(ymaps: YmapsWithShape): unknown {
  if (eventYandexLayout) return eventYandexLayout;
  const halfW = EVENT_MARKER_WIDTH / 2;
  const height = EVENT_YANDEX_HIT_H;
  eventYandexLayout = ymaps.templateLayoutFactory.createClass(EVENT_YANDEX_LAYOUT, {
    getShape: function (this: { getElement: () => HTMLElement | null }) {
      if (!this.getElement()) return null;
      return new ymaps.shape.Rectangle(
        new ymaps.geometry.pixel.Rectangle([
          [-halfW, -height],
          [halfW, 0],
        ]),
      );
    },
  });
  return eventYandexLayout;
}

export function eventYandexPlacemarkProperties(pin: EventMapPin, detail: EventMarkerDetail = "close") {
  return {
    eventLabel: eventMapLabel(pin),
    detailLevel: detail,
    markerInitials: eventTitleInitials(pin.title),
    markerPhotoUrl: resolveEventMarkerPhoto(pin) ?? "",
    hintContent: pin.title,
    balloonContent: buildEventBalloonHtml(pin),
  };
}

export function eventYandexPlacemarkOptions(layout: unknown) {
  return {
    iconLayout: layout,
    iconShape: {
      type: "Rectangle",
      coordinates: [
        [-EVENT_MARKER_WIDTH / 2, -EVENT_YANDEX_HIT_H],
        [EVENT_MARKER_WIDTH / 2, 0],
      ],
    },
    zIndex: 660,
    hideIconOnBalloonOpen: false,
    openBalloonOnClick: false,
  };
}
