/** Клиентские вызовы геокодера (Яндекс при наличии ключа, иначе API). */

import {
  enrichMeetAddressFields,
  type MeetAddressFields,
} from "@/features/map/meet-address-parts";
import { hasYandexMapsKey } from "@/features/map/yandex-maps-api";
import { yandexGeocodeReverseParts, yandexGeocodeSearch } from "@/features/map/yandex-geocode-client";

export type GeocodeSearchResult = { lat: number; lng: number; displayName: string };

export type GeocodeReverseParts = MeetAddressFields & { displayName: string };

export async function geocodeSearchQuery(query: string): Promise<GeocodeSearchResult | { error: string }> {
  const q = query.trim();
  if (q.length < 3) {
    return { error: "Введите адрес (не менее 3 символов)" };
  }

  if (hasYandexMapsKey()) {
    try {
      const hit = await yandexGeocodeSearch(q);
      if (hit) return hit;
      return { error: "Адрес не найден. Уточните запрос." };
    } catch {
      return { error: "Яндекс.Геокодер недоступен. Проверьте ключ API." };
    }
  }

  try {
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const payload = (await r.json()) as {
      error?: string;
      lat?: number;
      lng?: number;
      displayName?: string;
    };
    if (!r.ok) {
      return { error: typeof payload.error === "string" ? payload.error : "Не удалось найти адрес" };
    }
    if (payload.lat == null || payload.lng == null) {
      return { error: "Не удалось определить координаты" };
    }
    const displayName = payload.displayName?.trim() || q;
    return { lat: payload.lat, lng: payload.lng, displayName };
  } catch {
    return { error: "Сеть недоступна" };
  }
}

export async function geocodeReverseParts(
  lat: number,
  lng: number,
): Promise<GeocodeReverseParts | { error: string }> {
  if (hasYandexMapsKey()) {
    try {
      const hit = await yandexGeocodeReverseParts(lat, lng);
      if (hit?.displayName?.trim()) return hit;
    } catch {
      /* fallback to HTTP API below */
    }
  }

  try {
    const r = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, { cache: "no-store" });
    const payload = (await r.json()) as GeocodeReverseParts & { error?: string };
    if (!r.ok) {
      return { error: typeof payload.error === "string" ? payload.error : "Не удалось определить адрес" };
    }
    const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
    if (!displayName) return { error: "Пустой ответ геокодера" };

    const fields = enrichMeetAddressFields(
      {
        city: payload.city?.trim() ?? "",
        street: payload.street?.trim() ?? "",
        house: payload.house?.trim() ?? "",
      },
      displayName,
    );

    return { ...fields, displayName };
  } catch {
    return { error: "Сеть недоступна" };
  }
}
