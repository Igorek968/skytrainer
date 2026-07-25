"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  adminAlertCategoryLabel,
  type AdminAlertDTO,
  type AdminAlertQueueCounts,
} from "@/features/admin/admin-alerts-types";
import { fireSiteAlert } from "@/lib/site-alert";
import { cn } from "@/lib/utils";
import { formatInAppTimeZone } from "@/shared/lib/app-timezone";
import { Button } from "@/shared/ui/button";

type AlertsResponse = {
  counts: AdminAlertQueueCounts;
  items: AdminAlertDTO[];
  generatedAt: string;
};

async function fetchAlerts(): Promise<AlertsResponse> {
  const r = await fetch("/api/admin/alerts", { credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error("alerts");
  return r.json() as Promise<AlertsResponse>;
}

export function useAdminAlertCounts() {
  return useQuery({
    queryKey: ["admin-alerts"],
    queryFn: fetchAlerts,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function AdminAlertsBell() {
  const qc = useQueryClient();
  const { data } = useAdminAlertCounts();
  const [open, setOpen] = useState(false);
  const prevUnread = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const unread = data?.counts.unreadAlerts ?? 0;
  const items = data?.items ?? [];

  useEffect(() => {
    if (prevUnread.current == null) {
      prevUnread.current = unread;
      return;
    }
    if (unread > prevUnread.current) {
      const newest = items.find((i) => !i.readAt);
      const href = newest?.href ?? "/admin";
      void fireSiteAlert({
        title: newest?.title ?? "Новое оповещение админа",
        body: newest?.body ?? "Откройте колокольчик в админке",
        url: href,
        sound: "reminder",
        skipNotification: true,
        toastAction: {
          label: "Открыть",
          onClick: () => {
            window.location.href = href;
          },
        },
      });
    }
    prevUnread.current = unread;
  }, [unread, items]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const markRead = useMutation({
    mutationFn: async (ids?: string[]) => {
      const r = await fetch("/api/admin/alerts", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : {}),
      });
      if (!r.ok) throw new Error("mark");
      return r.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-alerts"] });
    },
  });

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative h-9 w-9"
        aria-label={unread ? `Оповещения, непрочитанных ${unread}` : "Оповещения"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <p className="text-sm font-medium">Оповещения</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={!unread || markRead.isPending}
              onClick={() => markRead.mutate(undefined)}
            >
              Прочитать все
            </Button>
          </div>
          <ul className="max-h-[min(60vh,24rem)] overflow-y-auto">
            {!items.length ? (
              <li className="px-3 py-4 text-sm text-muted-foreground">Пока нет оповещений</li>
            ) : (
              items.map((item) => (
                <li key={item.id} className={cn(!item.readAt && "bg-muted/40")}>
                  <Link
                    href={item.href}
                    className="block px-3 py-2.5 text-left hover:bg-muted/60"
                    onClick={() => {
                      setOpen(false);
                      if (!item.readAt) markRead.mutate([item.id]);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {adminAlertCategoryLabel(item.category)}
                      </span>
                      {!item.readAt ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden />
                      ) : null}
                      <time className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                        {formatInAppTimeZone(item.createdAt, {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <p className="mt-1 text-sm font-medium leading-snug">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AdminNavBadge({ count }: { count: number }) {
  if (!count || count < 1) return null;
  return (
    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive/90 px-1.5 text-[10px] font-semibold text-destructive-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}
