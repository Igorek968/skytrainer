"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { InstructorWeekSchedule } from "@/shared/lib/instructor-schedule-types";
import {
  SCHEDULE_GRID_HOUR_END,
  SCHEDULE_GRID_HOUR_START,
} from "@/shared/lib/instructor-schedule-types";
import { CancelOrderButton } from "@/features/orders/cancel-order-button";
import { instructorAlertPollInterval } from "@/lib/query-poll";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/lib/utils";
import { orderStatusLabel } from "@/shared/lib/order-status";
import type { OrderStatus } from "@prisma/client";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

function localTodayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftWeekYmd(ymd: string, weeks: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const HOURS = Array.from(
  { length: SCHEDULE_GRID_HOUR_END - SCHEDULE_GRID_HOUR_START },
  (_, i) => SCHEDULE_GRID_HOUR_START + i,
);

const FULL_DAY_LABELS = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

export type AvailabilitySlot = { day: number; from: string; to: string; busy?: boolean };

export function InstructorWeekScheduleCalendar({
  availabilitySlots,
  availabilityError,
  onAddSlotForDay,
  onUpdateSlot,
  onRemoveSlot,
  onFillWeekdays,
  onClearSlots,
  effectiveOnline,
  toggleOnlinePending,
  onToggleOnline,
  verificationStatus,
  loadingOnlineState,
}: {
  availabilitySlots: AvailabilitySlot[];
  availabilityError?: string;
  onAddSlotForDay: (day: number) => void;
  onUpdateSlot: (index: number, patch: Partial<AvailabilitySlot>) => void;
  onRemoveSlot: (index: number) => void;
  onFillWeekdays: () => void;
  onClearSlots: () => void;
  effectiveOnline: boolean;
  toggleOnlinePending: boolean;
  onToggleOnline: () => void;
  verificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  loadingOnlineState?: boolean;
}) {
  const queryClient = useQueryClient();
  const [anchorWeek, setAnchorWeek] = useState(() => localTodayYmd());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const scheduleQuery = useQuery({
    queryKey: ["instructor-week-schedule", anchorWeek],
    queryFn: async () => {
      const r = await fetch(`/api/instructor/schedule?week=${encodeURIComponent(anchorWeek)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) throw new Error("schedule");
      const j = (await r.json()) as { schedule: InstructorWeekSchedule };
      return j.schedule;
    },
    refetchInterval: instructorAlertPollInterval(15_000),
    refetchOnWindowFocus: true,
  });

  const cancelDay = useMutation({
    mutationFn: async (lessonDate: string) => {
      const r = await fetch("/api/instructor/schedule/cancel-day", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonDate }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string; count?: number };
      if (!r.ok) throw new Error(j.error ?? "Не удалось отменить день");
      return j;
    },
    onSuccess: (j) => {
      toast.success(j.message ?? "День отменён");
      void queryClient.invalidateQueries({ queryKey: ["instructor-week-schedule"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const schedule = scheduleQuery.data;
  const weekLabel = schedule
    ? `${new Date(`${schedule.weekStartYmd}T12:00:00`).toLocaleDateString("ru-RU")} — ${new Date(`${schedule.weekEndYmd}T12:00:00`).toLocaleDateString("ru-RU")}`
    : "…";

  const lessonsForSelectedDay = useMemo(() => {
    if (!schedule || !selectedDay) return [];
    const byOrder = new Map<string, (typeof schedule.lessons)[0]>();
    for (const l of schedule.lessons) {
      if (l.ymd !== selectedDay) continue;
      if (!byOrder.has(l.orderId)) byOrder.set(l.orderId, l);
    }
    return [...byOrder.values()].sort((a, b) => a.fromHm.localeCompare(b.fromHm));
  }, [schedule, selectedDay]);

  return (
    <Card id="lesson-schedule" className="scroll-mt-24 border-sky-200/60 dark:border-sky-900">
      <CardHeader>
        <CardTitle>Календарь инструктора</CardTitle>
        <CardDescription>
          В одном блоке: расписание занятий и календарь доступности. Красные часы заняты (урок + 1 ч до и
          после), на них запись недоступна.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="mb-2 text-sm font-medium">Статус в поиске</p>
          <div className="flex flex-wrap items-center gap-3">
            {loadingOnlineState ? (
              <p className="text-sm text-muted-foreground">Загрузка…</p>
            ) : (
              <>
                <Button
                  type="button"
                  variant={effectiveOnline ? "default" : "outline"}
                  onClick={onToggleOnline}
                  disabled={toggleOnlinePending || (!effectiveOnline && verificationStatus !== "APPROVED")}
                  aria-pressed={effectiveOnline}
                >
                  {effectiveOnline ? "Онлайн" : "Офлайн"}
                </Button>
                {verificationStatus === "PENDING" ? (
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Анкета на проверке — «Онлайн» станет доступен после одобрения администратором.
                  </p>
                ) : verificationStatus === "REJECTED" ? (
                  <p className="text-sm text-destructive">
                    Анкета отклонена — исправьте профиль и дождитесь повторного одобрения.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {effectiveOnline
                      ? "Координаты обновляются, пока вы на линии."
                      : "Включите «Онлайн», чтобы показываться клиентам в поиске."}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Предыдущая неделя"
              onClick={() =>
                setAnchorWeek((w) => shiftWeekYmd(scheduleQuery.data?.weekStartYmd ?? w, -1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[10rem] text-center text-sm font-medium">{weekLabel}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Следующая неделя"
              onClick={() =>
                setAnchorWeek((w) => shiftWeekYmd(scheduleQuery.data?.weekStartYmd ?? w, 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAnchorWeek(localTodayYmd());
                setSelectedDay(localTodayYmd());
              }}
            >
              Сегодня
            </Button>
          </div>
          {selectedDay ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={cancelDay.isPending || !lessonsForSelectedDay.length}
              onClick={() => {
                if (
                  !window.confirm(
                    `Отменить все записи на ${new Date(`${selectedDay}T12:00:00`).toLocaleDateString("ru-RU")} с возвратом клиентам?`,
                  )
                ) {
                  return;
                }
                cancelDay.mutate(selectedDay);
              }}
            >
              Отменить весь день
            </Button>
          ) : null}
        </div>

        {scheduleQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка расписания…</p>
        ) : scheduleQuery.isError ? (
          <p className="text-sm text-destructive">Не удалось загрузить расписание</p>
        ) : schedule ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] border-collapse text-[10px] sm:text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border-b border-r border-border bg-muted/80 px-1 py-1.5 text-left font-medium">
                      Час
                    </th>
                    {schedule.days.map((day) => (
                      <th
                        key={day.ymd}
                        className={cn(
                          "border-b border-border px-0.5 py-1.5 text-center font-medium",
                          selectedDay === day.ymd && "bg-sky-100 dark:bg-sky-950/50",
                        )}
                      >
                        <button
                          type="button"
                          className="w-full rounded px-0.5 hover:bg-muted/60"
                          onClick={() => setSelectedDay(day.ymd)}
                        >
                          {day.label}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map((hour) => (
                    <tr key={hour}>
                      <td className="sticky left-0 z-10 border-r border-border bg-muted/40 px-1 py-0.5 font-mono text-muted-foreground">
                        {String(hour).padStart(2, "0")}:00
                      </td>
                      {schedule.days.map((day) => {
                        const cell = day.hours.find((h) => h.hour === hour);
                        const busy = cell?.busy ?? false;
                        return (
                          <td
                            key={`${day.ymd}-${hour}`}
                            title={
                              busy
                                ? `Занято${cell?.orderIds.length ? ` (${cell.orderIds.length})` : ""}`
                                : "Свободно"
                            }
                            className={cn(
                              "border-b border-border p-0",
                              busy
                                ? "bg-red-500/85 dark:bg-red-700/80"
                                : "bg-emerald-50/40 dark:bg-emerald-950/20",
                              selectedDay === day.ymd && !busy && "ring-1 ring-inset ring-sky-300/50",
                            )}
                          >
                            <span className="sr-only">{busy ? "занято" : "свободно"}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-6 rounded bg-red-500/85" /> занято
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-6 rounded bg-emerald-50 ring-1 ring-border dark:bg-emerald-950/30" />{" "}
                свободно
              </span>
              <span>Между уроками — перерыв 1 ч</span>
            </div>

            {selectedDay ? (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">
                  Записи на{" "}
                  {new Date(`${selectedDay}T12:00:00`).toLocaleDateString("ru-RU", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                {!lessonsForSelectedDay.length ? (
                  <p className="mt-2 text-sm text-muted-foreground">Нет занятий в этот день</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {lessonsForSelectedDay.map((l) => (
                      <li
                        key={l.orderId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-background px-2 py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium">
                            {l.fromHm} — {l.toHm}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            {l.clientName ?? "Клиент"}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {orderStatusLabel(l.status as OrderStatus)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/instructor/orders/${l.orderId}`}>Открыть</Link>
                          </Button>
                          <CancelOrderButton
                            orderId={l.orderId}
                            onCancelled={() => {
                              void queryClient.invalidateQueries({ queryKey: ["instructor-week-schedule"] });
                              void queryClient.invalidateQueries({ queryKey: ["orders"] });
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Нажмите на день недели, чтобы увидеть записи и отменить день или отдельный урок.
              </p>
            )}
          </>
        ) : null}

        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Календарь доступности (свободные интервалы)</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onFillWeekdays}>
                Будни 09:00-18:00
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onClearSlots}>
                Очистить
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "grid gap-2 rounded-md border border-border p-3 md:grid-cols-2 xl:grid-cols-7",
              availabilityError && "border-destructive",
            )}
          >
            {FULL_DAY_LABELS.map((dayLabel, day) => {
              const daySlots = availabilitySlots
                .map((slot, index) => ({ slot, index }))
                .filter(({ slot }) => slot.day === day);
              return (
                <div key={dayLabel} className="rounded-md border border-border bg-background/80 p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">{dayLabel}</p>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onAddSlotForDay(day)}>
                      + Слот
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {!daySlots.length ? (
                      <p className="text-xs text-muted-foreground">Нет свободных интервалов</p>
                    ) : (
                      daySlots.map(({ slot, index }) => (
                        <div key={`${day}-${index}`} className="rounded border border-border bg-background p-2">
                          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">С</Label>
                              <Input
                                type="time"
                                value={slot.from}
                                onChange={(e) => onUpdateSlot(index, { from: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">До</Label>
                              <Input
                                type="time"
                                value={slot.to}
                                onChange={(e) => onUpdateSlot(index, { to: e.target.value })}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => onRemoveSlot(index)}
                              aria-label="Удалить интервал"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {availabilityError ? (
            <p className="text-xs text-destructive">{availabilityError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Отмечайте свободные интервалы. Они работают вместе с занятостью из расписания занятий.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
