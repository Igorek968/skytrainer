"use client";

import { hasYandexMapsKey } from "@/features/map/yandex-maps-api";
import { NearbyMap } from "@/features/map/nearby-map";
import { YandexBookingMap, type BookingMapProps } from "@/features/map/yandex-booking-map";

export type { BookingMapProps };

/** Карта заказа: Яндекс.Карты при наличии ключа, иначе OpenStreetMap (Leaflet). */
export function BookingMap(props: BookingMapProps) {
  if (hasYandexMapsKey()) {
    return <YandexBookingMap {...props} />;
  }
  return (
    <NearbyMap
      center={props.center}
      meetLat={props.meetLat}
      meetLng={props.meetLng}
      instructors={props.instructors}
      radiusKm={props.radiusKm}
      onMeetChange={props.onMeetChange}
      onLocateMe={props.onLocateMe}
      onInstructorSelect={props.onInstructorSelect}
      onInstructorFocus={props.onInstructorFocus}
      selectedInstructorId={props.selectedInstructorId}
      className={props.className}
      interactive={props.interactive}
    />
  );
}
