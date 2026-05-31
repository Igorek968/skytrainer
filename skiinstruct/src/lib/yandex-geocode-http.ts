/** HTTP Геокодер Яндекса (серверные маршруты /api/geocode). */

import { resolveYandexMapsApiKey } from "@/lib/yandex-api-key";

function yandexApiKey(): string | null {
  const key = resolveYandexMapsApiKey();
  return key || null;
}

type YandexGeocodeResponse = {
  response?: {
    GeoObjectCollection?: {
      featureMember?: Array<{
        GeoObject?: {
          Point?: { pos?: string };
          metaDataProperty?: {
            GeocoderMetaData?: { text?: string; Address?: { formatted?: string } };
          };
        };
      }>;
    };
  };
};

type YandexFeatureMember = NonNullable<
  NonNullable<NonNullable<YandexGeocodeResponse["response"]>["GeoObjectCollection"]>["featureMember"]
>[number];

function parseYandexHit(
  hit: YandexFeatureMember | undefined,
  fallbackQuery: string,
): { lat: number; lng: number; displayName: string } | null {
  if (!hit) return null;
  const pos = hit.GeoObject?.Point?.pos?.trim();
  if (!pos) return null;
  const [lngStr, latStr] = pos.split(/\s+/);
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const meta = hit.GeoObject?.metaDataProperty?.GeocoderMetaData;
  const displayName =
    meta?.text?.trim() ||
    meta?.Address?.formatted?.trim() ||
    fallbackQuery;

  return { lat, lng, displayName };
}

export async function yandexHttpGeocodeSearch(
  query: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const key = yandexApiKey();
  if (!key) return null;

  const q = query.trim();
  if (q.length < 2) return null;

  const url = new URL("https://geocode-maps.yandex.ru/1.x/");
  url.searchParams.set("apikey", key);
  url.searchParams.set("format", "json");
  url.searchParams.set("geocode", q);
  url.searchParams.set("results", "1");
  url.searchParams.set("lang", "ru_RU");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const data = (await res.json()) as YandexGeocodeResponse;
  const member = data.response?.GeoObjectCollection?.featureMember?.[0];
  return parseYandexHit(member, q);
}
