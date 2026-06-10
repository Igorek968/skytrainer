"use client";

import { useEffect, useRef, useState } from "react";

import { LocateMeControl } from "@/features/map/locate-me-control";
import {
  buildInstructorBalloonHtml,
  buildInstructorYandexMarkerProperties,
  getInstructorYandexBalloonLayout,
  getInstructorYandexLayout,
  instructorYandexPlacemarkOptions,
  type InstructorMapPin,
} from "@/features/map/instructor-map-marker";
import { MapLegalStrip } from "@/shared/legal/map-legal-strip";
import {
  loadYandexMaps,
  type YmapsCollection,
  type YmapsGeoObject,
  type YmapsMap,
  type YmapsNamespace,
} from "@/features/map/yandex-maps-api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";

export type BookingMapProps = {
  center: [number, number];
  meetLat: number;
  meetLng: number;
  instructors: InstructorMapPin[];
  radiusKm: number;
  onMeetChange: (lat: number, lng: number) => void;
  onLocateMe?: () => Promise<void>;
  onInstructorSelect?: (id: string) => void;
  /** Двойной клик — открыть анкету и поднять инструктора в списке. */
  onInstructorFocus?: (id: string) => void;
  selectedInstructorId?: string | null;
  className?: string;
  interactive: boolean;
};

function buildInstructorsSignature(list: InstructorMapPin[]): string {
  return list
    .map(
      (i) =>
        `${i.id}|${i.lat}|${i.lng}|${i.hourlyRate}|${i.ratingAvg}|${i.distanceKm}|${i.name}|${i.photoUrl ?? ""}|${i.image ?? ""}`,
    )
    .join("\n");
}

