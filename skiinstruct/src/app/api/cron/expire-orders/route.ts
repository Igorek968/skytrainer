import { NextResponse } from "next/server";

import { processExpiredPendingOrders } from "@/lib/services/instructor-routing";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

async function expire(): Promise<number> {
  return processExpiredPendingOrders();
}

/** Vercel Cron uses GET — pass ?secret=CRON_SECRET or Authorization: Bearer */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = await expire();
  return NextResponse.json({ expired: count });
}

/** External schedulers can POST with Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = await expire();
  return NextResponse.json({ expired: count });
}
