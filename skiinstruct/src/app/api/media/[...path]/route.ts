import { NextResponse } from "next/server";

import { mimeForUploadPath, readPublicUpload } from "@/lib/public-uploads";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

/** Раздача файлов из public/uploads (Docker/prod: надёжнее, чем только static). */
export async function GET(_req: Request, ctx: Ctx) {
  const { path: segments } = await ctx.params;
  const buffer = await readPublicUpload(segments);
  if (!buffer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const joined = segments.join("/");
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeForUploadPath(joined),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
