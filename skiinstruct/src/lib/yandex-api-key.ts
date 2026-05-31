/** Общий ключ Яндекс.Карт / HTTP-геокодера (сервер и клиент). */

export function resolveYandexMapsApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim() ||
    process.env.YANDEX_GEOCODER_API_KEY?.trim() ||
    process.env.VITE_YANDEX_MAPS_API_KEY?.trim() ||
    ""
  );
}
