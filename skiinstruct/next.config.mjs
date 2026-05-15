/** @type {import('next').NextConfig} */

/**
 * Server Actions проверяют Origin. При входе с другого хоста (например http://192.168.x.x:3001)
 * формы логина могут «молча» не отправляться без этого списка.
 */
function serverActionsAllowedOrigins() {
  const origins = new Set(["localhost:3001", "127.0.0.1:3001", "localhost:3000", "127.0.0.1:3000"]);
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

const nextConfig = {
  env: {
    NEXTAUTH_URL: resolvedNextAuthUrlForClient(),
  },
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: serverActionsAllowedOrigins(),
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
