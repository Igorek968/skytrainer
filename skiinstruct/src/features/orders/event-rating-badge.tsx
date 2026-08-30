"use client";

import { formatEventRatingBadge, formatEventRatingTitle } from "@/lib/event-reviews";
import { cn } from "@/lib/utils";

export function EventRatingBadge({
  ratingAvg,
  reviewCount,
  className,
}: {
  ratingAvg?: number | null;
  reviewCount?: number;
  className?: string;
}) {
  const count = reviewCount ?? 0;
  const avg = ratingAvg ?? null;
  return (
    <span
      className={cn(
        "absolute bottom-2 left-2 min-w-[2rem] rounded-md bg-[#3dbb4e] px-1.5 py-0.5 text-center text-xs font-bold leading-none text-white shadow-sm",
        className,
      )}
      title={formatEventRatingTitle(avg, count)}
    >
      {formatEventRatingBadge(avg, count)}
    </span>
  );
}
