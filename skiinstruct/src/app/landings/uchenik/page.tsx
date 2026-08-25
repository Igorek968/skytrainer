import type { Metadata } from "next";

import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { UchenikLanding } from "@/shared/marketing/uchenik-landing";

const PATH = "/landings/uchenik";
const TITLE = "Твой тренер рядом — найти инструктора на ТвойТренер.рф";
const DESCRIPTION =
  "Друг пригласил вас на ТвойТренер.рф: найдите живого инструктора на карте, запишитесь и оплатите занятие онлайн через ЮKassa.";
const OG = "/brand/avito-vacancy/slides-5/slide-01-tennis.png";

const base = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export const metadata: Metadata = {
  ...base,
  openGraph: {
    ...base.openGraph,
    images: [{ url: absoluteUrl(OG), alt: "ТвойТренер — твой тренер рядом" }],
  },
  twitter: {
    ...base.twitter,
    images: [absoluteUrl(OG)],
  },
};

export default function UchenikLandingPage() {
  return <UchenikLanding />;
}
