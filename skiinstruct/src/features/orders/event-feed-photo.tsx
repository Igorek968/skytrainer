"use client";

import { EventRatingBadge } from "@/features/orders/event-rating-badge";
import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { cn } from "@/lib/utils";

export function EventFeedPhoto({
  event,
  className,
}: {
  event: Pick<ClientInstructorEventDTO, "photoUrl" | "title" | "ratingAvg" | "reviewCount">;
  className?: string;
}) {
  const src = publicUploadDisplaySrc(event.photoUrl);
  if (!src) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted/30",
        className ?? "mt-2 rounded-md border border-border",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={event.title}
        className="aspect-[16/9] w-full object-cover"
        loading="lazy"
      />
      <EventRatingBadge ratingAvg={event.ratingAvg} reviewCount={event.reviewCount} />
    </div>
  );
}
