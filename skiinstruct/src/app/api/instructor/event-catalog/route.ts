import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import { MAP_CITY_CENTERS } from "@/lib/map-city-centers";
import { listInstructorCatalogBrowse } from "@/lib/services/catalog-join";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  citySlug: z
    .string()
    .trim()
    .refine((s) => !s || MAP_CITY_CENTERS.some((c) => c.slug === s), "Неизвестный город")
    .optional(),
  q: z.string().trim().max(120).optional(),
});

export async function GET(req: Request) {
  const authResult = await requireInstructorSession();
  if (isApiErrorResponse(authResult)) return authResult;
  const { userId } = authResult;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const items = await listInstructorCatalogBrowse({
    instructorId: userId,
    citySlug: parsed.data.citySlug || null,
    q: parsed.data.q || null,
  });

  return NextResponse.json({ items });
}
