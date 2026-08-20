import type { Metadata } from "next";

import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { normalizeReferralCode } from "@/lib/referral-cookie";
import { PrichodiLanding } from "@/shared/marketing/prichodi-landing";
import { notFound } from "next/navigation";

const PATH = "/landings/prichodi";
const TITLE = "Приходи к нам — инструкторам на ТвойТренер.рф";
const DESCRIPTION =
  "Присоединяйтесь к комьюнити инструкторов, тренеров и гидов на ТвойТренер.рф: заявки с карты, свободный график и оплата онлайн через ЮKassa.";
const OG = "/brand/avito-vacancy/hero-prichodi.png";

const base = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export const metadata: Metadata = {
  ...base,
  openGraph: {
    ...base.openGraph,
    images: [{ url: absoluteUrl(OG), alt: "ТвойТренер — приходи к нам" }],
  },
  twitter: {
    ...base.twitter,
    images: [absoluteUrl(OG)],
  },
};

type Props = { params: Promise<{ code: string }> };

/** Реферальный хвост: /landings/prichodi/ник → тот же лендинг + cookie из middleware. */
export default async function PrichodiReferralLandingPage({ params }: Props) {
  const { code: raw } = await params;
  const code = normalizeReferralCode(raw);
  if (!code) notFound();
  return <PrichodiLanding />;
}
