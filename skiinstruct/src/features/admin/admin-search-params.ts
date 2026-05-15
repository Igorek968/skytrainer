/** Общие правила query-параметров админской сводки (?user=, ?activity=). */

export function adminOverviewHref(
  pathname: string,
  opts: { user?: string | null; activity?: string | null; participant?: string | null },
) {
  const sp = new URLSearchParams();
  appendAdminOverviewSearchParams(sp, opts.user ?? "", opts.activity ?? "", opts.participant);
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
