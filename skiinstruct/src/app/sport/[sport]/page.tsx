import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SEO_SPORTS, getSeoSport, sportLandingCopy, sportPath } from "@/lib/seo-landings";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { SeoLandingShell } from "@/shared/seo/seo-landing-shell";

type Props = { params: Promise<{ sport: string }> };

export function generateStaticParams() {
  return SEO_SPORTS.map((s) => ({ sport: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sport: slug } = await params;
  const sport = getSeoSport(slug);
  if (!sport) return {};
  const copy = sportLandingCopy(sport);
  return pageMetadata({ title: copy.title, description: copy.description, path: sportPath(sport) });
}

export default async function SportLandingPage({ params }: Props) {
  const { sport: slug } = await params;
  const sport = getSeoSport(slug);
  if (!sport) notFound();
  const copy = sportLandingCopy(sport);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.h1,
    description: copy.description,
    url: absoluteUrl(sportPath(sport)),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SeoLandingShell title={copy.h1} lead={copy.lead} sport={sport} mapHref="/" />
    </>
  );
}
