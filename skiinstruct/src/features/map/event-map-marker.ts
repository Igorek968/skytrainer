/** Метка опубликованного мероприятия на карте клиента (по venueLat/venueLng). */

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

/** Уровень детализации иконки по зуму карты. */
export type EventMarkerDetail = "far" | "mid" | "close";

/** Далеко — смайл; ближе — название+рейтинг; совсем близко — +фото. */
export function resolveEventMarkerDetail(zoom: number): EventMarkerDetail {
  if (zoom >= 15) return "close";
  if (zoom >= 12.5) return "mid";
  return "far";
}

export const EVENT_MARKER_WIDTH = 120;
export const EVENT_MARKER_HEIGHT_FAR = 40;
export const EVENT_MARKER_HEIGHT_MID = 56;
export const EVENT_MARKER_HEIGHT_CLOSE = 100;

export function eventMarkerHeight(detail: EventMarkerDetail): number {
  if (detail === "close") return EVENT_MARKER_HEIGHT_CLOSE;
  if (detail === "mid") return EVENT_MARKER_HEIGHT_MID;
  return EVENT_MARKER_HEIGHT_FAR;
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

/** Подпись на карте — название мероприятия. */
export function eventMapLabel(pin: EventMapPin): string {
  const title = pin.title.trim() || "Мероприятие";
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

function buildStarRatingHtml(rating: number): string {
  const clamped = Math.max(0, Math.min(5, rating));
  const stars = Array.from({ length: 5 }, (_, index) => {
    const filled = clamped >= index + 1 - 0.25;
    return `<span class="event-map-marker__star${filled ? " event-map-marker__star--filled" : ""}" aria-hidden="true">★</span>`;
  }).join("");
  return `<span class="event-map-marker__stars">${stars}</span><span class="event-map-marker__rating-value">${clamped.toFixed(1)}</span>`;
}

/** Круглый смайл-значок мероприятия (далеко). */
function buildEventSmileyHtml(): string {
  return `<div class="event-map-marker__smiley" aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="36" height="36">
    <circle cx="20" cy="20" r="18" fill="#ea580c" stroke="#fff" stroke-width="2"/>
    <circle cx="13.5" cy="16" r="2.4" fill="#fff"/>
    <circle cx="26.5" cy="16" r="2.4" fill="#fff"/>
    <path d="M12 24c2.2 3.2 5.2 4.8 8 4.8s5.8-1.6 8-4.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
  </svg>
</div>`;
}

export function buildEventBalloonHtml(pin: EventMapPin): string {
  const price = formatEventPinPrice(pin.priceRub);
  const parts = [
    `<div style="font:600 13px/1.3 system-ui,sans-serif;color:#0f172a;max-width:220px">${escapeHtml(pin.title)}</div>`,
  ];
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
    `<div style="margin-top:8px;font:11px/1.3 system-ui,sans-serif;color:#94a3b8">Двойной клик — открыть мероприятие</div>`,
  );
  return parts.join("");
}

/** HTML иконки для Leaflet / превью — зависит от зума. */
export function buildEventMarkerHtml(pin: EventMapPin, detail: EventMarkerDetail): string {
  const label = escapeHtml(eventMapLabel(pin));
  const rating =
    pin.ratingAvg != null && Number.isFinite(pin.ratingAvg) && pin.ratingAvg > 0
      ? pin.ratingAvg
      : null;
  const photoUrl = resolveEventMarkerPhoto(pin);

  if (detail === "far") {
    return `<div class="event-map-marker event-map-marker--far">${buildEventSmileyHtml()}</div>`;
  }

  const ratingHtml =
    rating != null
      ? `<div class="event-map-marker__rating">${buildStarRatingHtml(rating)}</div>`
      : `<div class="event-map-marker__rating event-map-marker__rating--empty"></div>`;

  if (detail === "mid") {
    return `<div class="event-map-marker event-map-marker--mid">
  <div class="event-map-marker__name" title="${label}">${label}</div>
  ${ratingHtml}
  ${buildEventSmileyHtml()}
</div>`;
  }

  const photoInner = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" alt="${label}" width="56" height="56" class="event-map-marker__photo-img" loading="lazy" />`
    : buildEventSmileyHtml();

  return `<div class="event-map-marker event-map-marker--close">
  <div class="event-map-marker__name" title="${label}">${label}</div>
  ${ratingHtml}
  <div class="event-map-marker__photo">${photoInner}</div>
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
 * Один layout: три уровня через {% if %} по properties.detailLevel.
 * Якорь снизу по центру.
 */
const EVENT_YANDEX_LAYOUT = [
  '<div style="position:relative;width:0;height:0;">',
  `<div class="event-map-marker event-map-marker--yandex" style="position:absolute;left:-${EVENT_MARKER_WIDTH / 2}px;top:-${EVENT_YANDEX_HIT_H}px;display:flex;width:${EVENT_MARKER_WIDTH}px;min-height:${EVENT_YANDEX_HIT_H}px;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;pointer-events:auto;user-select:none;">`,

  '{% if properties.detailLevel == "far" %}',
  '<div class="event-map-marker__smiley" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="36" height="36"><circle cx="20" cy="20" r="18" fill="#ea580c" stroke="#fff" stroke-width="2"/><circle cx="13.5" cy="16" r="2.4" fill="#fff"/><circle cx="26.5" cy="16" r="2.4" fill="#fff"/><path d="M12 24c2.2 3.2 5.2 4.8 8 4.8s5.8-1.6 8-4.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg></div>',
  "{% endif %}",

  '{% if properties.detailLevel == "mid" %}',
  '<div class="event-map-marker__name" title="{{ properties.eventLabel }}">{{ properties.eventLabel }}</div>',
  '{% if properties.markerStarsLine %}<div class="event-map-marker__rating-line">{{ properties.markerStarsLine }}</div>{% endif %}',
  '<div class="event-map-marker__smiley" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="32" height="32"><circle cx="20" cy="20" r="18" fill="#ea580c" stroke="#fff" stroke-width="2"/><circle cx="13.5" cy="16" r="2.4" fill="#fff"/><circle cx="26.5" cy="16" r="2.4" fill="#fff"/><path d="M12 24c2.2 3.2 5.2 4.8 8 4.8s5.8-1.6 8-4.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg></div>',
  "{% endif %}",

  '{% if properties.detailLevel == "close" %}',
  '<div class="event-map-marker__name" title="{{ properties.eventLabel }}">{{ properties.eventLabel }}</div>',
  '{% if properties.markerStarsLine %}<div class="event-map-marker__rating-line">{{ properties.markerStarsLine }}</div>{% endif %}',
  '<div class="event-map-marker__photo">',
  "{% if properties.markerPhotoUrl %}",
  '<img src="{{ properties.markerPhotoUrl }}" alt="{{ properties.eventLabel }}" width="56" height="56" style="width:100%;height:100%;object-fit:cover;" />',
  "{% else %}",
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#ea580c" stroke="#fff" stroke-width="2"/><circle cx="13.5" cy="16" r="2.4" fill="#fff"/><circle cx="26.5" cy="16" r="2.4" fill="#fff"/><path d="M12 24c2.2 3.2 5.2 4.8 8 4.8s5.8-1.6 8-4.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  "{% endif %}",
  "</div>",
  '<div class="event-map-marker__tail" aria-hidden="true"></div>',
  "{% endif %}",

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

export function eventYandexPlacemarkProperties(pin: EventMapPin, detail: EventMarkerDetail) {
  const rating =
    pin.ratingAvg != null && Number.isFinite(pin.ratingAvg) && pin.ratingAvg > 0
      ? pin.ratingAvg
      : null;
  return {
    eventLabel: eventMapLabel(pin),
    detailLevel: detail,
    markerStarsLine: rating != null ? buildStarRatingLine(rating) : "",
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
