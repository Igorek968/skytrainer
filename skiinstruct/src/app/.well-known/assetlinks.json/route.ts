import {
  ANDROID_PACKAGE_NAME,
  buildAssetLinksJson,
  parseAndroidSha256Fingerprints,
} from "@/lib/play-store";

export const dynamic = "force-dynamic";

/**
 * Digital Asset Links для Trusted Web Activity (Google Play).
 * На проде задайте ANDROID_SHA256_FINGERPRINTS после `bubblewrap build`.
 */
export async function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() || ANDROID_PACKAGE_NAME;
  const fingerprints = parseAndroidSha256Fingerprints(process.env.ANDROID_SHA256_FINGERPRINTS);

  const body = buildAssetLinksJson(packageName, fingerprints);

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
