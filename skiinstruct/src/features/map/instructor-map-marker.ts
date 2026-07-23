import L from "leaflet";

import { publicUploadAbsoluteDisplaySrc } from "@/lib/public-uploads-display";

export type InstructorMapPin = {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  hourlyRate: number;
  ratingAvg: number;
  distanceKm: number;
  photoUrl?: string | null;
  image?: string | null;
  specializations?: string[];
  /** Выбранное направление поиска или дисциплина заказа — приоритет в подписи. */
  sportLabel?: string | null;
};

export function resolveInstructorSportLabel(
  pin: Pick<InstructorMapPin, "specializations" | "sportLabel">,
): string | null {
  const list = pin.specializations?.map((s) => s.trim()).filter(Boolean) ?? [];
  const preferred = pin.sportLabel?.trim();
  if (preferred && list.length > 0) {
    const match = list.find((s) => s === preferred);
    if (match) return match;
    return list.join(", ");
  }
  if (preferred) return preferred;
  if (list.length) return list.join(", ");
  return null;
}

export const INSTRUCTOR_MARKER_WIDTH = 76;
export const INSTRUCTOR_MARKER_HEIGHT = 96;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function instructorInitials(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return parts[0]!.slice(0, 2).toUpperCase();
}

export function resolveInstructorMarkerPhoto(pin: Pick<InstructorMapPin, "photoUrl" | "image">): string | null {
  const photo = publicUploadAbsoluteDisplaySrc(pin.photoUrl);
  if (photo) return photo;
  return publicUploadAbsoluteDisplaySrc(pin.image);
}

function buildStarRatingLine(rating: number): string {
  const clamped = Math.max(0, Math.min(5, rating));
  const stars = Array.from({ length: 5 }, (_, index) => (clamped >= index + 1 - 0.25 ? "★" : "☆")).join("");
  return `${stars} ${clamped.toFixed(1)}`;
}

function buildStarRatingHtml(rating: number): string {
  const clamped = Math.max(0, Math.min(5, rating));
  const stars = Array.from({ length: 5 }, (_, index) => {
    const filled = clamped >= index + 1 - 0.25;
    return `<span class="instructor-map-marker__star${filled ? " instructor-map-marker__star--filled" : ""}" aria-hidden="true">★</span>`;
  }).join("");

  return `<span class="instructor-map-marker__stars">${stars}</span><span class="instructor-map-marker__rating-value">${clamped.toFixed(1)}</span>`;
}

function buildStarRatingInlineHtml(rating: number): string {
  const clamped = Math.max(0, Math.min(5, rating));
  const stars = Array.from({ length: 5 }, (_, index) => {
    const filled = clamped >= index + 1 - 0.25;
    const color = filled ? "#fbbf24" : "#cbd5e1";
    return `<span style="font-size:11px;line-height:1;color:${color};" aria-hidden="true">★</span>`;
  }).join("");

  return `<span style="display:inline-flex;gap:1px;align-items:center;">${stars}</span><span style="margin-left:3px;font-size:12px;font-weight:600;color:#334155;">${clamped.toFixed(1)}</span>`;
}

