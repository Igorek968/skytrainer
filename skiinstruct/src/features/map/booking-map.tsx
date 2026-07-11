"use client";

import { NearbyMap, type NearbyMapProps } from "@/features/map/nearby-map";

export type BookingMapProps = NearbyMapProps;

/** Карта заказа: Яндекс.Карты при наличии ключа, иначе OpenStreetMap (Leaflet). */
export function BookingMap(props: BookingMapProps) {
  return <NearbyMap {...props} />;
}
