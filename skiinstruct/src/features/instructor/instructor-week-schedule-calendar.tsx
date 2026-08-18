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
import {
  CALENDAR_CELL_CLASS,
  resolveCalendarCellVisual,
} from "@/shared/lib/instructor-calendar-cell";
import {
  normalizeAvailabilitySlots,
  validateAvailabilitySlots,
  type AvailabilitySlot,
} from "@/shared/lib/instructor-availability-slots";
import { CancelOrderButton } from "@/features/orders/cancel-order-button";
import { instructorAlertPollInterval } from "@/lib/query-poll";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/lib/utils";
import { orderStatusLabel } from "@/shared/lib/order-status";
import type { OrderStatus } from "@prisma/client";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export type { AvailabilitySlot };

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

/** day: 0=Вс … 6=Сб — порядок отображения: пн → вс */
const TEMPLATE_WEEK_DAYS: { day: number; label: string }[] = [
  { day: 1, label: "Понедельник" },
  { day: 2, label: "Вторник" },
  { day: 3, label: "Среда" },
  { day: 4, label: "Четверг" },
  { day: 5, label: "Пятница" },
  { day: 6, label: "Суббота" },
  { day: 0, label: "Воскресенье" },
];

type CalendarTab = "week" | "template";

type HourPick = { ymd: string; hour: number; orderIds: string[]; eventIds: string[] };

