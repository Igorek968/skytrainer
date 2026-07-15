import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  SEO_CITIES,
  SEO_SPORTS,
  citySportLandingCopy,
  citySportPath,
  getSeoCity,
  getSeoSport,
} from "@/lib/seo-landings";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { SeoLandingShell } from "@/shared/seo/seo-landing-shell";

type Props = { params: Promise<{ city: string; sport: string }> };

export function generateStaticParams() {
  // Не все комбинации на билде (экономия RAM на VPS); остальные — по запросу.
  const topSports = SEO_SPORTS.slice(0, 8);
  const params: { city: string; sport: string }[] = [];
  for (const city of SEO_CITIES) {
    for (const sport of topSports) {
      params.push({ city: city.slug, sport: sport.slug });
    }
  }
  return params;
}

export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: citySlug, sport: sportSlug } = await params;
  const city = getSeoCity(citySlug);
  const sport = getSeoSport(sportSlug);
  if (!city || !sport) return {};
  const copy = citySportLandingCopy(city, sport);
  return pageMetadata({
    title: copy.title,
    description: copy.description,
    path: citySportPath(city, sport),
  });
}

export default async function CitySportLandingPage({ params }: Props) {
  const { city: citySlug, sport: sportSlug } = await params;
  const city = getSeoCity(citySlug);
  const sport = getSeoSport(sportSlug);
  if (!city || !sport) notFound();
  const copy = citySportLandingCopy(city, sport);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: copy.h1,
    description: copy.description,
    url: absoluteUrl(citySportPath(city, sport)),
    areaServed: city.name,
    provider: { "@type": "Organization", name: "ТвойТренер.рф", url: absoluteUrl("/") },
    serviceType: sport.name,
    offers: city.priceFromRub
      ? {
          "@type": "Offer",
          priceCurrency: "RUB",
          price: String(city.priceFromRub),
          description: `Ориентир «от ${city.priceFromRub} ₽/час»; точная ставка в профиле инструктора`,
        }
      : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SeoLandingShell
        title={copy.h1}
        lead={copy.lead}
        city={city}
        sport={sport}
        facts={copy.facts}
        faqs={copy.faqs}
        mapHref="/"
      />
    </>
  );
}
