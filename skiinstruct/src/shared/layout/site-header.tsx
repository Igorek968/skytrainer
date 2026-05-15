"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

import { HeaderAccountHint } from "@/shared/layout/header-account-hint";

export function SiteHeader() {
  const { data: session } = useSession();
  const isClientUser = session?.user.role === "CLIENT";
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const dashboardHref =
    session?.user.role === "INSTRUCTOR"
      ? "/instructor"
      : session?.user.role === "ADMIN"
        ? "/admin/activity"
        : "/client";

  const ordersHref =
    session?.user.role === "ADMIN" ? "/admin/orders" : `${dashboardHref}/orders`;
  const ordersLabel = session?.user.role === "ADMIN" ? "Заказы (админ)" : "Заказы";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-shrink">
          <Link href="/" className="block text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base">
            Инструктор <span className="text-accent">для тебя</span>
          </Link>
          <HeaderAccountHint />
        </div>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Основная навигация">
          {session ? (
            isClientUser ? (
              <>
                <Button variant="outline" onClick={() => void signOut({ callbackUrl: "/" })}>
                  Выйти
                </Button>
                <Link
                  href="/client?personal=1"
                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Личные данные
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => window.location.assign(dashboardHref)}
                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {session?.user.role === "ADMIN" ? "Админ-панель" : "Кабинет"}
                </button>
                <Link
                  href={ordersHref}
                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {ordersLabel}
                </Link>
                <Button variant="outline" onClick={() => void signOut({ callbackUrl: "/" })}>
                  Выйти
                </Button>
              </>
            )
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Войти
              </Link>
              <Link
                href="/instructor/login"
                className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Инструктору
              </Link>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Переключить тему"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Переключить тему"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Открыть меню"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        id="mobile-menu"
        className={cn("border-t border-border md:hidden", open ? "block" : "hidden")}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
          {session ? (
            isClientUser ? (
              <>
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-left hover:bg-muted"
                  onClick={() => void signOut({ callbackUrl: "/" })}
                >
                  Выйти
                </button>
                <Link
                  className="rounded-md px-3 py-2 hover:bg-muted"
                  href="/client?personal=1"
                  onClick={() => setOpen(false)}
                >
                  Личные данные
                </Link>
                <Link className="rounded-md px-3 py-2 hover:bg-muted" href="/client/orders" onClick={() => setOpen(false)}>
                  Мои заказы
                </Link>
              </>
            ) : (
              <>
                <Link
                  className="rounded-md px-3 py-2 hover:bg-muted"
                  href={dashboardHref}
                  onClick={() => {
                    setOpen(false);
                    window.location.assign(dashboardHref);
                  }}
                >
                  {session?.user.role === "ADMIN" ? "Админ-панель" : "Кабинет"}
                </Link>
                <Link className="rounded-md px-3 py-2 hover:bg-muted" href={ordersHref}>
                  {ordersLabel}
                </Link>
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-left hover:bg-muted"
                  onClick={() => void signOut({ callbackUrl: "/" })}
                >
                  Выйти
                </button>
              </>
            )
          ) : (
            <>
              <Link className="rounded-md px-3 py-2 hover:bg-muted" href="/login" onClick={() => setOpen(false)}>
                Войти
              </Link>
              <Link
                className="rounded-md px-3 py-2 hover:bg-muted"
                href="/instructor/login"
                onClick={() => setOpen(false)}
              >
                Инструктору
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
