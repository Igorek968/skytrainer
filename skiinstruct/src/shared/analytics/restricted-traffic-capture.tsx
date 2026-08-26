"use client";

import { useEffect } from "react";

import {
  detectRestrictedSocial,
  type RestrictedSocialId,
} from "@/lib/restricted-social-traffic";
import { YM_GOALS, trackYandexGoal, trackYandexParams } from "@/shared/analytics/yandex-metrika-client";

const STORAGE_KEY = "skiinstruct_restricted_social";

type StoredTraffic = {
  restricted_social: RestrictedSocialId;
  traffic_evidence: "referer" | "ua";
  traffic_referrer?: string;
};

export function readStoredRestrictedTraffic(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredTraffic;
    if (!parsed.restricted_social) return {};
    const out: Record<string, string> = {
      restricted_social: parsed.restricted_social,
      traffic_evidence: parsed.traffic_evidence,
    };
    if (parsed.traffic_referrer) out.traffic_referrer = parsed.traffic_referrer;
    return out;
  } catch {
    return {};
  }
}

function writeStored(traffic: StoredTraffic): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(traffic));
  } catch {
    /* quota */
  }
}

/** First-touch: in-app браузер и document.referrer (Referer часто пустой). */
export function captureRestrictedTrafficFirstTouch(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const existing = readStoredRestrictedTraffic();
  if (existing.restricted_social) return existing;

  const referrer = document.referrer || "";
  let host = "";
  try {
    if (referrer) host = new URL(referrer).hostname;
  } catch {
    host = "";
  }
  const detected = detectRestrictedSocial({
    referer: referrer,
    userAgent: navigator.userAgent,
  });
  if (!detected) return {};

  const stored: StoredTraffic = {
    restricted_social: detected.id,
    traffic_evidence: detected.evidence === "ua" ? "ua" : "referer",
    ...(host ? { traffic_referrer: host.slice(0, 200) } : {}),
  };
  writeStored(stored);
  return readStoredRestrictedTraffic();
}

export function RestrictedTrafficCapture() {
  useEffect(() => {
    const traffic = captureRestrictedTrafficFirstTouch();
    const id = traffic.restricted_social;
    if (!id) return;
    const flag = "skiinstruct_restricted_social_ym";
    try {
      if (sessionStorage.getItem(flag) === "1") return;
      sessionStorage.setItem(flag, "1");
    } catch {
      /* ignore */
    }
    trackYandexParams({ restricted_social: id });
    trackYandexGoal(YM_GOALS.restrictedSocialVisit, { network: id });
  }, []);

  return null;
}
