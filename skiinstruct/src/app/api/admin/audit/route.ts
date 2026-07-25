import { NextResponse } from "next/server";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import { listAdminAuditLogs } from "@/lib/services/admin-audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 80;

  const rows = await listAdminAuditLogs(Number.isFinite(limit) ? limit : 80);
  return NextResponse.json({ generatedAt: new Date().toISOString(), rows });
}
