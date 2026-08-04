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

type SearchParamsLike = { get: (key: string) => string | null };

export function utmFromSearchParams(searchParams: SearchParamsLike): CapturedUtm {
  const next: CapturedUtm = {};
  for (const key of UTM_KEYS) {
    const v = searchParams.get(key)?.trim();
    if (v) next[key] = v;
  }
  return next;
}

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

function writeStoredUtm(utm: CapturedUtm): void {
  if (typeof window === "undefined" || Object.keys(utm).length === 0) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
  } catch {
    /* ignore quota */
  }
}

/**
 * First-touch: если источник уже сохранён — не перезаписываем paid UTM
 * тегами с лендинговых CTA. Дозаполняем только пустые ключи.
 */
export function captureUtmFirstTouch(incoming: CapturedUtm): CapturedUtm {
  if (Object.keys(incoming).length === 0) return readStoredUtm();
  const existing = readStoredUtm();
  if (existing.utm_source) {
    const merged: CapturedUtm = { ...incoming, ...existing };
    writeStoredUtm(merged);
    return merged;
  }
  writeStoredUtm(incoming);
  return incoming;
}

/**
 * Для формы заявки: first-touch из storage, иначе UTM из URL (прямой заход с объявления).
 * URL читаем сразу — без гонки с UtmCapture.
 */
export function resolveUtmForForm(searchParams: SearchParamsLike): CapturedUtm {
  const fromUrl = utmFromSearchParams(searchParams);
  const fromStorage = readStoredUtm();
  if (fromStorage.utm_source) return fromStorage;
  if (Object.keys(fromUrl).length > 0) {
    writeStoredUtm(fromUrl);
    return fromUrl;
  }
  return fromStorage;
}

/** Сохраняет UTM из URL в sessionStorage (first-touch) для сквозной аналитики. */
export function UtmCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    captureUtmFirstTouch(utmFromSearchParams(searchParams));
  }, [searchParams]);

  return null;
}
