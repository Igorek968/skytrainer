"use client";

import { Skeleton } from "@/shared/ui/skeleton";
import { WhenInViewport } from "@/shared/ui/when-in-viewport";

import { BookingMapLazy } from "@/features/map/map-loader";
import type { BookingMapProps } from "@/features/map/booking-map";

const MAP_SKELETON = (
  <Skeleton className="h-[320px] w-full rounded-lg md:h-[420px]" aria-hidden />
);

/** Карта заказа: JS карты грузится только при приближении блока к viewport. */
export function BookingMapViewport(props: BookingMapProps) {
  const { className, ...mapProps } = props;

  return (
    <WhenInViewport fallback={MAP_SKELETON} className={className}>
      <BookingMapLazy {...mapProps} />
    </WhenInViewport>
  );
}
