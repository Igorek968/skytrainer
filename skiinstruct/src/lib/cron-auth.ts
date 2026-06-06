/** Авторизация cron: в production только Authorization: Bearer. */
export function authorizeCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret === "replace-with-long-random-secret") return false;

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  if (process.env.NODE_ENV === "production") return false;

  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}