export function YandexBookingMap({
  meetLat,
  meetLng,
  instructors,
  radiusKm,
  onMeetChange,
  onLocateMe,
  onInstructorSelect,
  onInstructorFocus,
  selectedInstructorId,
  className,
  interactive,
}: BookingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ymapsRef = useRef<YmapsNamespace | null>(null);
  const mapRef = useRef<YmapsMap | null>(null);
  const radiusMRef = useRef(radiusKm * 1000);
  radiusMRef.current = radiusKm * 1000;
  const meetPlacemarkRef = useRef<YmapsGeoObject | null>(null);
  const circleRef = useRef<YmapsGeoObject | null>(null);
  const instructorsRef = useRef<YmapsCollection | null>(null);
  const placemarksByIdRef = useRef<Map<string, YmapsGeoObject>>(new Map());
  const suppressMapClickRef = useRef(false);
  const selectedInstructorIdRef = useRef(selectedInstructorId);
  const instructorsSignatureRef = useRef("");
  const onMeetChangeRef = useRef(onMeetChange);
  const onInstructorSelectRef = useRef(onInstructorSelect);
  const onInstructorFocusRef = useRef(onInstructorFocus);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  onMeetChangeRef.current = onMeetChange;
  onInstructorSelectRef.current = onInstructorSelect;
  onInstructorFocusRef.current = onInstructorFocus;
  selectedInstructorIdRef.current = selectedInstructorId;

  useEffect(() => {
    let cancelled = false;

    void loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;
        ymapsRef.current = ymaps;

        const setCircleCenter = (coords: number[]) => {
          circleRef.current?.geometry.setCoordinates([coords, radiusMRef.current]);
        };

        const map = new ymaps.Map(
          containerRef.current,
          {
            center: [meetLat, meetLng],
            zoom: 13,
            controls: ["zoomControl"],
          },
          { suppressMapOpenBlock: true },
        );
        mapRef.current = map;

        const meetPlacemark = new ymaps.Placemark(
          [meetLat, meetLng],
          { hintContent: "Место встречи", balloonContent: "Место встречи с инструктором" },
          {
            preset: "islands#greenDotIcon",
            draggable: interactive,
          },
        );
        meetPlacemarkRef.current = meetPlacemark;
        map.geoObjects.add(meetPlacemark);

        const circle = new ymaps.Circle(
          [[meetLat, meetLng], radiusMRef.current],
          {},
          {
            fillColor: "#38bdf822",
            strokeColor: "#38bdf8",
            strokeWidth: 2,
            strokeOpacity: 0.7,
          },
        );
        circleRef.current = circle;
        map.geoObjects.add(circle);

        const instructorLayer = new ymaps.GeoObjectCollection();
        instructorsRef.current = instructorLayer;
        map.geoObjects.add(instructorLayer);

        const pickAtCoords = (coords: number[]) => {
          meetPlacemark.geometry.setCoordinates(coords);
          setCircleCenter(coords);
          onMeetChangeRef.current(coords[0], coords[1]);
        };

        if (interactive) {
          map.events.add("click", (e) => {
            if (suppressMapClickRef.current) return;
            pickAtCoords(e.get("coords"));
          });

          meetPlacemark.events.add("dragend", () => {
            const coords = meetPlacemark.geometry.getCoordinates() as number[];
            pickAtCoords(coords);
          });
        }

        map.container?.fitToViewport();
        requestAnimationFrame(() => map.container?.fitToViewport());

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
      meetPlacemarkRef.current = null;
      circleRef.current = null;
      instructorsRef.current = null;
      placemarksByIdRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, [interactive, radiusKm]);

  useEffect(() => {
    if (!mapReady || !meetPlacemarkRef.current || !circleRef.current || !mapRef.current) return;
    const coords = [meetLat, meetLng];
    meetPlacemarkRef.current.geometry.setCoordinates(coords);
    circleRef.current.geometry.setCoordinates([coords, radiusMRef.current]);
    mapRef.current.setCenter(coords, mapRef.current.getZoom(), { duration: 300 });
  }, [meetLat, meetLng, mapReady]);

  useEffect(() => {
    const ymaps = ymapsRef.current;
    if (!mapReady || !instructorsRef.current || !ymaps) return;
    const layer = instructorsRef.current;
    const layout = getInstructorYandexLayout(ymaps);
    const balloonLayout = getInstructorYandexBalloonLayout(ymaps);
    const placemarksById = placemarksByIdRef.current;
    const nextIds = new Set(instructors.map((i) => i.id));
    const instructorsSignature = buildInstructorsSignature(instructors);
    const instructorsChanged = instructorsSignature !== instructorsSignatureRef.current;
    instructorsSignatureRef.current = instructorsSignature;

    for (const id of placemarksById.keys()) {
      if (!nextIds.has(id)) {
        const stale = placemarksById.get(id);
        if (stale) layer.remove(stale);
        placemarksById.delete(id);
      }
    }

    for (const i of instructors) {
      const selected = selectedInstructorIdRef.current === i.id;
      const markerProps = buildInstructorYandexMarkerProperties(i, selected);
      const properties = {
        hintContent: i.name ?? "Инструктор",
        balloonContentHeader: "",
        balloonContentBody: buildInstructorBalloonHtml(i, "class"),
        ...markerProps,
      };
      const options = instructorYandexPlacemarkOptions(layout, balloonLayout, selected);

      const existing = placemarksById.get(i.id);
      if (existing) {
        existing.geometry.setCoordinates([i.lat, i.lng]);
        if (instructorsChanged) {
          existing.properties.set(properties);
        }
        continue;
      }

      const placemark = new ymaps.Placemark([i.lat, i.lng], properties, options);

      placemark.events.add("click", () => {
        suppressMapClickRef.current = true;
        queueMicrotask(() => {
          suppressMapClickRef.current = false;
        });

        onInstructorSelectRef.current?.(i.id);
        placemark.balloon.open();
      });
      placemark.events.add("dblclick", () => {
        suppressMapClickRef.current = true;
        queueMicrotask(() => {
          suppressMapClickRef.current = false;
        });

        onInstructorFocusRef.current?.(i.id);
        placemark.balloon.open();
      });

      placemarksById.set(i.id, placemark);
      layer.add(placemark);
    }
  }, [instructors, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    const placemarksById = placemarksByIdRef.current;

    for (const [id, placemark] of placemarksById) {
      const selected = selectedInstructorId === id;
      placemark.properties.set({
        markerBorderColor: selected ? "#0f766e" : "#ffffff",
      });
      placemark.options.set("zIndex", selected ? 650 : 640);
    }
  }, [selectedInstructorId, mapReady]);

  if (mapError) {
    return (
      <div
        className={cn(
          "flex h-[320px] items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground md:h-[420px]",
          className,
        )}
      >
        Не удалось загрузить Яндекс.Карты. Проверьте ключ API в настройках сервера.
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-hidden rounded-lg border border-border", className)}>
      <div className="relative z-0 h-[320px] w-full md:h-[420px]">
        {!mapReady ? <Skeleton className="absolute inset-0 z-0 h-full w-full" /> : null}
        {interactive && onLocateMe ? <LocateMeControl onLocate={onLocateMe} /> : null}
        <div
          ref={containerRef}
          className="h-full w-full"
          aria-label="Яндекс.Карта — место встречи и инструкторы"
        />
      </div>
      <MapLegalStrip />
    </div>
  );
}
