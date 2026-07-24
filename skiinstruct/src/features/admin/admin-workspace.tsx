"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Suspense } from "react";

import type { AdminOverview } from "@/features/admin/admin-overview-types";
import { AdminParticipantSheet } from "@/features/admin/admin-participant-sheet";
import { adminOverviewHref } from "@/features/admin/admin-search-params";
import { useAdminOverview } from "@/features/admin/use-admin-overview";
import { formatRussianPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

function adminRoleRu(role: string): string {
  switch (role) {
    case "ADMIN":
      return "Администратор";
    case "INSTRUCTOR":
      return "Инструктор";
    case "CLIENT":
      return "Клиент";
    default:
      return role;
  }
}

function formatAdminPhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  return formatRussianPhoneDisplay(phone);
}

type Props = {
  title: string;
  subtitle: string;
  children: (data: AdminOverview) => React.ReactNode;
};

function WorkspaceSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function AdminWorkspaceInner({ title, subtitle, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const focusQuery =
    params.get("user")?.trim() || params.get("email")?.trim() || null;
  const activityQueryParam = params.get("activity")?.trim() || null;
  const participantParam = params.get("participant")?.trim() || null;
  const { data, isLoading, error } = useAdminOverview({
    user: focusQuery,
    activity: activityQueryParam,
    participant: participantParam,
  });

  if (isLoading) {
    return <WorkspaceSkeleton />;
  }

  if (error || !data) {
    let msg = "Не удалось загрузить данные.";
    if (error instanceof Error && error.message === "forbidden") {
      msg = "Нет прав администратора. Выйдите и войдите через /admin/login.";
    } else if (
      error instanceof Error &&
      error.message &&
      !/^overview-\d+$/.test(error.message)
    ) {
      msg = error.message;
    } else if (error instanceof Error && /^overview-\d+$/.test(error.message)) {
      msg =
        "Сервер вернул ошибку при загрузке сводки. Откройте вкладку Network для запроса /api/admin/overview или логи контейнера skiinstruct.";
    }
    return <p className="max-w-xl whitespace-pre-wrap text-sm text-destructive">{msg}</p>;
  }

  const refreshedAt = formatInAppTimeZone(data.context.generatedAt, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const fo = data.focus;
  const searchQuery = fo.query ?? fo.email;
  const activitySearch = fo.activityQuery ?? null;
  const matches = fo.matches ?? [];

  const hasUserSearch = Boolean(searchQuery);
  const hasActivitySearch = Boolean(activitySearch);
  const showFocusBanner = hasUserSearch || hasActivitySearch;

  const sheetPad = participantParam ? "pb-[min(44vh,560px)]" : "";

  return (
    <div className={`space-y-8 ${sheetPad}`}>
      <header className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-medium text-foreground">
              {data.context.productName}
            </span>
            <span aria-hidden>·</span>
            <span>
              События и счётчики из базы приложения (единый источник данных для клиентов и инструкторов).
            </span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Сводка обновляется каждые ~15 с; последняя сборка ленты:{" "}
            <time dateTime={data.context.generatedAt}>{refreshedAt}</time>.
          </p>

          {showFocusBanner ? (
            <div
              role="status"
              className="mt-4 max-w-2xl space-y-2 rounded-lg border border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground"
            >
              {hasUserSearch ? (
                <div>
                  <span className="font-medium text-foreground">Пользователь (ФИО или email):</span>{" "}
                  <span className="text-foreground">«{searchQuery}»</span>
                </div>
              ) : null}
              {hasActivitySearch ? (
                <div>
                  <span className="font-medium text-foreground">Вид деятельности (специализации инструктора):</span>{" "}
                  <span className="text-foreground">«{activitySearch}»</span>
                </div>
              ) : null}

              {fo.activityFilterSkippedNoMatches ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-100">
                  По второму полю инструкторов не нашлось — показаны только совпадения по имени/email/профилю. Очистите
                  «вид деятельности», если нужен строгий фильтр только по пользователю без этого сообщения.
                </p>
              ) : null}

              {!fo.userFound ? (
                <p className="text-xs text-destructive">
                  {hasActivitySearch && !hasUserSearch
                    ? "Нет инструкторов, у которых в профиле совпали бы специализации, услуги, описание или сертификация с этим запросом. Лента ниже — общая по приложению."
                    : hasUserSearch && hasActivitySearch
                      ? "Нет пользователей, которые одновременно подходят под ФИО/email и под указанный вид деятельности. Ослабите один из фильтров."
                      : "Совпадений в таблице пользователей нет. Лента ниже — общая (последние события по приложению); сообщения по заказам ограничены только если попали в выборку — уточните запрос или проверьте среду (другой стенд / опечатка)."}
                </p>
              ) : (
                <>
                  <p className="text-xs">
                    Найдено пользователей:{" "}
                    <span className="font-medium text-foreground">{matches.length}</span>
                    {matches.length > 1 ? (
                      <span>
                        {" "}
                        — лента, заказы и чаты объединены по всем совпадениям. Чтобы сузить выборку, нажмите «Только
                        этот email» у нужной строки.
                      </span>
                    ) : null}
                  </p>

                  <p className="text-[11px] text-muted-foreground">
                    Двойной щелчок по строке — закрепить участника внизу экрана; содержимое панели совпадает с текущим
                    разделом (лента, показатели, финансы, заказы).
                  </p>

                  <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border bg-background/60 px-2 py-2 text-xs">
                    {matches.map((u) => (
                      <li
                        key={u.id}
                        title="Двойной щелчок — выбрать участника"
                        className={cn(
                          "flex cursor-pointer flex-wrap items-start justify-between gap-x-2 gap-y-1 border-b border-border/60 pb-2 transition-colors hover:bg-muted/30 last:border-b-0 last:pb-0",
                          participantParam === u.id && "rounded-md bg-accent/10 ring-1 ring-accent/35",
                        )}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          router.push(
                            adminOverviewHref(pathname, {
                              user: focusQuery ?? undefined,
                              activity: activityQueryParam ?? undefined,
                              participant: u.id,
                            }),
                          );
                        }}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">{u.name?.trim() || "ФИО не указано"}</div>
                          <div className="truncate text-muted-foreground">
                            {u.email}
                            {formatAdminPhone(u.phone) ? (
                              <>
                                <span aria-hidden> · </span>
                                <span>{formatAdminPhone(u.phone)}</span>
                              </>
                            ) : null}
                            {u.role === "INSTRUCTOR" ? (
                              <>
                                <span aria-hidden> · </span>
                                <span>инструктор</span>
                                <span aria-hidden> · </span>
                                <span>
                                  ИНН{" "}
                                  {u.instructorInn?.trim() ? u.instructorInn.trim() : "не указан"}
                                </span>
                              </>
                            ) : (
                              <>
                                <span aria-hidden> · </span>
                                <span>{adminRoleRu(u.role)}</span>
                              </>
                            )}
                          </div>
                          {u.instructorSpecializations?.length ? (
                            <div className="text-[11px] text-muted-foreground">
                              Специализации: {u.instructorSpecializations.join(", ")}
                            </div>
                          ) : null}
                        </div>
                        {matches.length > 1 ? (
                          <Button variant="outline" size="sm" className="h-7 shrink-0 px-2 text-[10px]" asChild>
                            <Link
                              href={adminOverviewHref(pathname, {
                                user: u.email,
                                activity: activityQueryParam,
                                participant: null,
                              })}
                            >
                              Только этот email
                            </Link>
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  <p className="text-xs">
                    Заказов в базе, где найденные пользователи указаны как клиент или инструктор:{" "}
                    <span className="font-medium text-foreground">{fo.ordersAsClientOrInstructor}</span>
                  </p>
                  {fo.ordersAsClientOrInstructor === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Заказов нет — возможна только регистрация или роль без заявок на этом стенде.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0 gap-2 self-start">
          <Link href="/">
            На сайт
            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
        </Button>
      </header>
      {children(data)}

      <AdminParticipantSheet
        data={data}
        participantId={participantParam}
        preserveSearch={{ user: focusQuery, activity: activityQueryParam }}
      />
    </div>
  );
}

export function AdminWorkspace(props: Props) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AdminWorkspaceInner {...props} />
    </Suspense>
  );
}
