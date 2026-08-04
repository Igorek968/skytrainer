import type { Metadata } from "next";

import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { PrichodiLanding } from "@/shared/marketing/prichodi-landing";

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

export default function PrichodiLandingPage() {
  return <PrichodiLanding />;
}
