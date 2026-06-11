import { NextResponse } from "next/server";

import { fetchAdminQualityClaims } from "@/lib/admin-quality-claims";
import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const failedOnly = url.searchParams.get("failedOnly") === "1";
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const rows = await fetchAdminQualityClaims({
    failedOnly,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: rows.length,
    rows,
  });
}
