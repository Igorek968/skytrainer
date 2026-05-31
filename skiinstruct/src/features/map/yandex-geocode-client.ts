"use client";

import {
  enrichMeetAddressFields,
  type MeetAddressFields,
} from "@/features/map/meet-address-parts";
import { loadYandexMaps, type YmapsGeocodeObject } from "@/features/map/yandex-maps-api";

export type YandexReverseParts = MeetAddressFields & { displayName: string };

type GeocoderMetaData = {
  text?: string;
  Address?: {
    formatted?: string;
    Components?: Array<{ kind: string; name: string }>;
  };
};

function readGeocoderMeta(obj: YmapsGeocodeObject): GeocoderMetaData | undefined {
  const meta = obj.properties.get("metaDataProperty") as
    | { GeocoderMetaData?: GeocoderMetaData }
    | undefined;
  return meta?.GeocoderMetaData;
}

function readYandexAddressComponents(obj: YmapsGeocodeObject): Array<{ kind: string; name: string }> {
  return readGeocoderMeta(obj)?.Address?.Components ?? [];
}

function hasUsefulAddressParts(parts: MeetAddressFields): boolean {
  return parts.street.trim().length > 0 || parts.house.trim().length > 0;
}

export function parseYandexAddressParts(obj: YmapsGeocodeObject): MeetAddressFields {
  const components = readYandexAddressComponents(obj);
  let city = "";
  let street = "";
  let house = "";

  for (const c of components) {
    const name = c.name?.trim();
    if (!name) continue;
    if (c.kind === "street" || c.kind === "thoroughfare") {
      if (!street) street = name;
    } else if (c.kind === "house") {
      house = name;
    } else if (c.kind === "locality") {
      city = name;
    }
  }

  if (!city) {
    for (const c of components) {
      const name = c.name?.trim();
      if (!name) continue;
      if (c.kind === "area" || c.kind === "district") {
        city = name;
        break;
      }
    }
  }

  const line = formatYandexGeoObjectAddress(obj);
  return enrichMeetAddressFields({ city, street, house }, line);
}

export function formatYandexGeoObjectAddress(obj: YmapsGeocodeObject): string {
  const geo = readGeocoderMeta(obj);
  const text = geo?.text?.trim();
  if (text) return text;

  const formatted = geo?.Address?.formatted?.trim();
  if (formatted) return formatted;

  const line = obj.getAddressLine?.();
  if (typeof line === "string" && line.trim()) return line.trim();

  const name = obj.properties.get("name");
  if (typeof name === "string" && name.trim()) return name.trim();

  const desc = obj.properties.get("description");
  if (typeof desc === "string" && desc.trim()) return desc.trim();

  const textProp = obj.properties.get("text");
  if (typeof textProp === "string" && textProp.trim()) return textProp.trim();

  const [lat, lng] = obj.geometry.getCoordinates();
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function yandexGeoObjectToParts(obj: YmapsGeocodeObject): YandexReverseParts {
  const parts = parseYandexAddressParts(obj);
  return { ...parts, displayName: formatYandexGeoObjectAddress(obj) };
}

export async function yandexGeocodeSearch(
  query: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const ymaps = await loadYandexMaps();
  const result = await ymaps.geocode(q, { results: 1 });
  const first = result.geoObjects.get(0);
  if (!first) return null;

  const [lat, lng] = first.geometry.getCoordinates();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng, displayName: formatYandexGeoObjectAddress(first) };
}

const REVERSE_KINDS = ["house", "street", "district", "locality"] as const;

export async function yandexGeocodeReverseParts(lat: number, lng: number): Promise<YandexReverseParts | null> {
  const ymaps = await loadYandexMaps();
  let best: YandexReverseParts | null = null;

  for (const kind of REVERSE_KINDS) {
    const result = await ymaps.geocode([lat, lng], { results: 1, kind });
    const first = result.geoObjects.get(0);
    if (!first) continue;
    const parts = yandexGeoObjectToParts(first);
    if (hasUsefulAddressParts(parts)) return parts;
    if (!best) best = parts;
  }

  const fallback = await ymaps.geocode([lat, lng], { results: 1 });
  const first = fallback.geoObjects.get(0);
  if (!first) return best;
  const parts = yandexGeoObjectToParts(first);
  if (hasUsefulAddressParts(parts)) return parts;
  return best ?? parts;
}

export async function yandexGeocodeReverse(lat: number, lng: number): Promise<string | null> {
  const hit = await yandexGeocodeReverseParts(lat, lng);
  return hit?.displayName ?? null;
}
