/** Общие правила query-параметров админской сводки (?user=, ?activity=). */

export type AdminPageHrefOpts = {
  user?: string | null;
  activity?: string | null;
  participant?: string | null;
  /** Фильтр заказов: all | in_progress | pending | completed */
  group?: string | null;
  /** Конкретный OrderStatus (перекрывает group) */
  status?: string | null;
  /** Фильтр пользователей: all | CLIENT | INSTRUCTOR | ADMIN */
  role?: string | null;
  /** Только инструкторы онлайн: 1 */
  online?: string | null;
};

export function adminOverviewHref(pathname: string, opts: AdminPageHrefOpts = {}) {
  const sp = new URLSearchParams();
  appendAdminOverviewSearchParams(sp, opts.user ?? "", opts.activity ?? "", opts.participant);
  const group = opts.group?.trim();
  if (group && group !== "all") sp.set("group", group);
  if (opts.status?.trim()) sp.set("status", opts.status.trim());
  if (opts.role?.trim()) sp.set("role", opts.role.trim());
  if (opts.online?.trim()) sp.set("online", opts.online.trim());
  const q = sp.toString();
  return q ? `${pathname}?${q}` : pathname;
}

/** Одна строка поиска: обрезка и одиночные пробелы между словами. */
export function normalizeAdminSearchInput(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function appendAdminOverviewSearchParams(
  sp: URLSearchParams,
  userDraft: string,
  activityDraft: string,
  participantId?: string | null,
) {
  const u = normalizeAdminSearchInput(userDraft);
  const act = normalizeAdminSearchInput(activityDraft);
  const pid = participantId?.trim() ?? "";
  if (u.length >= 2) sp.set("user", u);
  if (act.split(/\s+/).some((t) => t.length >= 2)) sp.set("activity", act);
  if (pid.length > 0) sp.set("participant", pid);
}

export function adminSearchCanSubmit(userDraft: string, activityDraft: string): boolean {
  const u = normalizeAdminSearchInput(userDraft);
  const act = normalizeAdminSearchInput(activityDraft);
  return u.length >= 2 || act.split(/\s+/).some((t) => t.length >= 2);
}
