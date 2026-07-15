import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

/** Публичные боты поиска и ИИ — разрешены; кабинеты и API закрыты. */
const PUBLIC_ALLOW = [
  "/",
  "/gorod/",
  "/sport/",
  "/instructors/",
  "/instructor/login",
  "/instructor/apply",
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
  "/verify-email",
  "/login",
  "/register",
  "/reset-password",
];

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "ClaudeBot",
  "Anthropic-AI",
  "PerplexityBot",
  "Bytespider",
  "CCBot",
  "YandexBot",
  "YandexImages",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: PUBLIC_ALLOW,
        disallow: PUBLIC_DISALLOW,
      },
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: PUBLIC_ALLOW,
        disallow: PUBLIC_DISALLOW,
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}
