import type { MetadataRoute } from "next";

import { absoluteUrl, siteOrigin } from "@/lib/seo";

/**
 * robots.txt для Яндекса/Google.
 * — только punycode в Host/Sitemap (кириллица в robots.txt запрещена Яндексом);
 * — один блок User-agent: * (без дублей по ботам — файл был ~7 KB / 300+ строк);
 * — Host без схемы (классический формат Яндекса).
 */
const PUBLIC_ALLOW = [
  "/",
  "/gorod/",
  "/sport/",
  "/instructors/",
  "/instructor/login",
  "/instructor/apply",
  "/vakansiya",
  "/landings/",
  "/gid/",
  "/faq",
  "/llms.txt",
  "/ai.txt",
];

const PUBLIC_DISALLOW = [
  "/admin/",
  "/api/",
  "/client/orders",
  "/client/profile",
  "/client/messages",
  "/client/favorites",
  "/client/registrations",
  "/client/referral",
  "/instructor/orders",
  "/instructor/registrations",
  "/instructor/profile",
  "/instructor/availability",
  "/instructor/pending",
  "/verify-email",
  "/app",
  "/login",
  "/register",
  "/reset-password",
];

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  let host = "xn--b1agaovdpdkd.xn--p1ai";
  try {
    host = new URL(origin).host;
  } catch {
    /* keep punycode fallback */
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: PUBLIC_ALLOW,
        disallow: PUBLIC_DISALLOW,
      },
      {
        userAgent: "Yandex",
        allow: PUBLIC_ALLOW,
        disallow: PUBLIC_DISALLOW,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host,
  };
}
