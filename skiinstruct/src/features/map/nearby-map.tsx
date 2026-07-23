"use client";

import type { LatLngExpression } from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";

import { LocateMeControl } from "@/features/map/locate-me-control";
import { MapLegalStrip } from "@/shared/legal/map-legal-strip";
import {
  buildInstructorBalloonHtml,
  createInstructorLeafletIcon,
  type InstructorMapPin,
} from "@/features/map/instructor-map-marker";
import {
  buildEventBalloonHtml,
  createEventLeafletIconHtml,
  eventLeafletIconAnchor,
  eventLeafletIconSize,
  resolveEventMarkerDetail,
  type EventMapPin,
  type EventMarkerDetail,
} from "@/features/map/event-map-marker";
import { hasYandexMapsKey } from "@/features/map/yandex-maps-api";
import { YandexBookingMap } from "@/features/map/yandex-booking-map";
import { cn } from "@/lib/utils";

type InstructorPin = InstructorMapPin;

export type NearbyMapProps = {
  center: LatLngExpression;
  meetLat: number;
  meetLng: number;
  instructors: InstructorPin[];
  /** Опубликованные мероприятия с указанным местом (venue). */
  events?: EventMapPin[];
  radiusKm: number;
  onMeetChange: (lat: number, lng: number) => void;
  onLocateMe?: () => Promise<void>;
  onInstructorSelect?: (id: string) => void;
  onInstructorFocus?: (id: string) => void;
  /** Одиночный клик по метке мероприятия. */
  onEventSelect?: (id: string) => void;
  /** Двойной клик — открыть экран просмотра (как фото в ленте). */
  onEventOpen?: (feedCardId: string) => void;
  selectedInstructorId?: string | null;
  className?: string;
  interactive: boolean;
};

/** Карта: Яндекс.Карты (схема как на yandex.ru/maps) при ключе, иначе OSM/CARTO. */
export function NearbyMap(props: NearbyMapProps) {
  if (hasYandexMapsKey()) {
    const center: [number, number] = Array.isArray(props.center)
      ? [props.center[0], props.center[1]]
      : [props.meetLat, props.meetLng];
    return <YandexBookingMap {...props} center={center} />;
  }
  return <LeafletNearbyMap {...props} />;
}

