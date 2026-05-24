"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { adminOverviewHref } from "@/features/admin/admin-search-params";
import { useAdminUsersList } from "@/features/admin/use-admin-users-list";
import {
  ADMIN_USER_ROLE_LABELS,
  parseAdminOnlineFilter,
  parseAdminUserRoleFilter,
  type AdminUserRoleFilter,
} from "@/lib/admin-list-filters";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";

function roleLabel(role: string): string {
  return ADMIN_USER_ROLE_LABELS[role as AdminUserRoleFilter] ?? role;
}

function FilterChip({
  active,
  href,
  label,
  count,
}: {
  active: boolean;
  href: string;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      {count != null ? <span className={cn("text-xs", active ? "opacity-90" : "opacity-70")}>{count}</span> : null}
    </Link>
  );
}

export function AdminUsersSection() {
  const pathname = usePathname();
  const params = useSearchParams();
  const focusUser = params.get("user")?.trim() || params.get("email")?.trim() || null;
  const focusActivity = params.get("activity")?.trim() || null;
  const focusParticipant = params.get("participant")?.trim() || null;

  const role = parseAdminUserRoleFilter(params.get("role"));
  const onlineOnly = parseAdminOnlineFilter(params.get("online"));

  const { data, isLoading, error } = useAdminUsersList(role, onlineOnly);

  const href = (opts: { role?: AdminUserRoleFilter; online?: boolean }) => {
    const nextOnline = opts.online ?? onlineOnly;
    const nextRole = nextOnline ? "INSTRUCTOR" : (opts.role ?? role);
    return adminOverviewHref(pathname, {
      user: focusUser,
      activity: focusActivity,
      participant: focusParticipant,
      role: nextRole === "all" ? null : nextRole,
      online: nextOnline ? "1" : null,
    });
  };

  const counts = data?.counts;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Фильтр пользователей</CardTitle>
          <CardDescription>Роль в системе и статус «на линии» у инструкторов.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <FilterChip
            active={role === "all" && !onlineOnly}
            href={href({ role: "all", online: false })}
            label="Все"
            count={counts?.all}
          />
          <FilterChip
            active={role === "CLIENT" && !onlineOnly}
            href={href({ role: "CLIENT", online: false })}
            label="Клиенты"
            count={counts?.CLIENT}
          />
          <FilterChip
            active={role === "INSTRUCTOR" && !onlineOnly}
            href={href({ role: "INSTRUCTOR", online: false })}
            label="Инструкторы"
            count={counts?.INSTRUCTOR}
          />
          <FilterChip
            active={role === "ADMIN" && !onlineOnly}
            href={href({ role: "ADMIN", online: false })}
            label="Администраторы"
            count={counts?.ADMIN}
          />
          <FilterChip
            active={onlineOnly}
            href={href({ role: "INSTRUCTOR", online: true })}
            label="Инструкторы онлайн"
            count={counts?.online}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Список пользователей</CardTitle>
          <CardDescription>
            {data ? `Показано ${data.total} (до 300 последних по активности)` : "Загрузка…"}
            {onlineOnly ? " · только инструкторы на линии" : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">Не удалось загрузить список пользователей.</p>
          ) : !data?.users.length ? (
            <p className="text-sm text-muted-foreground">Нет пользователей в этой выборке.</p>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Имя</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Роль</th>
                  <th className="py-2 pr-3 font-medium">Статус</th>
                  <th className="py-2 font-medium">Действие</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="border-b border-border/80">
                    <td className="py-2 pr-3 font-medium">{u.name?.trim() || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{u.email}</td>
                    <td className="py-2 pr-3">{roleLabel(u.role)}</td>
                    <td className="py-2 pr-3">
                      {u.role === "INSTRUCTOR" ? (
                        <div className="flex flex-wrap gap-1">
                          {u.isOnline ? (
                            <Badge variant="default" className="text-[10px]">
                              Онлайн
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Офлайн
                            </Badge>
                          )}
                          {u.verificationStatus === "PENDING" ? (
                            <Badge variant="secondary" className="text-[10px]">
                              На модерации
                            </Badge>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                        <Link
                          href={adminOverviewHref("/admin/activity", {
                            user: u.email,
                            activity: focusActivity,
                            participant: u.id,
                          })}
                        >
                          Открыть в ленте
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
