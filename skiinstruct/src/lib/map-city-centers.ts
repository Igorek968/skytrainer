import { haversineKm } from "@/lib/services/geo";

export type MapCityCenter = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
};

/**
 * Центры городов для стартовой позиции карт.
 * Координаты — условный центр города/курорта (не точка GPS пользователя).
 */
export const MAP_CITY_CENTERS: MapCityCenter[] = [
  { slug: "sochi", name: "Сочи", lat: 43.5855, lng: 39.7231 },
  { slug: "krasnaya-polyana", name: "Красная Поляна", lat: 43.659, lng: 40.314 },
  { slug: "moskva", name: "Москва", lat: 55.7558, lng: 37.6173 },
  { slug: "sankt-peterburg", name: "Санкт-Петербург", lat: 59.9311, lng: 30.3609 },
  { slug: "kazan", name: "Казань", lat: 55.7961, lng: 49.1064 },
  { slug: "ekaterinburg", name: "Екатеринбург", lat: 56.8389, lng: 60.6057 },
  { slug: "novosibirsk", name: "Новосибирск", lat: 55.0084, lng: 82.9357 },
  { slug: "krasnodar", name: "Краснодар", lat: 45.0355, lng: 38.9753 },
  { slug: "kaliningrad", name: "Калининград", lat: 54.7104, lng: 20.4522 },
  { slug: "dombay", name: "Домбай", lat: 43.2906, lng: 41.6261 },
];

/** Fallback, если город не удалось определить. */
export const FALLBACK_MAP_CITY = MAP_CITY_CENTERS[0]!;

const MAX_SNAP_DISTANCE_KM = 250;

export function getMapCityBySlug(slug: string): MapCityCenter | undefined {
  return MAP_CITY_CENTERS.find((c) => c.slug === slug);
}

/** Ближайший город из каталога к координатам. */
export function nearestMapCityCenter(
  lat: number,
  lng: number,
): MapCityCenter & { distanceKm: number } {
  let best = MAP_CITY_CENTERS[0]!;
  let bestKm = haversineKm(lat, lng, best.lat, best.lng);
  for (let i = 1; i < MAP_CITY_CENTERS.length; i++) {
    const c = MAP_CITY_CENTERS[i]!;
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km < bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return { ...best, distanceKm: bestKm };
}

/**
 * Центр города для карт: ближайший город, если он в разумном радиусе;
 * иначе оставляем точные координаты (удалённый регион вне каталога).
 */
export function resolveMapViewCenter(
  lat: number,
  lng: number,
): { lat: number; lng: number; city: MapCityCenter | null; snapped: boolean } {
  const nearest = nearestMapCityCenter(lat, lng);
  if (nearest.distanceKm <= MAX_SNAP_DISTANCE_KM) {
    return {
      lat: nearest.lat,
      lng: nearest.lng,
      city: nearest,
      snapped: true,
    };
  }
  return { lat, lng, city: null, snapped: false };
}

/** Радиус (км): точка относится к городу, если ближайший центр ближе этого. */
export const CITY_MATCH_MAX_KM = 80;

/** Определяет slug города по координатам / явному slug / адресу. */
export function resolveCitySlugForPlace(input: {
  citySlug?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}): string | null {
  if (input.citySlug && getMapCityBySlug(input.citySlug)) return input.citySlug;
  if (
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  ) {
    const nearest = nearestMapCityCenter(input.lat, input.lng);
    if (nearest.distanceKm <= CITY_MATCH_MAX_KM) return nearest.slug;
  }
  const addr = input.address?.toLowerCase() ?? "";
  if (addr) {
    for (const c of MAP_CITY_CENTERS) {
      if (addr.includes(c.name.toLowerCase())) return c.slug;
    }
  }
  return null;
}
