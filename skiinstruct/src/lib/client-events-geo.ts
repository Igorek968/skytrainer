import { DEFAULT_SKI_RESORT_CENTER, haversineKm } from "@/lib/services/geo";

/** Радиус ленты событий на главной клиента (км). */
export const CLIENT_EVENTS_RADIUS_KM = 60;

export function resolveClientEventsOrigin(lat?: number | null, lng?: number | null): {
  lat: number;
  lng: number;
} {
  if (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return { lat, lng };
  }
  return { ...DEFAULT_SKI_RESORT_CENTER };
}

export function instructorEventDistanceKm(
  clientLat: number,
  clientLng: number,
  instructorLat: number | null | undefined,
  instructorLng: number | null | undefined,
  venueLat?: number | null,
  venueLng?: number | null,
): number {
  const eventLat =
    venueLat != null && Number.isFinite(venueLat) ? venueLat : null;
  const eventLng =
    venueLng != null && Number.isFinite(venueLng) ? venueLng : null;
  const pinLat =
    eventLat ??
    (instructorLat != null && Number.isFinite(instructorLat)
      ? instructorLat
      : DEFAULT_SKI_RESORT_CENTER.lat);
  const pinLng =
    eventLng ??
    (instructorLng != null && Number.isFinite(instructorLng)
      ? instructorLng
      : DEFAULT_SKI_RESORT_CENTER.lng);
  return haversineKm(clientLat, clientLng, pinLat, pinLng);
}

export function filterAndSortEventsByDistance<
  T extends { distanceKm: number },
>(items: T[], options: { unlimited: boolean; radiusKm: number }): T[] {
  const sorted = [...items].sort((a, b) => a.distanceKm - b.distanceKm);
  if (options.unlimited) return sorted;
  return sorted.filter((e) => e.distanceKm <= options.radiusKm);
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} м`;
  if (km < 10) return `${km.toFixed(1)} км`;
  return `${Math.round(km)} км`;
}
