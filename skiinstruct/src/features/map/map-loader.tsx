"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/shared/ui/skeleton";

export const NearbyMapLazy = dynamic(
  () => import("./nearby-map").then((m) => m.NearbyMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[320px] w-full rounded-lg md:h-[420px]" />,
  }
);
