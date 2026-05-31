import L from "leaflet";

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
};

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
  const photo = pin.photoUrl?.trim();
  if (photo) return photo;
  const image = pin.image?.trim();
  return image || null;
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

export function buildInstructorMarkerHtml(
  pin: Pick<InstructorMapPin, "name" | "ratingAvg" | "photoUrl" | "image">,
  selected: boolean,
): string {
  const photoUrl = resolveInstructorMarkerPhoto(pin);
  const displayName = pin.name?.trim() || "Инструктор";
  const selectedClass = selected ? " instructor-map-marker--selected" : "";

  const photoInner = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" alt="" class="instructor-map-marker__photo-img" loading="lazy" />`
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

const INSTRUCTOR_YANDEX_LAYOUT_TEMPLATE = [
  '<div class="instructor-map-marker" style="display:flex;width:76px;flex-direction:column;align-items:center;gap:2px;pointer-events:auto;user-select:none;">',
  '<div style="max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;line-height:1.2;color:#0f172a;text-align:center;text-shadow:0 0 3px #fff,0 0 3px #fff;">{{ properties.markerName }}</div>',
  '<div style="font-size:9px;line-height:1;color:#334155;text-shadow:0 0 2px #fff;letter-spacing:-0.5px;">{{ properties.markerStarsLine }}</div>',
  '<div style="display:flex;height:48px;width:48px;align-items:center;justify-content:center;overflow:hidden;border-radius:9999px;border:2px solid {{ properties.markerBorderColor }};background:#e2e8f0;box-shadow:0 2px 8px rgba(15,23,42,.22);">',
  "{% if properties.markerPhotoUrl %}",
  '<img src="{{ properties.markerPhotoUrl }}" alt="" style="width:100%;height:100%;object-fit:cover;" />',
  "{% else %}",
  '<span style="font-size:14px;font-weight:700;color:#475569;">{{ properties.markerInitials }}</span>',
  "{% endif %}",
  "</div>",
  '<div style="width:0;height:0;margin-top:-1px;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid {{ properties.markerBorderColor }};"></div>',
  "</div>",
].join("");

let yandexLayoutClass: YmapsLayoutClass | null = null;

export function getInstructorYandexLayout(ymaps: { templateLayoutFactory: YmapsLayoutFactory }): YmapsLayoutClass {
  if (yandexLayoutClass) return yandexLayoutClass;
  yandexLayoutClass = ymaps.templateLayoutFactory.createClass(INSTRUCTOR_YANDEX_LAYOUT_TEMPLATE);
  return yandexLayoutClass;
}

export function instructorYandexPlacemarkOptions(layout: YmapsLayoutClass, selected: boolean) {
  return {
    iconLayout: layout,
    iconShape: {
      type: "Rectangle",
      coordinates: [
        [-INSTRUCTOR_MARKER_WIDTH / 2, -INSTRUCTOR_MARKER_HEIGHT],
        [INSTRUCTOR_MARKER_WIDTH / 2, 0],
      ],
    },
    zIndex: selected ? 650 : 640,
    hideIconOnBalloonOpen: false,
  };
}
