/** @type {import('next').NextConfig} */

/**
 * Server Actions проверяют Origin. При входе с другого хоста (например http://192.168.x.x:3001)
 * формы логина могут «молча» не отправляться без этого списка.
 */
function serverActionsAllowedOrigins() {
  const origins = new Set([
    "localhost:3001",
    "127.0.0.1:3001",
    "localhost:3000",
    "127.0.0.1:3000",
    "твойтренер.рф",
    "www.твойтренер.рф",
    "xn--b1agaovdpdkd.xn--p1ai",
    "www.xn--b1agaovdpdkd.xn--p1ai",
  ]);
  const extra = process.env.NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS ?? "";
  for (const part of extra.split(",").map((s) => s.trim()).filter(Boolean)) {
    origins.add(part);
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).host);
    } catch {
      /* ignore */
    }
  }
  return [...origins];
}

/**
 * Клиентский `next-auth/react` подставляет baseUrl из `process.env.NEXTAUTH_URL` при сборке.
 * Если в .env только `AUTH_URL`, в браузере NEXTAUTH_URL пустой → запросы к Auth идут не туда → error=Configuration.
 */
function resolvedNextAuthUrlForClient() {
  return (
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    ""
  );
}

/** Только публичный ключ карт — серверный YANDEX_GEOCODER_API_KEY в бандл не попадает. */
function resolvedYandexMapsApiKeyForClient() {
  return (
    process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim() ||
    process.env.VITE_YANDEX_MAPS_API_KEY?.trim() ||
    ""
  );
}

function resolvedVapidPublicKeyForClient() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "";
}

function configuredSiteUsesHttps() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (!raw) return false;
  try {
    return new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}

const isProd = process.env.NODE_ENV === "production";
const siteUsesHttps = configuredSiteUsesHttps();

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api-maps.yandex.ru https://yastatic.net https://mc.yandex.ru https://www.googletagmanager.com https://challenges.cloudflare.com https://smartcaptcha.cloud.yandex.ru https://smartcaptcha.yandexcloud.net",
  "style-src 'self' 'unsafe-inline' https://yastatic.net",
  isProd ? "img-src 'self' data: blob: https:" : "img-src 'self' data: blob: https: http:",
  "font-src 'self' data: https://yastatic.net",
  "connect-src 'self' https://api-maps.yandex.ru https://geocode-maps.yandex.ru https://*.yandex.ru https://mc.yandex.ru https://www.google-analytics.com https://region1.google-analytics.com https://challenges.cloudflare.com https://smartcaptcha.cloud.yandex.ru https://smartcaptcha.yandexcloud.net wss:",
  "frame-src 'self' https://yoomoney.ru https://*.yookassa.ru https://challenges.cloudflare.com https://smartcaptcha.cloud.yandex.ru https://smartcaptcha.yandexcloud.net",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];
if (isProd && siteUsesHttps) {
  cspDirectives.push("upgrade-insecure-requests");
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  },
];

if (isProd && siteUsesHttps) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  });
}

function resolvedSmartCaptchaClientKey() {
  return process.env.NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY?.trim() || "";
}

const nextConfig = {
  env: {
    NEXTAUTH_URL: resolvedNextAuthUrlForClient(),
    NEXT_PUBLIC_YANDEX_MAPS_API_KEY: resolvedYandexMapsApiKeyForClient(),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: resolvedVapidPublicKeyForClient(),
    NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY: resolvedSmartCaptchaClientKey(),
  },
  async redirects() {
    return [
      { source: "/sochi", destination: "/gorod/sochi", permanent: true },
      { source: "/sochi/:sport", destination: "/gorod/sochi/:sport", permanent: true },
      { source: "/moscow", destination: "/gorod/moskva", permanent: true },
      { source: "/moscow/:sport", destination: "/gorod/moskva/:sport", permanent: true },
      { source: "/moskva", destination: "/gorod/moskva", permanent: true },
      { source: "/moskva/:sport", destination: "/gorod/moskva/:sport", permanent: true },
    ];
  },
  /** До filesystem: старые паспорт/НПД в public/uploads не отдаём. */
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/uploads/compliance/:path*", destination: "/api/security/blocked" },
        { source: "/uploads/npd-receipts/:path*", destination: "/api/security/blocked" },
      ],
    };
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    instrumentationHook: true,
    serverActions: {
      allowedOrigins: serverActionsAllowedOrigins(),
      // Анкета инструктора: паспорт + НПД/ЕГРИП до 8 МБ каждый + поля формы
      bodySizeLimit: "20mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
    ],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
