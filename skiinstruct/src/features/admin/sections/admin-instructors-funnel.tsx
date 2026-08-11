"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Clock, RefreshCw, Star } from "lucide-react";

import { AdminInstructorModerationSheet } from "@/features/admin/admin-instructor-moderation-sheet";
import type { InstructorFunnelCard } from "@/app/api/admin/instructors/funnel/route";
import { useAdminInstructorsFunnel } from "@/features/admin/use-admin-instructors-funnel";
import type { InstructorCrmStage } from "@/lib/instructor-crm-funnel";
import { formatRussianPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

const WORK_STAGES: InstructorCrmStage[] = [
  "moderation",
  "docs_incomplete",
  "docs_review",
  "ready_offline",
  "active_online",
];

function phoneLabel(phone: string | null): string {
  if (!phone?.trim()) return "тел. не указан";
  return formatRussianPhoneDisplay(phone);
}

function FunnelCardRow({
  card,
  onOpen,
}: {
  card: InstructorFunnelCard;
  onOpen: (userId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(card.userId)}
      className={cn(
        "w-full rounded-md border px-2.5 py-2 text-left transition-colors",
        card.overdue
          ? "border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/15"
          : "border-border bg-background hover:border-accent hover:bg-accent/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {card.name?.trim() || "Без имени"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{card.email}</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
            card.overdue
              ? "bg-amber-600/20 text-amber-900 dark:text-amber-200"
              : "bg-muted text-muted-foreground",
          )}
          title={card.stageEnteredAt}
        >
          {card.overdue ? <AlertTriangle className="h-3 w-3" aria-hidden /> : <Clock className="h-3 w-3" aria-hidden />}
          {card.waitingLabel}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{card.nextAction}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {!card.anketaComplete ? (
          <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-800 dark:text-amber-300">
            неполная анкета
          </span>
        ) : null}
        {card.payoutPending ? (
          <span className="rounded bg-sky-500/15 px-1 py-0.5 text-[10px] text-sky-800 dark:text-sky-300">
            выплата
          </span>
        ) : null}
        {card.yookassaNeedsOps ? (
          <span className="rounded bg-violet-500/15 px-1 py-0.5 text-[10px] text-violet-800 dark:text-violet-300">
            ЮKassa
          </span>
        ) : null}
        {card.isOnline ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">
            <Star className="h-2.5 w-2.5" aria-hidden />
            онлайн
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{phoneLabel(card.phone)}</p>
    </button>
  );
}

function StageColumn({
  title,
  slaHours,
  count,
  overdueCount,
  cards,
  onOpen,
}: {
  title: string;
  slaHours: number | null;
  count: number;
  overdueCount: number;
  cards: InstructorFunnelCard[];
  onOpen: (userId: string) => void;
}) {
  return (
    <div className="flex min-w-[220px] max-w-[280px] flex-1 flex-col rounded-lg border border-border bg-muted/20">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <span className="tabular-nums text-sm font-semibold text-foreground">{count}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {slaHours != null ? `SLA ≤ ${slaHours} ч` : "без таймера"}
          {overdueCount > 0 ? (
            <span className="ml-1 font-medium text-amber-700 dark:text-amber-300">
              · просрочено {overdueCount}
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex max-h-[min(70vh,640px)] flex-col gap-2 overflow-y-auto p-2">
        {cards.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">Пусто</p>
        ) : (
          cards.map((c) => <FunnelCardRow key={c.userId} card={c} onOpen={onOpen} />)
        )}
      </div>
    </div>
  );
}

export function AdminInstructorsFunnelSection() {
  const { data, isLoading, error, refetch, isFetching } = useAdminInstructorsFunnel();
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const workStages = useMemo(() => {
    if (!data) return [];
    return data.stages.filter((s) => WORK_STAGES.includes(s.id));
  }, [data]);

  const archiveStages = useMemo(() => {
    if (!data) return [];
    return data.stages.filter((s) => s.id === "rejected" || s.id === "suspended");
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    const msg =
      error instanceof Error && error.message === "forbidden"
        ? "Нет прав администратора."
        : error instanceof Error
          ? error.message
          : "Не удалось загрузить воронку.";
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Воронка инструкторов</CardTitle>
          <CardDescription>{msg}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  const t = data.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Единая CRM-доска найма: стадия, ожидание, SLA и следующее действие. Клик по карточке — досье
            договора.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Link href="/admin/moderation" className="text-accent underline-offset-2 hover:underline">
              Модерация
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/admin/compliance" className="text-accent underline-offset-2 hover:underline">
              Документы / ЮKassa
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/admin/finance" className="text-accent underline-offset-2 hover:underline">
              Выплаты
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/admin/users?role=INSTRUCTOR" className="text-accent underline-offset-2 hover:underline">
              Все инструкторы
            </Link>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} aria-hidden />
          Обновить
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          { label: "Всего", value: t.instructors },
          { label: "Просрочка SLA", value: t.overdue, warn: t.overdue > 0 },
          { label: "Модерация", value: t.moderation },
          { label: "Неполные доки", value: t.docsIncomplete },
          { label: "На проверке", value: t.docsReview },
          { label: "Готов / онлайн", value: t.readyOffline + t.activeOnline },
          { label: "Выплаты", value: t.payoutPending },
        ].map((s) => (
          <div
            key={s.label}
            className={cn(
              "rounded-lg border px-3 py-2",
              s.warn ? "border-amber-500/50 bg-amber-500/10" : "border-border bg-muted/20",
            )}
          >
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
            <div className="text-xl font-semibold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {workStages.map((stage) => (
          <StageColumn
            key={stage.id}
            title={stage.shortLabel}
            slaHours={stage.slaHours}
            count={stage.count}
            overdueCount={stage.overdueCount}
            cards={stage.cards}
            onOpen={setOpenUserId}
          />
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/10 p-3">
        <button
          type="button"
          className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
          onClick={() => setShowArchive((v) => !v)}
        >
          {showArchive ? "Скрыть архив" : "Показать архив"} (отклонённые / заблокированные)
        </button>
        {showArchive ? (
          <div className="mt-3 flex gap-3 overflow-x-auto">
            {archiveStages.map((stage) => (
              <StageColumn
                key={stage.id}
                title={stage.shortLabel}
                slaHours={stage.slaHours}
                count={stage.count}
                overdueCount={stage.overdueCount}
                cards={stage.cards}
                onOpen={setOpenUserId}
              />
            ))}
          </div>
        ) : null}
      </div>

      {openUserId ? (
        <AdminInstructorModerationSheet
          userId={openUserId}
          onClose={() => {
            setOpenUserId(null);
            void refetch();
          }}
          onRejected={() => {
            setOpenUserId(null);
            void refetch();
          }}
        />
      ) : null}
    </div>
  );
}
