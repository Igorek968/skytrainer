import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? "3000"),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://sky:sky@localhost:5432/skytrainer",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me-min-32-characters-long-xx",
  jwtExpires: process.env.JWT_EXPIRES ?? "7d",
  yooShopId: process.env.YOOKASSA_SHOP_ID ?? "",
  yooSecretKey: process.env.YOOKASSA_SECRET_KEY ?? "",
  publicApiUrl: process.env.PUBLIC_API_URL ?? "http://localhost:3000",
  appReturnUrl: process.env.APP_RETURN_URL ?? "skytrainer://payment-return",
  platformFeePercent: Number(process.env.PLATFORM_FEE_PERCENT ?? "15"),
  fcmServerKey: process.env.FCM_SERVER_KEY ?? ""
};
