"use client";

import { useEffect, useRef, useState } from "react";

import {
  loadYandexMaps,
  type YmapsGeoObject,
  type YmapsMap,
} from "@/features/map/yandex-maps-api";
import { MapLegalStrip } from "@/shared/legal/map-legal-strip";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";

export function YandexEventVenueMap({
  lat,
  lng,
  interactive = true,
  className,
  markerLabel = "Место мероприятия",
  onPositionChange,
}: {
  lat: number;
  lng: number;
  interactive?: boolean;
  className?: string;
  markerLabel?: string;
  onPositionChange?: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YmapsMap | null>(null);
  const placemarkRef = useRef<YmapsGeoObject | null>(null);
  const onPositionChangeRef = useRef(onPositionChange);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  onPositionChangeRef.current = onPositionChange;

  useEffect(() => {
    let cancelled = false;

    void loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;

        const map = new ymaps.Map(
          containerRef.current,
          {
            center: [lat, lng],
            zoom: 14,
            type: "yandex#map",
            controls: ["zoomControl"],
          },
          { suppressMapOpenBlock: true },
        );
        mapRef.current = map;

        const placemark = new ymaps.Placemark(
          [lat, lng],
          { hintContent: markerLabel, balloonContent: markerLabel },
          {
            preset: "islands#redDotIcon",
            draggable: interactive && Boolean(onPositionChangeRef.current),
          },
        );
        placemarkRef.current = placemark;
        map.geoObjects.add(placemark);

        if (interactive && onPositionChangeRef.current) {
          map.events.add("click", (e) => {
            const coords = e.get("coords");
            placemark.geometry.setCoordinates(coords);
            onPositionChangeRef.current?.(coords[0], coords[1]);
          });

          placemark.events.add("dragend", () => {
            const coords = placemark.geometry.getCoordinates() as number[];
            onPositionChangeRef.current?.(coords[0], coords[1]);
          });
        }

        map.container?.fitToViewport();
        setMapReady(true);
      })
      .catch((err: unknown) => {
        const code = err instanceof Error ? err.message : "YANDEX_MAP_FAIL";
        setMapError(code);
      });

    return () => {
      cancelled = true;
      setMapReady(false);
      mapRef.current?.destroy();
      mapRef.current = null;
      placemarkRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, [interactive]);

  useEffect(() => {
    if (!mapReady || !placemarkRef.current || !mapRef.current) return;
    const coords = [lat, lng];
    placemarkRef.current.geometry.setCoordinates(coords);
    mapRef.current.setCenter(coords, mapRef.current.getZoom(), { duration: 300 });
  }, [lat, lng, mapReady]);

  if (mapError) {
    return (
      <div
        className={cn(
          "flex h-[200px] items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground sm:h-[220px]",
          className,
        )}
      >
        Не удалось загрузить Яндекс.Карты.
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-hidden rounded-lg border border-border", className)}>
      <div className="relative z-0 h-[200px] w-full sm:h-[220px]">
        {!mapReady ? <Skeleton className="absolute inset-0 z-0 h-full w-full" /> : null}
        <div
          ref={containerRef}
          className="h-full w-full"
          aria-label="Яндекс.Карта — место мероприятия"
        />
      </div>
      <MapLegalStrip />
    </div>
  );
}
