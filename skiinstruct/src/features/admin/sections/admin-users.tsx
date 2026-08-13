"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AdminDeleteUserButton } from "@/features/admin/admin-delete-user-button";
import { AdminInstructorModerationSheet } from "@/features/admin/admin-instructor-moderation-sheet";
import {
  AdminSendMessageModal,
  type AdminMessageTarget,
} from "@/features/admin/admin-send-message-modal";
import { AdminUserEditSheet } from "@/features/admin/admin-user-edit-sheet";
import { adminOverviewHref } from "@/features/admin/admin-search-params";
import { useAdminUsersList } from "@/features/admin/use-admin-users-list";
import {
  ADMIN_USER_ROLE_LABELS,
  parseAdminOnlineFilter,
  parseAdminUserRoleFilter,
  type AdminUserRoleFilter,
} from "@/lib/admin-list-filters";
import { formatRussianPhoneDisplay } from "@/lib/phone";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";

function roleLabel(role: string): string {
  return ADMIN_USER_ROLE_LABELS[role as AdminUserRoleFilter] ?? role;
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  return formatRussianPhoneDisplay(phone);
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
  const [messageTarget, setMessageTarget] = useState<AdminMessageTarget | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [dossierUserId, setDossierUserId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");

  const role = parseAdminUserRoleFilter(params.get("role"));
  const onlineOnly = parseAdminOnlineFilter(params.get("online"));

  const { data, isLoading, error } = useAdminUsersList(role, onlineOnly, searchQ);

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
      {messageTarget ? (
        <AdminSendMessageModal target={messageTarget} onClose={() => setMessageTarget(null)} />
      ) : null}
      {editUserId ? (
        <AdminUserEditSheet userId={editUserId} onClose={() => setEditUserId(null)} />
      ) : null}
      {dossierUserId ? (
        <AdminInstructorModerationSheet
          userId={dossierUserId}
          onClose={() => setDossierUserId(null)}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Фильтр пользователей</CardTitle>
          <CardDescription>Роль в системе и статус «на линии» у инструкторов.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
        <Input
          placeholder="Поиск: email, имя, телефон, id…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
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
            active={role === "MODERATOR" && !onlineOnly}
            href={href({ role: "MODERATOR", online: false })}
            label="Модераторы"
            count={counts?.MODERATOR}
          />
          <FilterChip
            active={onlineOnly}
            href={href({ role: "INSTRUCTOR", online: true })}
            label="Инструкторы онлайн"
            count={counts?.online}
          />
        </div>
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
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Имя</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Телефон</th>
                  <th className="py-2 pr-3 font-medium">Роль</th>
                  <th className="py-2 pr-3 font-medium">Статус</th>
                  <th className="py-2 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="border-b border-border/80">
                    <td className="py-2 pr-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {u.role === "INSTRUCTOR" && u.verifiedOk ? (
                          <span
                            className="text-base leading-none text-emerald-600 dark:text-emerald-400"
                            title="Проверка анкеты пройдена"
                            aria-label="Проверен"
                          >
                            ★
                          </span>
                        ) : null}
                        {u.name?.trim() || "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{u.email}</td>
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">{formatPhone(u.phone)}</td>
                    <td className="py-2 pr-3">{roleLabel(u.role)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {u.suspendedAt ? (
                          <Badge variant="outline" className="border-destructive text-[10px] text-destructive">
                            Блок
                          </Badge>
                        ) : null}
                        {u.role === "INSTRUCTOR" ? (
                          <>
                            {u.isOnline ? (
                              <Badge variant="default" className="text-[10px]">
                                Онлайн
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                Офлайн
                              </Badge>
                            )}
                            {u.verifiedOk ? (
                              <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">
                                Проверен
                              </Badge>
                            ) : u.anketaComplete === false ? (
                              <Badge className="bg-amber-500 text-[10px] text-white hover:bg-amber-500">
                                Неполная анкета
                              </Badge>
                            ) : u.verificationStatus === "PENDING" ? (
                              <Badge variant="secondary" className="text-[10px]">
                                На модерации
                              </Badge>
                            ) : u.verificationStatus === "REJECTED" ? (
                              <Badge variant="outline" className="border-destructive text-[10px] text-destructive">
                                Отклонён
                              </Badge>
                            ) : null}
                          </>
                        ) : !u.suspendedAt ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            if (u.role === "INSTRUCTOR") setDossierUserId(u.id);
                            else setEditUserId(u.id);
                          }}
                        >
                          Профиль
                        </Button>
                        {u.role === "INSTRUCTOR" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setEditUserId(u.id)}
                          >
                            Правки
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            setMessageTarget({
                              id: u.id,
                              email: u.email,
                              name: u.name,
                              role: u.role,
                            })
                          }
                        >
                          Написать
                        </Button>
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
                        <AdminDeleteUserButton
                          userId={u.id}
                          email={u.email}
                          name={u.name}
                          role={u.role}
                        />
                      </div>
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
