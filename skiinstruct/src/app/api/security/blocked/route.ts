import { NextResponse } from "next/server";

/** Заглушка: legacy sensitive uploads больше не отдаём публично. */
export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 404 });
}
