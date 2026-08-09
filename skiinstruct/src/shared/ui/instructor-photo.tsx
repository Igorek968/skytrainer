"use client";

import { useState } from "react";

import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { cn } from "@/lib/utils";

type InstructorPhotoProps = {
  src: string | null | undefined;
  alt: string;
  size: number;
  className?: string;
  priority?: boolean;
};

/**
 * Аватар инструктора. Обычный <img>: next/image отклоняет абсолютные URL
 * нашего домена (нет в remotePatterns), даже с unoptimized.
 */
export function InstructorPhoto({ src, alt, size, className, priority }: InstructorPhotoProps) {
  const displaySrc = publicUploadDisplaySrc(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(displaySrc && failedSrc === displaySrc);

  if (!displaySrc || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- uploads via /api/media; see comment above
    <img
      src={displaySrc}
      alt={alt}
      width={size}
      height={size}
      className={cn("object-cover", className)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailedSrc(displaySrc)}
    />
  );
}
