import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { resolveInstructorByPublicKey } from "@/lib/services/instructor-nickname-uniqueness";

type Ctx = { params: Promise<{ id: string }> };

const querySchema = z.object({
  sort: z.enum(["date_desc", "date_asc", "rating_desc", "rating_asc"]).default("date_desc"),
  limit: z.coerce.number().min(1).max(200).default(100),
});

export async function GET(req: Request, ctx: Ctx) {
  const { id: publicKey } = await ctx.params;
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const resolved = await resolveInstructorByPublicKey(publicKey);
  if (!resolved) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }
  const id = resolved.id;

  const { sort, limit } = parsed.data;
  const [orderRows, eventRows] = await Promise.all([
    prisma.order.findMany({
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
    }),
    prisma.eventRegistration.findMany({
      where: {
        event: { instructorId: id },
        status: "PAID",
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
    }),
  ]);

  const rows = [
    ...orderRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      clientRating: r.clientRating,
      clientReview: r.clientReview,
      authorName: r.client.name,
    })),
    ...eventRows.map((r) => ({
      id: `event-${r.id}`,
      createdAt: r.createdAt,
      clientRating: r.clientRating,
      clientReview: r.clientReview,
      authorName: r.client.name,
    })),
  ];

  const sorted = [...rows].sort((a, b) => {
    if (sort === "date_desc") return b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === "date_asc") return a.createdAt.getTime() - b.createdAt.getTime();
    if (sort === "rating_desc") return (b.clientRating ?? 0) - (a.clientRating ?? 0);
    return (a.clientRating ?? 0) - (b.clientRating ?? 0);
  });

  return NextResponse.json({
    reviews: sorted.slice(0, limit).map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      rating: r.clientRating,
      text: r.clientReview,
      authorName: r.authorName,
    })),
  });
}
