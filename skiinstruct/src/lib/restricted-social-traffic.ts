/** First-touch: Instagram / Facebook / Threads. Не перезаписываем. */
export const TRAFFIC_SOURCE_COOKIE_NAME = "utr_src";

export type RestrictedSocialId = "instagram" | "facebook" | "threads";

const HOST_TO_ID: Array<{ test: (host: string) => boolean; id: RestrictedSocialId }> = [
  { test: (h) => h === "instagram.com" || h.endsWith(".instagram.com"), id: "instagram" },
  {
    test: (h) =>
      h === "facebook.com" ||
      h.endsWith(".facebook.com") ||
      h === "fb.com" ||
      h.endsWith(".fb.com") ||
      h === "fb.me" ||
      h === "m.facebook.com",
    id: "facebook",
  },
  {
    test: (h) =>
      h === "threads.net" || h.endsWith(".threads.net") || h === "threads.com" || h.endsWith(".threads.com"),
    id: "threads",
  },
];

const LABELS: Record<RestrictedSocialId, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
};

export function parseRestrictedSocialId(raw: string | null | undefined): RestrictedSocialId | null {
  const v = raw?.trim().toLowerCase();
  if (v === "instagram" || v === "facebook" || v === "threads") return v;
  return null;
}

export function restrictedSocialFromHost(host: string | null | undefined): RestrictedSocialId | null {
  const h = host?.trim().toLowerCase().replace(/^www\./, "");
  if (!h) return null;
  for (const row of HOST_TO_ID) {
    if (row.test(h)) return row.id;
  }
  return null;
}

export function restrictedSocialFromRefererUrl(url: string | null | undefined): RestrictedSocialId | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    return restrictedSocialFromHost(new URL(raw).hostname);
  } catch {
    return null;
  }
}

/** Instagram/Facebook in-app browser часто без Referer — смотрим UA. */
export function restrictedSocialFromUserAgent(ua: string | null | undefined): RestrictedSocialId | null {
  const s = ua ?? "";
  if (/Instagram/i.test(s)) return "instagram";
  if (/\bThreads\b/i.test(s)) return "threads";
  if (/FBAN|FBAV|FB_IAB/i.test(s)) return "facebook";
  return null;
}

export function detectRestrictedSocial(input: {
  referer?: string | null;
  userAgent?: string | null;
  cookie?: string | null;
}): { id: RestrictedSocialId; evidence: "cookie" | "referer" | "ua" } | null {
  const fromCookie = parseRestrictedSocialId(input.cookie);
  if (fromCookie) return { id: fromCookie, evidence: "cookie" };
  const fromReferer = restrictedSocialFromRefererUrl(input.referer);
  if (fromReferer) return { id: fromReferer, evidence: "referer" };
  const fromUa = restrictedSocialFromUserAgent(input.userAgent);
  if (fromUa) return { id: fromUa, evidence: "ua" };
  return null;
}

export function restrictedSocialLabel(id: RestrictedSocialId): string {
  return LABELS[id];
}

export function isAcquisitionRestricted(acq: Record<string, unknown> | null | undefined): boolean {
  return Boolean(parseRestrictedSocialId(String(acq?.restricted_social ?? "")));
}

/** Строка для модерации: сначала запрещённая сеть, потом UTM. */
export function formatAcquisitionSource(acq: Record<string, unknown> | null | undefined): string | null {
  if (!acq) return null;
  const bits: string[] = [];
  const restricted = parseRestrictedSocialId(String(acq.restricted_social ?? ""));
  if (restricted) {
    const evidence = String(acq.traffic_evidence ?? "").trim();
    const extra =
      evidence === "ua" ? "in-app" : evidence === "referer" ? "переход" : evidence === "cookie" ? "cookie" : "";
    bits.push(`⚠ ${LABELS[restricted]}${extra ? ` (${extra})` : ""} — реклама запрещена`);
  }
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
    const v = acq[key];
    if (typeof v === "string" && v.trim()) bits.push(v.trim());
  }
  const host = typeof acq.traffic_referrer === "string" ? acq.traffic_referrer.trim() : "";
  if (host && !restricted) bits.push(host);
  return bits.length ? bits.join(" · ") : null;
}

/** Дополнить UTM данными о запрещённой соцсети (Instagram in-app и т.п.). */
export function mergeAcquisitionWithRestrictedTraffic(
  form: Record<string, string>,
  opts: { referer?: string | null; userAgent?: string | null; cookie?: string | null },
): Record<string, string> {
  const out = { ...form };
  const fromForm = parseRestrictedSocialId(out.restricted_social);
  const detected = detectRestrictedSocial({
    cookie: opts.cookie,
    referer: opts.referer,
    userAgent: opts.userAgent,
  });
  const id = detected?.id ?? fromForm;
  if (id) {
    out.restricted_social = id;
    if (!out.traffic_evidence) {
      out.traffic_evidence = detected?.evidence ?? "form";
    }
  }
  if (!out.traffic_referrer && opts.referer) {
    try {
      out.traffic_referrer = new URL(opts.referer).hostname.slice(0, 200);
    } catch {
      /* ignore */
    }
  }
  return out;
}