function pinIcon(fill: string) {
  return L.divIcon({
    className: "map-pin-icon",
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="26" height="39" aria-hidden="true">
      <path fill="${fill}" stroke="#fff" stroke-width="1.5" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>
      <circle cx="12" cy="12" r="4" fill="#fff"/>
    </svg>`,
    iconSize: [26, 39],
    iconAnchor: [13, 39],
    popupAnchor: [0, -34],
  });
}

const MeetIcon = pinIcon("#2563eb");

function createEventLeafletIcon(pin: EventMapPin, detail: EventMarkerDetail) {
  return L.divIcon({
    className: "map-event-pin-icon",
    html: createEventLeafletIconHtml(pin, detail),
    iconSize: eventLeafletIconSize(detail),
    iconAnchor: eventLeafletIconAnchor(detail),
    popupAnchor: [0, -eventLeafletIconAnchor(detail)[1] + 8],
  });
}

function MapViewSync({ lat, lng, zoom = 13 }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.75 });
  }, [map, lat, lng, zoom]);

  return null;
}

function MeetMarker({
  position,
  draggable,
  onDragEnd,
}: {
  position: LatLngExpression;
  draggable: boolean;
  onDragEnd?: (lat: number, lng: number) => void;
}) {
  return (
    <Marker
      position={position}
      draggable={draggable}
      icon={MeetIcon}
      eventHandlers={{
        dragend: (e) => {
          const m = e.target as L.Marker;
          const ll = m.getLatLng();
          onDragEnd?.(ll.lat, ll.lng);
        },
      }}
    >
      <Popup>Место встречи</Popup>
    </Marker>
  );
}

function MapClick({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function EventZoomDetail({ onDetail }: { onDetail: (d: EventMarkerDetail) => void }) {
  const map = useMap();
  useMapEvents({
    zoomend() {
      onDetail(resolveEventMarkerDetail(map.getZoom()));
    },
    zoom() {
      onDetail(resolveEventMarkerDetail(map.getZoom()));
    },
  });
  useEffect(() => {
    onDetail(resolveEventMarkerDetail(map.getZoom()));
  }, [map, onDetail]);
  return null;
}

function LeafletNearbyMap({
  center,
  meetLat,
  meetLng,
  instructors,
  events = [],
  radiusKm,
  onMeetChange,
  onLocateMe,
  onInstructorSelect,
  onInstructorFocus,
  onEventSelect,
  onEventOpen,
  selectedInstructorId,
  className,
  interactive,
}: NearbyMapProps) {
  const [eventDetail, setEventDetail] = useState<EventMarkerDetail>("mid");

  return (
    <div className={cn("w-full overflow-hidden rounded-lg border border-border", className)}>
      <div className="relative z-0 h-[320px] w-full md:h-[420px]">
        {interactive && onLocateMe ? <LocateMeControl onLocate={onLocateMe} /> : null}
        <MapContainer
          center={center}
          zoom={13}
          className="h-full w-full"
          scrollWheelZoom
          aria-label="Карта курорта, инструкторов и мероприятий"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
          <MapViewSync lat={meetLat} lng={meetLng} />
          <EventZoomDetail onDetail={setEventDetail} />
          <Circle
            center={[meetLat, meetLng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: "#38bdf8", fillOpacity: 0.08 }}
          />
          {interactive ? <MapClick onClick={onMeetChange} /> : null}
          <MeetMarker
            position={[meetLat, meetLng]}
            draggable={interactive}
            onDragEnd={onMeetChange}
          />
          {instructors.map((i) => {
            const selected = selectedInstructorId === i.id;
            return (
              <Marker
                key={i.id}
                position={[i.lat, i.lng]}
                icon={createInstructorLeafletIcon(i, selected)}
                zIndexOffset={selected ? 1000 : 0}
                eventHandlers={{
                  click: (e) => {
                    if (e.originalEvent) {
                      L.DomEvent.stopPropagation(e.originalEvent);
                    }
                    const marker = e.target as L.Marker & {
                      __lastClickAt?: number;
                      __balloonTimer?: number;
                    };
                    const now = Date.now();
                    const last = marker.__lastClickAt ?? 0;
                    const alreadySelected = selectedInstructorId === i.id;
                    // 1) быстрый double-click  2) повторный клик по уже выбранному — в анкету
                    if (now - last <= 700 || alreadySelected) {
                      if (marker.__balloonTimer) window.clearTimeout(marker.__balloonTimer);
                      marker.__lastClickAt = 0;
                      marker.__balloonTimer = undefined;
                      onInstructorFocus?.(i.id);
                      marker.closePopup();
                      return;
                    }
                    if (marker.__balloonTimer) window.clearTimeout(marker.__balloonTimer);
                    marker.__lastClickAt = now;
                    onInstructorSelect?.(i.id);
                    marker.__balloonTimer = window.setTimeout(() => {
                      if (marker.__lastClickAt !== now) return;
                      marker.openPopup();
                    }, 320);
                  },
                  dblclick: (e) => {
                    if (e.originalEvent) {
                      L.DomEvent.stopPropagation(e.originalEvent);
                      L.DomEvent.preventDefault(e.originalEvent);
                    }
                    const marker = e.target as L.Marker & {
                      __lastClickAt?: number;
                      __balloonTimer?: number;
                    };
                    if (marker.__balloonTimer) window.clearTimeout(marker.__balloonTimer);
                    marker.__lastClickAt = 0;
                    onInstructorFocus?.(i.id);
                    marker.closePopup();
                  },
                }}
              >
                <Popup closeOnClick={false} autoPan={false}>
                  <div
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: buildInstructorBalloonHtml(i, "class") }}
                  />
                </Popup>
              </Marker>
            );
          })}
          {events.map((ev) => (
            <Marker
              key={`event-${ev.id}`}
              position={[ev.lat, ev.lng]}
              icon={createEventLeafletIcon(ev, eventDetail)}
              zIndexOffset={800}
              eventHandlers={{
                click: (e) => {
                  if (e.originalEvent) {
                    L.DomEvent.stopPropagation(e.originalEvent);
                  }
                  const marker = e.target as L.Marker;
                  onEventSelect?.(ev.id);
                  marker.openPopup();
                },
                dblclick: (e) => {
                  if (e.originalEvent) {
                    L.DomEvent.stopPropagation(e.originalEvent);
                    L.DomEvent.preventDefault(e.originalEvent);
                  }
                  onEventOpen?.(ev.feedCardId);
                },
              }}
            >
              <Popup closeOnClick={false} autoPan={false}>
                <div
                  className="text-sm"
                  dangerouslySetInnerHTML={{ __html: buildEventBalloonHtml(ev) }}
                />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <MapLegalStrip />
    </div>
  );
}
