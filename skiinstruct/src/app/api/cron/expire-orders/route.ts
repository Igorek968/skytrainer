import { NextResponse } from "next/server";

import { authorizeCronRequest } from "@/lib/cron-auth";
import { processExpiredPendingOrders } from "@/lib/services/instructor-routing";

async function expire(): Promise<number> {
  return processExpiredPendingOrders();
}

/** Vercel Cron uses GET — pass ?secret=CRON_SECRET or Authorization: Bearer */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = await expire();
  return NextResponse.json({ expired: count });
}

/** External schedulers can POST with Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = await expire();
  return NextResponse.json({ expired: count });
}
