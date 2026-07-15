import { absoluteUrl, landingSitemapPages, PUBLIC_SITEMAP_PAGES, siteOrigin } from "@/lib/seo";

/** Публичный ключ IndexNow (файл `public/{key}.txt` должен совпадать). */
export const INDEXNOW_DEFAULT_KEY = "4ca507ae0d53f067978dd6277e88a6d3";

const INDEXNOW_ENDPOINT = "https://yandex.com/indexnow";

export function getIndexNowKey(): string {
  return process.env.INDEXNOW_KEY?.trim() || INDEXNOW_DEFAULT_KEY;
}

export function indexNowKeyLocation(): string {
  const key = getIndexNowKey();
  return absoluteUrl(`/${key}.txt`);
}

/** Публичные URL для уведомления поисковиков (без кабинетов и API). */
export function indexNowPublicUrls(): string[] {
  const paths = [
    ...PUBLIC_SITEMAP_PAGES.map((p) => p.path),
    ...landingSitemapPages().map((p) => p.path),
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.svg",
    "/favicon-120.png",
  ];
  return [...new Set(paths.map((path) => absoluteUrl(path)))];
}

export type IndexNowResult = {
  ok: boolean;
  status: number;
  submitted: number;
  host: string;
  body: string;
};

/** Отправка списка URL в IndexNow (Яндекс / Bing и др.). */
export async function submitIndexNow(urls: string[]): Promise<IndexNowResult> {
  const key = getIndexNowKey();
  const origin = siteOrigin();
  const host = new URL(origin).host;
  const unique = [...new Set(urls)].filter((u) => {
    try {
      return new URL(u).host === host;
    } catch {
      return false;
    }
  });

  if (unique.length === 0) {
    return { ok: false, status: 0, submitted: 0, host, body: "empty urlList" };
  }

  // IndexNow принимает до 10_000 URL за запрос; режем на чанки по 100.
  const chunkSize = 100;
  let lastStatus = 0;
  let lastBody = "";
  let submitted = 0;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const urlList = unique.slice(i, i + chunkSize);
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: indexNowKeyLocation(),
        urlList,
      }),
    });
    lastStatus = res.status;
    lastBody = await res.text();
    // 200 / 202 — принято; 422 — часть URL отклонена, но запрос обработан.
    if (res.status === 200 || res.status === 202 || res.status === 422) {
      submitted += urlList.length;
    } else {
      return { ok: false, status: lastStatus, submitted, host, body: lastBody };
    }
  }

  return {
    ok: lastStatus === 200 || lastStatus === 202 || lastStatus === 422,
    status: lastStatus,
    submitted,
    host,
    body: lastBody,
  };
}
