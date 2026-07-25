import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";

import {
  ADMIN_ORDER_GROUPS,
  type AdminOrderGroup,
  parseAdminOrderGroup,
} from "@/lib/admin-list-filters";
import { mapOrderOverviewRow, orderOverviewSelect } from "@/lib/admin-order-overview";
import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  group: z.string().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  q: z.string().trim().max(120).optional(),
});

export async function GET(req: Request) {
  const authResult = await requireAdminSession();
  if (isApiErrorResponse(authResult)) return authResult;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const group = parseAdminOrderGroup(parsed.data.group);
  const status = parsed.data.status;
  const q = parsed.data.q?.trim();

  const baseWhere =
    status != null
      ? { status }
      : group !== "all" && ADMIN_ORDER_GROUPS[group]
        ? { status: { in: ADMIN_ORDER_GROUPS[group]! } }
        : {};

  const where = {
    ...baseWhere,
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" as const } },
            { client: { email: { contains: q, mode: "insensitive" as const } } },
            { client: { name: { contains: q, mode: "insensitive" as const } } },
            { instructor: { email: { contains: q, mode: "insensitive" as const } } },
            { instructor: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [orders, countsByGroup] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: orderOverviewSelect,
    }),
    Promise.all(
      (["in_progress", "pending", "completed"] as const).map(async (g) => {
        const statuses = ADMIN_ORDER_GROUPS[g]!;
        return {
          group: g,
          count: await prisma.order.count({ where: { status: { in: statuses } } }),
        };
      }),
    ),
  ]);

  const totalAll = await prisma.order.count();

  return NextResponse.json({
    group: status != null ? "all" : group,
    status: status ?? null,
    total: orders.length,
    orders: orders.map(mapOrderOverviewRow),
    counts: {
      all: totalAll,
      in_progress: countsByGroup.find((c) => c.group === "in_progress")!.count,
      pending: countsByGroup.find((c) => c.group === "pending")!.count,
      completed: countsByGroup.find((c) => c.group === "completed")!.count,
    } satisfies Record<AdminOrderGroup, number>,
  });
}
