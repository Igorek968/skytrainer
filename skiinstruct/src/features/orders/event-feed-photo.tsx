"use client";

import type { ClientInstructorEventDTO } from "@/lib/instructor-events";
import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";

export function EventFeedPhoto({
  event,
  className,
}: {
  event: Pick<ClientInstructorEventDTO, "photoUrl" | "title">;
  className?: string;
}) {
  const src = publicUploadDisplaySrc(event.photoUrl);
  if (!src) return null;

  return (
    <div className={className ?? "mt-2 overflow-hidden rounded-md border border-border bg-muted/30"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={event.title}
        className="aspect-[16/9] w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
