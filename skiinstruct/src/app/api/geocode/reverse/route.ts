import { NextResponse } from "next/server";
import { z } from "zod";

import { nominatimReverseWithParts } from "@/lib/geocode-nominatim";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export async function GET(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`geocode-reverse:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов. Подождите минуту." }, { status: 429 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    lat: url.searchParams.get("lat"),
    lng: url.searchParams.get("lng"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные координаты" }, { status: 400 });
  }

  try {
    const hit = await nominatimReverseWithParts(parsed.data.lat, parsed.data.lng);
    if (!hit) {
      return NextResponse.json({ error: "Не удалось определить адрес для этой точки" }, { status: 404 });
    }
    return NextResponse.json(hit);
  } catch {
    return NextResponse.json({ error: "Сервис геокодирования недоступен" }, { status: 502 });
  }
}
