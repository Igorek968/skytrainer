"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { normalizeReferralCode } from "@/lib/referral-cookie";

function paramsKey(params?: Record<string, string>): string {
  if (!params) return "";
  return Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

/** Сохраняет ?ref= (и utm) при переходах с реферального лендинга. */
export function useReferralAwareHref(basePath: string, extraParams?: Record<string, string>): string {
  const searchParams = useSearchParams();
  const extras = paramsKey(extraParams);
  return useMemo(() => {
    const url = new URL(basePath, "https://example.local");
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v) url.searchParams.set(k, v);
      }
    }
    const ref = normalizeReferralCode(searchParams.get("ref"));
    if (ref) url.searchParams.set("ref", ref);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
      const v = searchParams.get(key);
      if (v && !url.searchParams.has(key)) url.searchParams.set(key, v);
    }
    return `${url.pathname}${url.search}`;
    // extras covers extraParams content; searchParams is a stable-ish Next object
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extras mirrors extraParams
  }, [basePath, extras, searchParams]);
}
