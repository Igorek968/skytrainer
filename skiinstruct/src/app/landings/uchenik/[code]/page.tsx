import type { Metadata } from "next";

import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { UchenikLanding } from "@/shared/marketing/uchenik-landing";

const PATH = "/landings/uchenik";
const TITLE = "Твой тренер рядом — найти инструктора на ТвойТренер.рф";
const DESCRIPTION =
  "Друг пригласил вас на ТвойТренер.рф: найдите живого инструктора на карте, запишитесь и оплатите занятие онлайн через ЮKassa.";
const OG = "/brand/hero-uchenik-run.png?v=2";

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

type Props = { params: Promise<{ code: string }> };

/**
 * Реферальный хвост: /landings/uchenik/ник → тот же лендинг.
 * Невалидный/кириллический хвост (например «ваш-ник») тоже показывает страницу —
 * cookie ставится только если код проходит normalizeReferralCode.
 */
export default async function UchenikReferralLandingPage({ params }: Props) {
  await params;
  return <UchenikLanding />;
}
