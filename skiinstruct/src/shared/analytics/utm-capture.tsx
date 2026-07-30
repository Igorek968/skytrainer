"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const STORAGE_KEY = "skiinstruct_utm";

export type CapturedUtm = Partial<Record<(typeof UTM_KEYS)[number], string>>;

export function readStoredUtm(): CapturedUtm {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CapturedUtm;
  } catch {
    return {};
  }
}

/** Сохраняет UTM из URL в sessionStorage для сквозной аналитики. */
export function UtmCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const next: CapturedUtm = {};
    let found = false;
    for (const key of UTM_KEYS) {
      const v = searchParams.get(key)?.trim();
      if (v) {
        next[key] = v;
        found = true;
      }
    }
    if (!found) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }, [searchParams]);

  return null;
}
