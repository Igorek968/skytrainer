import { getBrandAltText, BRAND_LOGO_HORIZONTAL } from "@/shared/brand/assets";
import { cn } from "@/lib/utils";

type SiteLogoProps = {
  className?: string;
  /** Компактный знак без текста на узких экранах. */
  compact?: boolean;
};

export function SiteLogo({ className, compact = false }: SiteLogoProps) {
  const alt = getBrandAltText();
  const src = compact ? "/brand/logo-mark.svg" : BRAND_LOGO_HORIZONTAL;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG brand mark, масштабируется без next/image
    <img
      src={src}
      alt={alt}
      width={compact ? 36 : 168}
      height={compact ? 36 : 36}
      className={cn("h-9 w-auto max-w-[min(100%,11rem)] object-contain object-left", className)}
      decoding="async"
    />
  );
}
