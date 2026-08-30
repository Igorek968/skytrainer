"use client";

import { EventVenueMapLazy } from "@/features/map/map-loader";
import { Button } from "@/shared/ui/button";

function yandexMapsUrl(address: string, lat?: number | null, lng?: number | null): string {
  const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  if (hasCoords) {
    // pt = lng,lat — точка на карте; ll — центр
    return `https://yandex.ru/maps/?ll=${lng}%2C${lat}&pt=${lng}%2C${lat}&z=16&l=map`;
  }
  return `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`;
}

export function EventVenueDisplay({
  address,
  lat,
  lng,
  compact,
}: {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  compact?: boolean;
}) {
  const text = address?.trim();
  if (!text) return null;

  const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const mapsUrl = yandexMapsUrl(text, lat, lng);

  return (
    <div className={compact ? "mt-2 space-y-1.5" : "mt-3 space-y-2"}>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Место проведения: </span>
        <span className="text-foreground">{text}</span>
      </p>
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" asChild>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
          Открыть в Яндекс.Картах
        </a>
      </Button>
      {hasCoords ? (
        <EventVenueMapLazy lat={lat} lng={lng} interactive={false} markerLabel={text} />
      ) : null}
    </div>
  );
}
