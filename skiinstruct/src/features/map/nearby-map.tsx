"use client";

import type { LatLngExpression } from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

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

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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
      icon={DefaultIcon}
      eventHandlers={{
        dragend: (e) => {
          const m = e.target as L.Marker;
          const ll = m.getLatLng();
          onDragEnd?.(ll.lat, ll.lng);
        },
      }}
    >
      <Popup>Встреча</Popup>
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
            icon={DefaultIcon}
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
