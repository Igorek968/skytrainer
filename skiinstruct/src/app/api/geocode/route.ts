import { NextResponse } from "next/server";
import { z } from "zod";

import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(3).max(300),
});

const NOMINATIM_USER_AGENT =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL != null && process.env.NEXT_PUBLIC_SUPPORT_EMAIL !== ""
    ? `SkyTrainer/1.0 (${process.env.NEXT_PUBLIC_SUPPORT_EMAIL})`
    : "SkyTrainer/1.0 (ski instructor booking)";

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

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
  nominatimUrl.searchParams.set("format", "json");
  nominatimUrl.searchParams.set("q", parsed.data.q);
  nominatimUrl.searchParams.set("limit", "1");
  nominatimUrl.searchParams.set("addressdetails", "0");

  let res: Response;
  try {
    res = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Сервис геокодирования недоступен" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: "Сервис геокодирования недоступен" }, { status: 502 });
  }

  const results: unknown = await res.json();
  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: "Адрес не найден. Уточните запрос." }, { status: 404 });
  }

  const hit = results[0] as { lat?: string; lon?: string; display_name?: string };
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Некорректный ответ геокодера" }, { status: 502 });
  }

  return NextResponse.json({
    lat,
    lng,
    displayName: typeof hit.display_name === "string" ? hit.display_name : parsed.data.q,
  });
}
