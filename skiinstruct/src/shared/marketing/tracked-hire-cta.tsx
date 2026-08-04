"use client";

import Link from "next/link";

import { YM_GOALS, trackYandexGoal } from "@/shared/analytics/yandex-metrika-client";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  label: string;
  className?: string;
};

/** CTA найма с целью Метрики landing_instructor_cta. */
export function TrackedHireCta({ href, label, className }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90",
        className,
      )}
      onClick={() => trackYandexGoal(YM_GOALS.landingInstructorCta)}
    >
      {label}
    </Link>
  );
}
