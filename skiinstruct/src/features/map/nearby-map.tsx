"use client";

import type { LatLngExpression } from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

type InstructorPin = {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  hourlyRate: number;
  ratingAvg: number;
  distanceKm: number;
};

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
const InstructorIcon = pinIcon("#0f766e");

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

export function NearbyMap({
  center,
  meetLat,
  meetLng,
  instructors,
  radiusKm,
  onMeetChange,
  onInstructorSelect,
  selectedInstructorId,
  className,
  interactive,
}: {
  center: LatLngExpression;
  meetLat: number;
  meetLng: number;
  instructors: InstructorPin[];
  radiusKm: number;
  onMeetChange: (lat: number, lng: number) => void;
  /** Выбор инструктора по клику на маркер (иначе кнопка заказа остаётся неактивной). */
  onInstructorSelect?: (id: string) => void;
  selectedInstructorId?: string | null;
  className?: string;
  interactive: boolean;
}) {
  return (
    <div className={cn("relative z-0 h-[320px] w-full overflow-hidden rounded-lg md:h-[420px]", className)}>
      <MapContainer
        center={center}
        zoom={13}
        className="h-full w-full"
        scrollWheelZoom
        aria-label="Карта курорта и инструкторов"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewSync lat={meetLat} lng={meetLng} />
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
        {instructors.map((i) => (
          <Marker
            key={i.id}
            position={[i.lat, i.lng]}
            icon={InstructorIcon}
            eventHandlers={{
              click: (e) => {
                if (e.originalEvent) {
                  L.DomEvent.stopPropagation(e.originalEvent);
                }
                onInstructorSelect?.(i.id);
              },
            }}
          >
            <Popup>
              <div className="text-sm space-y-2">
                <div className="font-medium">{i.name}</div>
                <div>{i.hourlyRate} ₽/ч</div>
                <div>
                  Рейтинг: {i.ratingAvg.toFixed(1)} · {i.distanceKm} км
                </div>
                {onInstructorSelect ? (
                  <button
                    type="button"
                    className="w-full rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90"
                    onClick={() => onInstructorSelect(i.id)}
                  >
                    {selectedInstructorId === i.id ? "Выбран" : "Выбрать для заказа"}
                  </button>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
