import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const resorts = await prisma.resort.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      centerLat: true,
      centerLng: true,
      zoom: true,
    },
  });
  return NextResponse.json({ resorts });
}
