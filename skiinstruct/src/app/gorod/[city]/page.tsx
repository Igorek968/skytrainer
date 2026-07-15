import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { cityLandingCopy, cityPath, getSeoCity, SEO_CITIES } from "@/lib/seo-landings";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { SeoLandingShell } from "@/shared/seo/seo-landing-shell";

type Props = { params: Promise<{ city: string }> };

export function generateStaticParams() {
  return SEO_CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const city = getSeoCity(slug);
  if (!city) return {};
  const copy = cityLandingCopy(city);
  return pageMetadata({ title: copy.title, description: copy.description, path: cityPath(city) });
}

export default async function CityLandingPage({ params }: Props) {
  const { city: slug } = await params;
  const city = getSeoCity(slug);
  if (!city) notFound();
  const copy = cityLandingCopy(city);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.h1,
    description: copy.description,
    url: absoluteUrl(cityPath(city)),
    isPartOf: { "@type": "WebSite", name: "ТвойТренер.рф", url: absoluteUrl("/") },
    about: { "@type": "Place", name: city.name, description: city.regionHint },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SeoLandingShell
        title={copy.h1}
        lead={copy.lead}
        city={city}
        facts={copy.facts}
        faqs={copy.faqs}
        mapHref="/"
      />
    </>
  );
}