/** Компактная карточка для балуна/попапа (выбор — клик; анкета — ссылка / повторный клик). */
export function buildInstructorBalloonHtml(
  pin: Pick<
    InstructorMapPin,
    "id" | "name" | "ratingAvg" | "hourlyRate" | "distanceKm" | "photoUrl" | "image" | "specializations" | "sportLabel"
  >,
  mode: "class" | "inline" = "class",
): string {
  const displayName = pin.name?.trim() || "Инструктор";
  const photoUrl = resolveInstructorMarkerPhoto(pin);
  const sportLabel = resolveInstructorSportLabel(pin);
  const profileHref = `/instructors/${encodeURIComponent(pin.id)}`;
  const sportHtml = sportLabel
    ? mode === "inline"
      ? `<div style="margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.25;color:#64748b;">${escapeHtml(sportLabel)}</div>`
      : `<div class="instructor-map-balloon__sport">${escapeHtml(sportLabel)}</div>`
    : "";

  if (mode === "inline") {
    const avatar = photoUrl
      ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName)}" width="40" height="40" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />`
      : `<span style="font-size:13px;font-weight:700;color:#475569;">${escapeHtml(instructorInitials(pin.name))}</span>`;

    return `<div style="min-width:180px;max-width:240px;font-family:system-ui,-apple-system,sans-serif;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="display:flex;height:40px;width:40px;flex-shrink:0;align-items:center;justify-content:center;overflow:hidden;border-radius:9999px;background:#e2e8f0;">${avatar}</div>
        <div style="min-width:0;flex:1;">
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600;line-height:1.25;color:#0f172a;">${escapeHtml(displayName)}</div>
          <div style="display:flex;align-items:center;margin-top:2px;">${buildStarRatingInlineHtml(pin.ratingAvg)}</div>
          ${sportHtml}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
        <span style="font-weight:600;color:#0f172a;">${pin.hourlyRate}&nbsp;₽/ч</span>
        <span style="color:#cbd5e1;" aria-hidden="true">·</span>
        <span>${pin.distanceKm}&nbsp;км</span>
      </div>
      <a href="${escapeHtml(profileHref)}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#0f766e;text-decoration:underline;">Открыть анкету</a>
    </div>`;
  }

  const avatar = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName)}" width="40" height="40" class="instructor-map-balloon__photo" loading="lazy" />`
    : `<span class="instructor-map-balloon__initials">${escapeHtml(instructorInitials(pin.name))}</span>`;

  return `<div class="instructor-map-balloon">
    <div class="instructor-map-balloon__row">
      <div class="instructor-map-balloon__avatar">${avatar}</div>
      <div class="instructor-map-balloon__info">
        <div class="instructor-map-balloon__name">${escapeHtml(displayName)}</div>
        <div class="instructor-map-balloon__rating">${buildStarRatingHtml(pin.ratingAvg)}</div>
        ${sportHtml}
      </div>
    </div>
    <div class="instructor-map-balloon__meta">
      <span class="instructor-map-balloon__price">${pin.hourlyRate}&nbsp;₽/ч</span>
      <span class="instructor-map-balloon__sep" aria-hidden="true">·</span>
      <span class="instructor-map-balloon__distance">${pin.distanceKm}&nbsp;км</span>
    </div>
    <a class="instructor-map-balloon__profile-link" href="${escapeHtml(profileHref)}">Открыть анкету</a>
  </div>`;
}

export function buildInstructorMarkerHtml(
  pin: Pick<InstructorMapPin, "name" | "ratingAvg" | "photoUrl" | "image">,
  selected: boolean,
): string {
  const photoUrl = resolveInstructorMarkerPhoto(pin);
  const displayName = pin.name?.trim() || "Инструктор";
  const selectedClass = selected ? " instructor-map-marker--selected" : "";

  const photoInner = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName)}" width="48" height="48" class="instructor-map-marker__photo-img" loading="lazy" />`
    : `<span class="instructor-map-marker__photo-fallback">${escapeHtml(instructorInitials(pin.name))}</span>`;

  return `<div class="instructor-map-marker${selectedClass}">
    <div class="instructor-map-marker__name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</div>
    <div class="instructor-map-marker__rating">${buildStarRatingHtml(pin.ratingAvg)}</div>
    <div class="instructor-map-marker__photo">${photoInner}</div>
    <div class="instructor-map-marker__tail" aria-hidden="true"></div>
  </div>`;
}

export function buildInstructorYandexMarkerProperties(
  pin: Pick<InstructorMapPin, "name" | "ratingAvg" | "photoUrl" | "image">,
  selected: boolean,
): Record<string, string> {
  return {
    markerName: pin.name?.trim() || "Инструктор",
    markerStarsLine: buildStarRatingLine(pin.ratingAvg),
    markerPhotoUrl: resolveInstructorMarkerPhoto(pin) ?? "",
    markerInitials: instructorInitials(pin.name),
    markerBorderColor: selected ? "#0f766e" : "#ffffff",
  };
}

export function createInstructorLeafletIcon(
  pin: Pick<InstructorMapPin, "name" | "ratingAvg" | "photoUrl" | "image">,
  selected: boolean,
): L.DivIcon {
  return L.divIcon({
    className: "instructor-map-marker-icon",
    html: buildInstructorMarkerHtml(pin, selected),
    iconSize: [INSTRUCTOR_MARKER_WIDTH, INSTRUCTOR_MARKER_HEIGHT],
    iconAnchor: [INSTRUCTOR_MARKER_WIDTH / 2, INSTRUCTOR_MARKER_HEIGHT],
    popupAnchor: [0, -INSTRUCTOR_MARKER_HEIGHT + 8],
  });
}

