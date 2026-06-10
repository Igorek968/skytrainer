"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Home,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  Menu,
  Radio,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";

import {
  adminOverviewHref,
  adminSearchCanSubmit,
  appendAdminOverviewSearchParams,
} from "@/features/admin/admin-search-params";
import { cn } from "@/lib/utils";
import { getPublicProductName } from "@/shared/lib/product";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const nav = [
  { href: "/admin/activity", label: "Лента действий", icon: Radio },
  { href: "/admin/metrics", label: "Показатели", icon: LayoutDashboard },
  { href: "/admin/pipeline", label: "Воронка заказов", icon: LineChart },
  { href: "/admin/finance", label: "Финансы", icon: Wallet },
  { href: "/admin/orders", label: "Заказы", icon: ListOrdered },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/moderation", label: "Модерация", icon: ShieldCheck },
  { href: "/admin/compliance", label: "ЮKassa / договор", icon: FileText },
] as const;

function SidebarSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-16 animate-pulse rounded-lg bg-muted/60" />
      <div className="h-40 animate-pulse rounded-lg bg-muted/60" />
    </div>
  );
}

function AdminSidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const userFilter = params.get("user")?.trim() || params.get("email")?.trim() || "";
  const activityFilter = params.get("activity")?.trim() || "";
  const participantFilter = params.get("participant")?.trim() || "";

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(userFilter);
  const [activityDraft, setActivityDraft] = useState(activityFilter);
  const product = getPublicProductName();
  const canSubmit = adminSearchCanSubmit(draft, activityDraft);

  useEffect(() => {
    setDraft(userFilter);
    setActivityDraft(activityFilter);
  }, [userFilter, activityFilter]);

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    router.push(
      adminOverviewHref(pathname, {
        user: draft,
        activity: activityDraft,
        participant: participantFilter || null,
      }),
    );
  }

  function clearFilter() {
    setDraft("");
    setActivityDraft("");
    router.push(pathname);
  }

  const filterQs = (() => {
    const sp = new URLSearchParams();
    appendAdminOverviewSearchParams(sp, userFilter, activityFilter, participantFilter || null);
    const q = sp.toString();
    return q ? `?${q}` : "";
  })();

  return (
    <div className="space-y-3 lg:sticky lg:top-20">
      <div className="flex items-center justify-between lg:block">
        <div>
          <Link href="/" className="inline-block text-lg font-semibold tracking-tight text-foreground hover:opacity-90">
            Ski<span className="text-accent">Instruct</span>
          </Link>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {product} · админка
          </p>
          <h2 className="sr-only">Разделы администрирования</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-label={open ? "Закрыть меню" : "Меню разделов"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      <form onSubmit={applyFilter} className="space-y-2 rounded-lg border border-border bg-muted/15 p-2">
        <Label htmlFor="admin-user-search" className="text-[11px] font-medium text-muted-foreground">
          Пользователь
        </Label>
        <Input
          id="admin-user-search"
          type="search"
          enterKeyHint="search"
          placeholder="Фамилия, имя или email…"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-9 text-sm"
        />
        <Label htmlFor="admin-activity-search" className="text-[11px] font-medium text-muted-foreground">
          Вид деятельности (инструктор)
        </Label>
        <Input
          id="admin-activity-search"
          type="search"
          enterKeyHint="search"
          placeholder="Например: сноуборд, фрирайд, дети…"
          autoComplete="off"
          value={activityDraft}
          onChange={(e) => setActivityDraft(e.target.value)}
          className="h-9 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            className="h-8 flex-1 text-xs"
            disabled={!canSubmit}
          >
            Найти в базе
          </Button>
          {userFilter || activityFilter ? (
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={clearFilter}>
              Сбросить
            </Button>
          ) : null}
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          Хотя бы одно поле: пользователь — от 2 символов (ФИО, часть email, текст из профиля инструктора); вид
          деятельности — слово от 2 букв. Если заданы оба и по второму никого нет, показываем результат только по
          пользователю и помечаем это в сводке.
        </p>
      </form>

      <nav
        className={cn(
          "flex flex-col gap-0.5 rounded-lg border border-border bg-muted/20 p-1",
          open ? "flex" : "hidden lg:flex",
        )}
        aria-label="Разделы админки SkiInstruct"
      >
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={`${href}${filterQs}`}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0 opacity-80" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <p className="hidden text-xs text-muted-foreground lg:block">
        Все разделы ниже используют ту же сводку по базе {product}: счётчики, заказы, пользователи и чаты; строка поиска
        сохраняется при переходе между вкладками.
      </p>

      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:mt-0"
      >
        <Home className="h-4 w-4" aria-hidden />
        На главную приложения
      </Link>
    </div>
  );
}

export function AdminPanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col gap-0 lg:flex-row lg:gap-8">
      <aside className="w-full max-w-md lg:w-56 lg:max-w-none lg:flex-shrink-0">
        <Suspense fallback={<SidebarSkeleton />}>
          <AdminSidebarNav />
        </Suspense>
      </aside>

      <div className="min-w-0 flex-1 pb-10">{children}</div>
    </div>
  );
}
