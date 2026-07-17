/** Метка опубликованного мероприятия на карте клиента (по venueLat/venueLng). */

export type EventMapPin = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  priceRub?: number | null;
  instructorName?: string | null;
  venueAddress?: string | null;
};

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

export function buildEventBalloonHtml(pin: EventMapPin): string {
  const price = formatEventPinPrice(pin.priceRub);
  const parts = [
    `<div style="font:600 13px/1.3 system-ui,sans-serif;color:#0f172a;max-width:220px">${escapeHtml(pin.title)}</div>`,
  ];
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
  return parts.join("");
}

/** Leaflet divIcon: булавка + подпись с названием. */
export function createEventLeafletIconHtml(pin: EventMapPin): string {
  const label = escapeHtml(eventMapLabel(pin));
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:auto;user-select:none;">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42" aria-hidden="true">
    <path fill="#c2410c" stroke="#fff" stroke-width="1.5" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>
    <circle cx="12" cy="12" r="4.2" fill="#fff"/>
  </svg>
  <span style="max-width:120px;padding:2px 6px;border-radius:6px;background:rgba(15,23,42,.92);color:#fff;font:600 11px/1.25 system-ui,sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.25)">${label}</span>
</div>`;
}

export function buildEventsSignature(list: EventMapPin[]): string {
  return list.map((e) => `${e.id}|${e.lat}|${e.lng}|${e.title}|${e.priceRub ?? ""}`).join("\n");
}

type YmapsLayoutFactory = {
  createClass: (template: string, overrides?: Record<string, unknown>) => unknown;
};

type YmapsWithShape = {
  templateLayoutFactory: YmapsLayoutFactory;
  shape: { Rectangle: new (geometry: unknown) => unknown };
  geometry: { pixel: { Rectangle: new (coordinates: number[][]) => unknown } };
};

const EVENT_MARKER_W = 120;
const EVENT_MARKER_H = 64;

const EVENT_YANDEX_LAYOUT = [
  '<div style="position:relative;width:0;height:0;">',
  `<div style="position:absolute;left:-${EVENT_MARKER_W / 2}px;top:-${EVENT_MARKER_H}px;display:flex;width:${EVENT_MARKER_W}px;flex-direction:column;align-items:center;gap:2px;pointer-events:auto;user-select:none;">`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42" aria-hidden="true"><path fill="#c2410c" stroke="#fff" stroke-width="1.5" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/><circle cx="12" cy="12" r="4.2" fill="#fff"/></svg>`,
  '<span style="max-width:120px;padding:2px 6px;border-radius:6px;background:rgba(15,23,42,.92);color:#fff;font:600 11px/1.25 system-ui,sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.25)">{{ properties.eventLabel }}</span>',
  "</div></div>",
].join("");

let eventYandexLayout: unknown = null;

export function getEventYandexLayout(ymaps: YmapsWithShape): unknown {
  if (eventYandexLayout) return eventYandexLayout;
  const halfW = EVENT_MARKER_W / 2;
  const height = EVENT_MARKER_H;
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

export function eventYandexPlacemarkProperties(pin: EventMapPin) {
  return {
    eventLabel: eventMapLabel(pin),
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
        [-EVENT_MARKER_W / 2, -EVENT_MARKER_H],
        [EVENT_MARKER_W / 2, 0],
      ],
    },
    zIndex: 660,
    hideIconOnBalloonOpen: false,
  };
}
