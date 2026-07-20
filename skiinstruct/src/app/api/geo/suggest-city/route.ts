import { NextResponse } from "next/server";

import { clientIp, rateLimit } from "@/lib/rate-limit";
import { resolveMapViewCenter, FALLBACK_MAP_CITY } from "@/lib/map-city-centers";

export const dynamic = "force-dynamic";

type IpApiResponse = {
  status?: string;
  lat?: number;
  lon?: number;
  city?: string;
  message?: string;
};

/**
 * Подсказка центра карты по IP клиента (если GPS недоступен).
 * Возвращает центр ближайшего города из каталога.
 */
export async function GET(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`geo-city:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const lookUpIp = ip === "unknown" || ip === "127.0.0.1" || ip === "::1" ? "" : ip;
  const url = lookUpIp
    ? `http://ip-api.com/json/${encodeURIComponent(lookUpIp)}?fields=status,message,lat,lon,city&lang=ru`
    : `http://ip-api.com/json/?fields=status,message,lat,lon,city&lang=ru`;

  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(4_000),
      next: { revalidate: 0 },
    });
    if (!r.ok) {
      return NextResponse.json({
        lat: FALLBACK_MAP_CITY.lat,
        lng: FALLBACK_MAP_CITY.lng,
        citySlug: FALLBACK_MAP_CITY.slug,
        cityName: FALLBACK_MAP_CITY.name,
        source: "fallback",
      });
    }
    const data = (await r.json()) as IpApiResponse;
    if (data.status !== "success" || data.lat == null || data.lon == null) {
      return NextResponse.json({
        lat: FALLBACK_MAP_CITY.lat,
        lng: FALLBACK_MAP_CITY.lng,
        citySlug: FALLBACK_MAP_CITY.slug,
        cityName: FALLBACK_MAP_CITY.name,
        source: "fallback",
      });
    }

    const resolved = resolveMapViewCenter(data.lat, data.lon);
    return NextResponse.json({
      lat: resolved.lat,
      lng: resolved.lng,
      citySlug: resolved.city?.slug ?? null,
      cityName: resolved.city?.name ?? data.city ?? null,
      source: "ip",
      snapped: resolved.snapped,
    });
  } catch {
    return NextResponse.json({
      lat: FALLBACK_MAP_CITY.lat,
      lng: FALLBACK_MAP_CITY.lng,
      citySlug: FALLBACK_MAP_CITY.slug,
      cityName: FALLBACK_MAP_CITY.name,
      source: "fallback",
    });
  }
}
