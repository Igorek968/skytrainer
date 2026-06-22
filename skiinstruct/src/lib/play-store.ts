/** Идентификатор Android-пакета для TWA / Google Play (Bubblewrap). */
export const ANDROID_PACKAGE_NAME = "ru.utrainer.app";

/** Продакшен-хост по умолчанию (без схемы). */
export const ANDROID_TWA_HOST = "utrainer.ru";

export function parseAndroidSha256Fingerprints(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildAssetLinksJson(packageName: string, fingerprints: string[]): string {
  if (!fingerprints.length) {
    return "[]";
  }
  return JSON.stringify(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    null,
    2,
  );
}
