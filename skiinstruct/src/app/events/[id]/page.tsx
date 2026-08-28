import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PublicEventView } from "@/features/events/public-event-view";
import { loadPublicClientEvent, publicEventPath } from "@/lib/public-event";
import { publicUploadAbsoluteDisplaySrc } from "@/lib/public-uploads-display";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/seo-schema";
import { formatEventDateRu, formatEventPriceRu } from "@/lib/instructor-events";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await loadPublicClientEvent(id);
  if (!event) {
    return { title: "Событие не найдено | ТвойТренер.рф" };
  }
  const when = formatEventDateRu(event.eventAt);
  const place = event.venueAddress?.trim();
  const desc = [
    event.body.trim().slice(0, 140) || event.title,
    when,
    place,
    formatEventPriceRu(event.priceRub),
  ]
    .filter(Boolean)
    .join(". ");
  const photo = publicUploadAbsoluteDisplaySrc(event.photoUrl);
  const meta = pageMetadata({
    title: `${event.title} — запись | ТвойТренер.рф`,
    description: desc.slice(0, 300),
    path: publicEventPath(event.id),
  });
  if (photo && meta.openGraph) {
    meta.openGraph = {
      ...meta.openGraph,
      images: [{ url: photo, alt: event.title }],
    };
  }
  if (photo && meta.twitter) {
    meta.twitter = { ...meta.twitter, images: [photo] };
  }
  return meta;
}

export default async function PublicEventPage({ params }: Props) {
  const { id } = await params;
  const event = await loadPublicClientEvent(id);
  if (!event) notFound();

  const path = publicEventPath(event.id);
  const when = event.eventAt;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.body.trim() || event.title,
    url: absoluteUrl(path),
    startDate: when ?? undefined,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: publicUploadAbsoluteDisplaySrc(event.photoUrl) ?? undefined,
    location: event.venueAddress?.trim()
      ? {
          "@type": "Place",
          name: event.venueAddress.trim(),
          address: event.venueAddress.trim(),
        }
      : undefined,
    organizer: event.instructorName
      ? { "@type": "Person", name: event.instructorName }
      : { "@type": "Organization", name: "ТвойТренер.рф" },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(path),
      price: event.isFree ? 0 : (event.priceRub ?? 0),
      priceCurrency: "RUB",
      availability: event.registrationOpen
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "ТвойТренер.рф", path: "/" },
              { name: "События", path: "/events" },
              { name: event.title, path },
            ]),
          ),
        }}
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка…</p>}>
        <PublicEventView event={event} />
      </Suspense>
    </>
  );
}
