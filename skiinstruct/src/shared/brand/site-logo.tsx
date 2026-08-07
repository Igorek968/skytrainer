import {
  getBrandAltText,
  BRAND_LOGO_OFFICIAL_PNG,
} from "@/shared/brand/assets";
import { cn } from "@/lib/utils";

type SiteLogoProps = {
  className?: string;
  /** Компактный размер на узких экранах. */
  compact?: boolean;
};

/** Полный официальный логотип (PNG-эталон), как в brand/logo-tvoytrener-official.png */
export function SiteLogo({ className, compact = false }: SiteLogoProps) {
  const alt = getBrandAltText();

  return (
    <span className={cn("inline-flex items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- brand PNG, без next/image */}
      <img
        src={BRAND_LOGO_OFFICIAL_PNG}
        alt={alt}
        width={220}
        height={68}
        className={cn(
          "h-9 w-auto max-w-[min(100%,220px)] object-contain object-left sm:h-10",
          compact && "h-8 sm:h-9",
        )}
        decoding="async"
      />
    </span>
  );
}
