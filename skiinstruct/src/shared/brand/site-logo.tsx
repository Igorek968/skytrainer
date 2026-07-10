import { getBrandAltText, BRAND_LOGO_MARK } from "@/shared/brand/assets";
import { cn } from "@/lib/utils";

type SiteLogoProps = {
  className?: string;
  /** Компактный размер на узких экранах. */
  compact?: boolean;
};

/** Цвет левой фигуры логотипа. */
const BRAND_TEAL = "#0f766e";

export function SiteLogo({ className, compact = false }: SiteLogoProps) {
  const alt = getBrandAltText();

  return (
    <span
      className={cn(
        "inline-flex flex-row flex-nowrap items-center gap-2 whitespace-nowrap",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- brand PNG, без next/image */}
      <img
        src={BRAND_LOGO_MARK}
        alt=""
        width={40}
        height={66}
        className={cn(
          "h-10 w-auto shrink-0 object-contain object-left",
          compact && "h-9",
        )}
        decoding="async"
      />
      <span
        className={cn(
          "shrink-0 font-bold tracking-tight",
          compact ? "text-base" : "text-lg sm:text-xl",
        )}
        aria-label={alt}
      >
        <span style={{ color: BRAND_TEAL }}>Твой</span>
        <span className="text-slate-900 dark:text-slate-100">Тренер</span>
      </span>
    </span>
  );
}
