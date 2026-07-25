import { NextResponse } from "next/server";
import type { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import {
  parseAdminOnlineFilter,
  parseAdminUserRoleFilter,
  type AdminUserRoleFilter,
} from "@/lib/admin-list-filters";
import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  role: z.string().optional(),
  online: z.string().optional(),
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

  const roleFilter = parseAdminUserRoleFilter(parsed.data.role);
  const onlineOnly = parseAdminOnlineFilter(parsed.data.online);
  const q = parsed.data.q?.trim();

  const where: Prisma.UserWhereInput = {};
  if (roleFilter !== "all") {
    where.role = roleFilter as UserRole;
  }
  if (onlineOnly) {
    where.role = "INSTRUCTOR";
    where.instructorProfile = { isOnline: true };
    where.suspendedAt = null;
  }
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { id: { contains: q, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      suspendedAt: true,
      createdAt: true,
      updatedAt: true,
      instructorProfile: {
        select: {
          isOnline: true,
          verificationStatus: true,
          specializations: true,
        },
      },
    },
  });

  const countWhere = (role: AdminUserRoleFilter, online?: boolean) => {
    const w: Prisma.UserWhereInput = {};
    if (role !== "all") w.role = role as UserRole;
    if (online) {
      w.role = "INSTRUCTOR";
      w.instructorProfile = { isOnline: true };
    }
    return w;
  };

  const [allCount, clientCount, instructorCount, adminCount, onlineCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: countWhere("CLIENT") }),
    prisma.user.count({ where: countWhere("INSTRUCTOR") }),
    prisma.user.count({ where: countWhere("ADMIN") }),
    prisma.user.count({ where: countWhere("INSTRUCTOR", true) }),
  ]);

  return NextResponse.json({
    role: roleFilter,
    online: onlineOnly,
    total: users.length,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      suspendedAt: u.suspendedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      isOnline: u.instructorProfile?.isOnline ?? false,
      verificationStatus: u.instructorProfile?.verificationStatus ?? null,
      specializations: u.instructorProfile?.specializations ?? [],
    })),
    counts: {
      all: allCount,
      CLIENT: clientCount,
      INSTRUCTOR: instructorCount,
      ADMIN: adminCount,
      online: onlineCount,
    },
  });
}