type YmapsLayoutFactory = {
  createClass: (template: string, overrides?: Record<string, unknown>) => YmapsLayoutClass;
};

type YmapsLayoutClass = unknown;

const INSTRUCTOR_YANDEX_ANCHOR_LEFT = INSTRUCTOR_MARKER_WIDTH / 2;
const INSTRUCTOR_YANDEX_ANCHOR_TOP = INSTRUCTOR_MARKER_HEIGHT;

const INSTRUCTOR_YANDEX_LAYOUT_TEMPLATE = [
  '<div style="position:relative;width:0;height:0;">',
  `<div style="position:absolute;left:-${INSTRUCTOR_YANDEX_ANCHOR_LEFT}px;top:-${INSTRUCTOR_YANDEX_ANCHOR_TOP}px;display:flex;width:${INSTRUCTOR_MARKER_WIDTH}px;flex-direction:column;align-items:center;gap:2px;pointer-events:auto;user-select:none;">`,
  `<div style="max-width:${INSTRUCTOR_MARKER_WIDTH}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;line-height:1.2;color:#0f172a;text-align:center;text-shadow:0 0 3px #fff,0 0 3px #fff;">{{ properties.markerName }}</div>`,
  '<div style="font-size:9px;line-height:1;color:#334155;text-shadow:0 0 2px #fff;letter-spacing:-0.5px;">{{ properties.markerStarsLine }}</div>',
  '<div style="display:flex;height:48px;width:48px;align-items:center;justify-content:center;overflow:hidden;border-radius:9999px;border:2px solid {{ properties.markerBorderColor }};background:#e2e8f0;box-shadow:0 2px 8px rgba(15,23,42,.22);">',
  "{% if properties.markerPhotoUrl %}",
  '<img src="{{ properties.markerPhotoUrl }}" alt="{{ properties.markerName }}" width="48" height="48" style="width:100%;height:100%;object-fit:cover;" />',
  "{% else %}",
  '<span style="font-size:14px;font-weight:700;color:#475569;">{{ properties.markerInitials }}</span>',
  "{% endif %}",
  "</div>",
  '<div style="width:0;height:0;margin-top:-1px;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid {{ properties.markerBorderColor }};"></div>',
  "</div>",
  "</div>",
].join("");

let yandexLayoutClass: YmapsLayoutClass | null = null;
let yandexBalloonLayoutClass: YmapsLayoutClass | null = null;

type YmapsWithShape = {
  templateLayoutFactory: YmapsLayoutFactory;
  shape: { Rectangle: new (geometry: unknown) => unknown };
  geometry: { pixel: { Rectangle: new (coordinates: number[][]) => unknown } };
};

export function getInstructorYandexBalloonLayout(ymaps: YmapsWithShape): YmapsLayoutClass {
  if (yandexBalloonLayoutClass) return yandexBalloonLayoutClass;
  yandexBalloonLayoutClass = ymaps.templateLayoutFactory.createClass(
    '<div class="instructor-map-balloon">{{ properties.balloonContentBody|raw }}</div>',
  );
  return yandexBalloonLayoutClass;
}

export function getInstructorYandexLayout(ymaps: YmapsWithShape): YmapsLayoutClass {
  if (yandexLayoutClass) return yandexLayoutClass;
  const halfW = INSTRUCTOR_MARKER_WIDTH / 2;
  const height = INSTRUCTOR_MARKER_HEIGHT;
  yandexLayoutClass = ymaps.templateLayoutFactory.createClass(INSTRUCTOR_YANDEX_LAYOUT_TEMPLATE, {
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
  return yandexLayoutClass;
}

export function instructorYandexPlacemarkOptions(
  layout: YmapsLayoutClass,
  balloonLayout: YmapsLayoutClass,
  selected: boolean,
) {
  return {
    iconLayout: layout,
    balloonContentLayout: balloonLayout,
    iconShape: {
      type: "Rectangle",
      coordinates: [
        [-INSTRUCTOR_MARKER_WIDTH / 2, -INSTRUCTOR_MARKER_HEIGHT],
        [INSTRUCTOR_MARKER_WIDTH / 2, 0],
      ],
    },
    zIndex: selected ? 650 : 640,
    hideIconOnBalloonOpen: false,
    openBalloonOnClick: false,
    balloonPanelMaxMapArea: 0,
  };
}
