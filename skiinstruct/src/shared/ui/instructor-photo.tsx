"use client";

import Image from "next/image";

import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { cn } from "@/lib/utils";

type InstructorPhotoProps = {
  src: string | null | undefined;
  alt: string;
  size: number;
  className?: string;
  priority?: boolean;
};

/** Аватар/фото инструктора через next/image (API-медиа — unoptimized, как в кабинете). */
export function InstructorPhoto({ src, alt, size, className, priority }: InstructorPhotoProps) {
  const displaySrc = publicUploadDisplaySrc(src);
  if (!displaySrc) return null;

  return (
    <Image
      src={displaySrc}
      alt={alt}
      width={size}
      height={size}
      className={cn("object-cover", className)}
      sizes={`${size}px`}
      loading={priority ? undefined : "lazy"}
      priority={priority}
      unoptimized
    />
  );
}
