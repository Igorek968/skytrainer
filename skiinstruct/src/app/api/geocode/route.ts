import { NextResponse } from "next/server";
import { z } from "zod";

import { nominatimSearch } from "@/lib/geocode-nominatim";
import { photonGeocodeSearch } from "@/lib/geocode-photon";
import { yandexHttpGeocodeSearch } from "@/lib/yandex-geocode-http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(3).max(300),
});

export async function GET(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`geocode:${ip}`, 15, 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов. Подождите минуту." }, { status: 429 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ q: url.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "Укажите адрес (не менее 3 символов)" }, { status: 400 });
  }

  const q = parsed.data.q;

  try {
    const yandexHit = await yandexHttpGeocodeSearch(q);
    if (yandexHit) {
      return NextResponse.json(yandexHit);
    }

    let nominatimHit: Awaited<ReturnType<typeof nominatimSearch>> = null;
    try {
      nominatimHit = await nominatimSearch(q);
    } catch {
      /* Nominatim иногда недоступен из Docker (SSL) — пробуем Photon */
    }
    if (nominatimHit) {
      return NextResponse.json({
        lat: nominatimHit.lat,
        lng: nominatimHit.lng,
        displayName: nominatimHit.displayName,
      });
    }

    const photonHit = await photonGeocodeSearch(q);
    if (photonHit) {
      return NextResponse.json(photonHit);
    }
  } catch {
    return NextResponse.json({ error: "Сервис геокодирования недоступен" }, { status: 502 });
  }

  return NextResponse.json({ error: "Адрес не найден. Уточните запрос." }, { status: 404 });
}
