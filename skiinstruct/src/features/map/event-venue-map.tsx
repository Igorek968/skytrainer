"use client";

import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { hasYandexMapsKey } from "@/features/map/yandex-maps-api";
import { YandexEventVenueMap } from "@/features/map/yandex-event-venue-map";
import { MapLegalStrip } from "@/shared/legal/map-legal-strip";
import { cn } from "@/lib/utils";

function pinIcon(fill: string) {
  return L.divIcon({
    className: "map-pin-icon",
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="22" height="33" aria-hidden="true">
      <path fill="${fill}" stroke="#fff" stroke-width="1.5" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>
      <circle cx="12" cy="12" r="4" fill="#fff"/>
    </svg>`,
    iconSize: [22, 33],
    iconAnchor: [11, 33],
    popupAnchor: [0, -28],
  });
}

const VenueIcon = pinIcon("#dc2626");

function MapViewSync({ lat, lng, zoom = 14 }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.5 });
  }, [map, lat, lng, zoom]);
  return null;
}

function VenueMarker({
  position,
  draggable,
  onDragEnd,
  label,
}: {
  position: LatLngExpression;
  draggable: boolean;
  onDragEnd?: (lat: number, lng: number) => void;
  label: string;
}) {
  return (
    <Marker
      position={position}
      draggable={draggable}
      icon={VenueIcon}
      eventHandlers={{
        dragend: (e) => {
          const m = e.target as L.Marker;
          const ll = m.getLatLng();
          onDragEnd?.(ll.lat, ll.lng);
        },
      }}
    >
      <Popup>{label}</Popup>
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

export type EventVenueMapProps = {
  lat: number;
  lng: number;
  interactive?: boolean;
  className?: string;
  markerLabel?: string;
  onPositionChange?: (lat: number, lng: number) => void;
};

/** Место мероприятия: Яндекс.Карты при ключе, иначе OSM/CARTO. */
export function EventVenueMap(props: EventVenueMapProps) {
  if (hasYandexMapsKey()) {
    return <YandexEventVenueMap {...props} />;
  }
  return <LeafletEventVenueMap {...props} />;
}

function LeafletEventVenueMap({
  lat,
  lng,
  interactive = true,
  className,
  markerLabel = "Место мероприятия",
  onPositionChange,
}: EventVenueMapProps) {
  const center: LatLngExpression = [lat, lng];

  return (
    <div className={cn("w-full overflow-hidden rounded-lg border border-border", className)}>
      <div className="relative z-0 h-[200px] w-full sm:h-[220px]">
        <MapContainer center={center} zoom={14} className="h-full w-full" scrollWheelZoom={interactive}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
          <MapViewSync lat={lat} lng={lng} />
          {interactive && onPositionChange ? <MapClick onClick={onPositionChange} /> : null}
          <VenueMarker
            position={[lat, lng]}
            draggable={interactive && Boolean(onPositionChange)}
            onDragEnd={onPositionChange}
            label={markerLabel}
          />
        </MapContainer>
      </div>
      <MapLegalStrip />
    </div>
  );
}
