import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = clientIp(req.headers);
  // ~1 update / 30s: allow at most 2 per minute per user+IP
  if (!rateLimit(`loc:${session.user.id}:${ip}`, 2, 60_000)) {
    return NextResponse.json({ error: "Слишком частые обновления" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.instructorProfile.updateMany({
    where: { userId: session.user.id },
    data: {
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    },
  });

  return NextResponse.json({ ok: true });
}
