import Link from "next/link";
import type { ReactNode } from "react";

import { ServiceGuarantees } from "@/shared/marketing/service-guarantees";

type Props = {
  eyebrow?: string;
  title: string;
  lead: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  bullets?: string[];
  children?: ReactNode;
};

/** Посадочная под рекламу: один оффер, один CTA на первом экране, без селекторов спорта. */
export function TrafficLanding({
  eyebrow,
  title,
  lead,
  ctaLabel,
  ctaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
  bullets = [],
  children,
}: Props) {
  return (
    <article className="mx-auto max-w-3xl space-y-10 py-2">
      <header className="space-y-4">
        {eyebrow ? (
          <p className="text-sm font-medium tracking-wide text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
        <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{lead}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {ctaLabel}
          </Link>
          {secondaryCtaLabel && secondaryCtaHref ? (
            <Link
              href={secondaryCtaHref}
              className="inline-flex items-center justify-center text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {secondaryCtaLabel}
            </Link>
          ) : null}
        </div>
      </header>

      {bullets.length > 0 ? (
        <section className="space-y-2" aria-label="Преимущества">
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {children}

      <ServiceGuarantees />
    </article>
  );
}
