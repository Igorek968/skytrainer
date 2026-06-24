"use client";

import { EventVenueMapLazy } from "@/features/map/map-loader";

export function EventVenueDisplay({
  address,
  lat,
  lng,
  compact,
}: {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  compact?: boolean;
}) {
  if (!address?.trim() || lat == null || lng == null) return null;

  const mapsUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  return (
    <div className={compact ? "mt-2 space-y-1.5" : "mt-3 space-y-2"}>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Место: </span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline-offset-2 hover:underline"
        >
          {address}
        </a>
      </p>
      <EventVenueMapLazy lat={lat} lng={lng} interactive={false} markerLabel={address} />
    </div>
  );
}