export function InstructorWeekScheduleCalendar({
  availabilitySlots,
  availabilityError,
  onAvailabilityChange,
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
  onAvailabilityChange?: (slots: AvailabilitySlot[]) => void;
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
  const [tab, setTab] = useState<CalendarTab>("week");
  const [hourPick, setHourPick] = useState<HourPick | null>(null);

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

  const saveAvailability = useMutation({
    mutationFn: async (slots: AvailabilitySlot[]) => {
      const normalized = normalizeAvailabilitySlots(slots);
      const err = validateAvailabilitySlots(normalized);
      if (err) throw new Error(err);
      const r = await fetch("/api/instructor/availability", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availabilitySlots: normalized }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Не удалось сохранить доступность");
      return normalized;
    },
    onSuccess: (normalized) => {
      toast.success("Доступность сохранена");
      onAvailabilityChange?.(normalized);
      void queryClient.invalidateQueries({ queryKey: ["instructor-me"] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  const eventsForSelectedDay = useMemo(() => {
    if (!schedule || !selectedDay) return [];
    const byEvent = new Map<string, (typeof schedule.events)[0]>();
    for (const e of schedule.events ?? []) {
      if (e.ymd !== selectedDay) continue;
      const key = `${e.eventId}:${e.fromHm}`;
      if (!byEvent.has(key)) byEvent.set(key, e);
    }
    return [...byEvent.values()].sort((a, b) => a.fromHm.localeCompare(b.fromHm));
  }, [schedule, selectedDay]);

  const lessonsForHourPick = useMemo(() => {
    if (!schedule || !hourPick?.orderIds.length) return [];
    const ids = new Set(hourPick.orderIds);
    const byOrder = new Map<string, (typeof schedule.lessons)[0]>();
    for (const l of schedule.lessons) {
      if (l.ymd !== hourPick.ymd || !ids.has(l.orderId)) continue;
      if (!byOrder.has(l.orderId)) byOrder.set(l.orderId, l);
    }
    return [...byOrder.values()].sort((a, b) => a.fromHm.localeCompare(b.fromHm));
  }, [schedule, hourPick]);

  const eventsForHourPick = useMemo(() => {
    if (!schedule || !hourPick?.eventIds.length) return [];
    const ids = new Set(hourPick.eventIds);
    const byEvent = new Map<string, (typeof schedule.events)[0]>();
    for (const e of schedule.events ?? []) {
      if (e.ymd !== hourPick.ymd || !ids.has(e.eventId)) continue;
      const key = `${e.eventId}:${e.fromHm}`;
      if (!byEvent.has(key)) byEvent.set(key, e);
    }
    return [...byEvent.values()].sort((a, b) => a.fromHm.localeCompare(b.fromHm));
  }, [schedule, hourPick]);

  const templateEditor = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Повторяющийся шаблон по дням недели. Отображается на сетке «Эта неделя».
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onFillWeekdays}>
            Будни 09:00–18:00
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClearSlots}>
            Очистить
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saveAvailability.isPending}
            onClick={() => saveAvailability.mutate(availabilitySlots)}
          >
            {saveAvailability.isPending ? "Сохранение…" : "Сохранить доступность"}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-7",
          availabilityError && "border-destructive",
        )}
      >
        {TEMPLATE_WEEK_DAYS.map(({ day, label: dayLabel }) => {
          const daySlots = availabilitySlots
            .map((slot, index) => ({ slot, index }))
            .filter(({ slot }) => slot.day === day);
          return (
            <div key={day} className="rounded-md border border-border bg-background/80 p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium">{dayLabel}</p>
                <Button type="button" size="sm" variant="ghost" onClick={() => onAddSlotForDay(day)}>
                  + Слот
                </Button>
              </div>
              <div className="space-y-2">
                {!daySlots.length ? (
                  <p className="text-xs text-muted-foreground">Нет интервалов</p>
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
      ) : null}
    </div>
  );

  return (
    <Card id="lesson-schedule" className="scroll-mt-24 border-sky-200/60 dark:border-sky-900">
      <CardHeader>
        <CardTitle>Расписание</CardTitle>
        <CardDescription>
          Одна сетка: шаблон доступности, уроки, события и перерыв 1 ч. Красная ячейка — урок,
          фиолетовая — событие.
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
                  disabled={toggleOnlinePending}
                  aria-pressed={effectiveOnline}
                >
                  {effectiveOnline ? "Онлайн" : "Офлайн"}
                </Button>
                {verificationStatus === "PENDING" ? (
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {effectiveOnline
                      ? "Вы на линии. В поиске у клиентов появитесь после одобрения анкеты администратором."
                      : "Включите «Онлайн» в любой момент. В поиске у клиентов — после одобрения анкеты."}
                  </p>
                ) : verificationStatus === "REJECTED" ? (
                  <p className="text-sm text-destructive">
                    {effectiveOnline
                      ? "Вы на линии, но анкета отклонена — в поиске не показываетесь, пока админ не одобрит исправления."
                      : "Анкета отклонена — исправьте профиль. «Онлайн» можно включить, в поиске появитесь после повторного одобрения."}
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

        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          <Button
            type="button"
            size="sm"
            variant={tab === "week" ? "default" : "outline"}
            onClick={() => setTab("week")}
          >
            Эта неделя
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "template" ? "default" : "outline"}
            onClick={() => setTab("template")}
          >
            Шаблон доступности
          </Button>
        </div>

        {tab === "template" ? (
          templateEditor
        ) : (
          <>
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
                    const today = localTodayYmd();
                    setAnchorWeek(today);
                    setSelectedDay(today);
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
                            const dayLessons = schedule.lessons.filter((l) => l.ymd === day.ymd);
                            const dayEvents = (schedule.events ?? []).filter((e) => e.ymd === day.ymd);
                            const visual = resolveCalendarCellVisual({
                              weekday: day.weekday,
                              hour,
                              scheduleCell: cell,
                              availabilitySlots,
                              lessonsOnDay: dayLessons,
                              eventsOnDay: dayEvents,
                            });
                            const clickable =
                              (visual.kind === "lesson" && visual.orderIds.length > 0) ||
                              (visual.kind === "event" && visual.eventIds.length > 0);
                            return (
                              <td
                                key={`${day.ymd}-${hour}`}
                                className={cn(
                                  "border-b border-border p-0 transition-colors",
                                  CALENDAR_CELL_CLASS[visual.kind],
                                  selectedDay === day.ymd &&
                                    visual.kind === "available" &&
                                    "ring-1 ring-inset ring-sky-400/60",
                                )}
                              >
                                {clickable ? (
                                  <button
                                    type="button"
                                    className="flex h-5 w-full min-h-[1.25rem] items-center justify-center sm:h-6"
                                    title={
                                      visual.kind === "event"
                                        ? `Событие ${String(hour).padStart(2, "0")}:00`
                                        : `Запись ${String(hour).padStart(2, "0")}:00`
                                    }
                                    onClick={() => {
                                      setHourPick({
                                        ymd: day.ymd,
                                        hour,
                                        orderIds: visual.orderIds,
                                        eventIds: visual.eventIds,
                                      });
                                      setSelectedDay(day.ymd);
                                    }}
                                  >
                                    <span className="sr-only">
                                      {visual.kind === "event"
                                        ? "Открыть событие"
                                        : "Открыть запись"}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="block h-5 min-h-[1.25rem] sm:h-6" aria-hidden />
                                )}
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
                    <span className="inline-block h-3 w-6 rounded bg-muted ring-1 ring-border" /> вне
                    шаблона
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-6 rounded bg-emerald-200 dark:bg-emerald-900/60" />{" "}
                    свободно
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-6 rounded bg-amber-400/80" /> перерыв 1 ч
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-6 rounded bg-red-500/90" /> урок (клик)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-6 rounded bg-violet-500/90" /> событие
                  </span>
                </div>

                {selectedDay ? (
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-sm font-medium">
                      Занятость на{" "}
                      {new Date(`${selectedDay}T12:00:00`).toLocaleDateString("ru-RU", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    {!lessonsForSelectedDay.length && !eventsForSelectedDay.length ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Нет занятий и событий в этот день
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {eventsForSelectedDay.map((e) => (
                          <li
                            key={`${e.eventId}-${e.fromHm}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded border border-violet-300/60 bg-violet-50/50 px-2 py-2 text-sm dark:border-violet-800 dark:bg-violet-950/30"
                          >
                            <div>
                              <span className="font-medium">
                                {e.fromHm} — {e.toHm}
                              </span>
                              <span className="ml-2 text-muted-foreground">{e.title}</span>
                              <span className="ml-2 text-xs text-violet-700 dark:text-violet-300">
                                Событие
                              </span>
                            </div>
                            <Button asChild variant="outline" size="sm">
                              <Link href="/instructor#events">К событиям</Link>
                            </Button>
                          </li>
                        ))}
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
                                  void queryClient.invalidateQueries({
                                    queryKey: ["instructor-week-schedule"],
                                  });
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
                    Выберите день в шапке таблицы или нажмите цветную ячейку с занятостью.
                  </p>
                )}
              </>
            ) : null}
          </>
        )}
      </CardContent>

      <Dialog open={hourPick != null} onOpenChange={(open) => !open && setHourPick(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          {hourPick && (lessonsForHourPick.length || eventsForHourPick.length) ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Занятость в календаре</h2>
                <p className="text-sm text-muted-foreground">
                  {new Date(`${hourPick.ymd}T12:00:00`).toLocaleDateString("ru-RU", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  , около {String(hourPick.hour).padStart(2, "0")}:00
                </p>
              </div>
              {eventsForHourPick.length ? (
                <ul className="space-y-3">
                  {eventsForHourPick.map((e) => (
                    <li
                      key={`${e.eventId}-${e.fromHm}`}
                      className="space-y-3 rounded-md border border-violet-300/60 bg-violet-50/40 p-3 dark:border-violet-800 dark:bg-violet-950/30"
                    >
                      <div>
                        <p className="font-medium">
                          {e.fromHm} — {e.toHm}
                        </p>
                        <p className="text-sm text-muted-foreground">{e.title}</p>
                        <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">
                          Событие · в это время нельзя вызвать на тренировку
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/instructor#events" onClick={() => setHourPick(null)}>
                          К событиям
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {lessonsForHourPick.length ? (
                <ul className="space-y-3">
                  {lessonsForHourPick.map((l) => (
                    <li
                      key={l.orderId}
                      className="space-y-3 rounded-md border border-border bg-muted/30 p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {l.fromHm} — {l.toHm}
                        </p>
                        <p className="text-sm text-muted-foreground">{l.clientName ?? "Клиент"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {orderStatusLabel(l.status as OrderStatus)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm">
                          <Link href={`/instructor/orders/${l.orderId}`}>Подробнее о заказе</Link>
                        </Button>
                        <CancelOrderButton
                          orderId={l.orderId}
                          onCancelled={() => {
                            setHourPick(null);
                            void queryClient.invalidateQueries({
                              queryKey: ["instructor-week-schedule"],
                            });
                            void queryClient.invalidateQueries({ queryKey: ["orders"] });
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : hourPick ? (
            <p className="text-sm text-muted-foreground">Нет данных о занятости</p>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
