"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { publicUploadDisplaySrc } from "@/lib/public-uploads-display";
import { Button } from "@/shared/ui/button";

const SWIPE_THRESHOLD_PX = 56;

export type PhotoViewerState = {
  urls: string[];
  index: number;
};

export function PhotoViewerOverlay({
  urls,
  index,
  onIndexChange,
  onClose,
  ariaLabel = "Просмотр фото",
}: {
  urls: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  ariaLabel?: string;
}) {
  const safeIndex = Math.min(Math.max(index, 0), Math.max(urls.length - 1, 0));
  const src = publicUploadDisplaySrc(urls[safeIndex]);
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < urls.length - 1;
  const touchStartX = useRef<number | null>(null);

  const goPrev = useCallback(() => {
    if (safeIndex > 0) onIndexChange(safeIndex - 1);
  }, [onIndexChange, safeIndex]);

  const goNext = useCallback(() => {
    if (safeIndex < urls.length - 1) onIndexChange(safeIndex + 1);
  }, [onIndexChange, safeIndex, urls.length]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  if (!src || urls.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onTouchStart={(e) => {
        touchStartX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start == null) return;
        const end = e.changedTouches[0]?.clientX;
        if (end == null) return;
        const delta = end - start;
        if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
        if (delta > 0) goPrev();
        else goNext();
      }}
    >
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute right-3 top-3 z-20 h-11 w-11 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/70"
        aria-label="Закрыть"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="h-5 w-5" />
      </Button>

      {canPrev ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute left-2 top-1/2 z-20 h-11 w-11 -translate-y-1/2 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/70 sm:left-4"
          aria-label="Предыдущее фото"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      ) : null}

      {canNext ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute right-2 top-1/2 z-20 h-11 w-11 -translate-y-1/2 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/70 sm:right-4"
          aria-label="Следующее фото"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      ) : null}

      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Фото ${safeIndex + 1} из ${urls.length}`}
          className="max-h-[90vh] max-w-[90vw] rounded-lg border border-white/20 object-contain"
          draggable={false}
        />
        {urls.length > 1 ? (
          <p className="absolute bottom-2 right-2 rounded bg-black/55 px-2 py-0.5 text-xs text-white/90">
            {safeIndex + 1} / {urls.length}
          </p>
        ) : null}
      </div>
    </div>
  );
}
