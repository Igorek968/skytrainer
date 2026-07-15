import { INDEXNOW_DEFAULT_KEY, getIndexNowKey } from "@/lib/indexnow";

/** IndexNow ownership key at site root (Yandex / Bing). */
export async function GET() {
  const key = getIndexNowKey() || INDEXNOW_DEFAULT_KEY;
  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
