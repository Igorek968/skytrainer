/** Next 14 — sync params; Next 15 — Promise. Единый разбор для route handlers. */
export async function resolveRouteParams<T extends Record<string, string>>(
  params: T | Promise<T>,
): Promise<T> {
  return params instanceof Promise ? await params : params;
}
