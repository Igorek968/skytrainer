"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/shared/ui/skeleton";

export const NearbyMapLazy = dynamic(
  () => import("./nearby-map").then((m) => m.NearbyMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[320px] w-full rounded-lg md:h-[420px]" />,
  },
);

/** Карта заказа: Яндекс при наличии ключа, иначе OpenStreetMap. */
export const BookingMapLazy = dynamic(
  () => import("./booking-map").then((m) => m.BookingMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[320px] w-full rounded-lg md:h-[420px]" />,
  },
);
