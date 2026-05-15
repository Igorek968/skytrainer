import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const querySchema = z.object({
  sort: z.enum(["date_desc", "date_asc", "rating_desc", "rating_asc"]).default("date_desc"),
  limit: z.coerce.number().min(1).max(200).default(100),
});

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { sort, limit } = parsed.data;
  const rows = await prisma.order.findMany({
    where: {
      instructorId: id,
      status: "COMPLETED",
      clientRating: { not: null },
    },
    select: {
      id: true,
      createdAt: true,
      clientRating: true,
      clientReview: true,
      client: { select: { name: true } },
    },
    take: limit,
  });

  const sorted = [...rows].sort((a, b) => {
    if (sort === "date_desc") return b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === "date_asc") return a.createdAt.getTime() - b.createdAt.getTime();
    if (sort === "rating_desc") return (b.clientRating ?? 0) - (a.clientRating ?? 0);
    return (a.clientRating ?? 0) - (b.clientRating ?? 0);
  });

  return NextResponse.json({
    reviews: sorted.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      rating: r.clientRating,
      text: r.clientReview,
      authorName: r.client.name,
    })),
  });
}
