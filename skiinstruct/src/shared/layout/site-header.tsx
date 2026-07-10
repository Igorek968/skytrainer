"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession, signOut } from "next-auth/react";
import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { inferRoleFromProtectedPath, resolveAppNav, resolveBrandingHref } from "@/lib/app-nav";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

import { signOutCallbackForRole } from "@/lib/auth-routes";
import { markOpenPersonalDataOnNextClientVisit } from "@/lib/client-personal-data-storage";
import { PwaInstallMenuItem } from "@/features/share/pwa-install-hint";
import { SupportLauncher } from "@/features/support/support-launcher";
import { SiteLogo } from "@/shared/brand/site-logo";
import { HeaderAccountHint } from "@/shared/layout/header-account-hint";

function signOutAndClearCache(
  queryClient: ReturnType<typeof useQueryClient>,
  role: string | undefined,
) {
  void queryClient.removeQueries({ queryKey: ["me-profile"] });
  void signOut({
    callbackUrl: signOutCallbackForRole(
      role === "INSTRUCTOR" || role === "ADMIN" || role === "CLIENT" ? role : undefined,
    ),
  });
}

function openClientPersonalData(pathname: string, router: ReturnType<typeof useRouter>) {
  const onClientHome = pathname === "/client" || pathname === "/";
  if (onClientHome && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("skiinstruct:open-personal"));
    return;
  }
  markOpenPersonalDataOnNextClientVisit();
  router.push("/client");
}

export function SiteHeader() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const pathRole = inferRoleFromProtectedPath(pathname);
  const role = session?.user?.role ?? pathRole;
  const isClientUser = role === "CLIENT";
  const showAuthenticatedNav =
    Boolean(session?.user) || (status === "loading" && pathRole != null);
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const nav = resolveAppNav(pathname, role);
  const {
    dashboardHref,
    dashboardLabel,
    ordersHref,
    ordersLabel,
    profileHref,
    profileLabel,
    bookHref,
    bookLabel,
  } = nav;
  const brandingHref = resolveBrandingHref(pathname, role);
  const onInstructorCabinet = pathname?.startsWith("/instructor");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-shrink">
          <Link
            href={brandingHref}
            className="block hover:opacity-90"
            title={
              onInstructorCabinet || role === "INSTRUCTOR" || role === "ADMIN"
                ? "Поиск инструктора и заказ занятия как клиент"
                : "На главную — поиск инструктора"
            }
          >
            <SiteLogo className="sm:hidden" compact />
            <SiteLogo className="hidden sm:block" />
          </Link>
          <HeaderAccountHint />
        </div>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Основная навигация">
          {showAuthenticatedNav ? (
            isClientUser ? (
              <>
                <Link
                  href="/client/orders"
                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Мои заказы
                </Link>
                <Link
                  href="/client/referral"
                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Пригласить друга
                </Link>
                <Button
                  type="button"
                  variant="accent"
                  onClick={() => openClientPersonalData(pathname, router)}
                >
                  Личные данные
                </Button>
                <Button
                  variant="outline"
                  onClick={() => signOutAndClearCache(queryClient, role)}
                >
                  Выйти
                </Button>
              </>
            ) : (
              <>
                {bookHref && bookLabel ? (
                  <Link
                    href={bookHref}
                    className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {bookLabel}
                  </Link>
                ) : null}
                <Link
                  href={dashboardHref}
                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {dashboardLabel}
                </Link>
                {profileHref && profileLabel ? (
                  <Link
                    href={profileHref}
                    className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {profileLabel}
                  </Link>
                ) : null}
                <Link
                  href={ordersHref}
                  className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {ordersLabel}
                </Link>
                <Button
                  variant="outline"
                  onClick={() => signOutAndClearCache(queryClient, role)}
                >
                  Выйти
                </Button>
              </>
            )
          ) : (
            <>
              <Link
                href="/login?callbackUrl=%2Fclient"
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
          <SupportLauncher />
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
          <SupportLauncher className="h-9 px-2 text-xs" />
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
          {showAuthenticatedNav ? (
            isClientUser ? (
              <>
                <Link className="rounded-md px-3 py-2 hover:bg-muted" href="/client/orders" onClick={() => setOpen(false)}>
                  Мои заказы
                </Link>
                <Link className="rounded-md px-3 py-2 hover:bg-muted" href="/client/referral" onClick={() => setOpen(false)}>
                  Пригласить друга
                </Link>
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-left hover:bg-muted"
                  onClick={() => {
                    openClientPersonalData(pathname, router);
                    setOpen(false);
                  }}
                >
                  Личные данные
                </button>
                <PwaInstallMenuItem onNavigate={() => setOpen(false)} />
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-left hover:bg-muted"
                  onClick={() => signOutAndClearCache(queryClient, role)}
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                {bookHref && bookLabel ? (
                  <Link
                    className="rounded-md px-3 py-2 hover:bg-muted"
                    href={bookHref}
                    onClick={() => setOpen(false)}
                  >
                    {bookLabel}
                  </Link>
                ) : null}
                <Link
                  className="rounded-md px-3 py-2 hover:bg-muted"
                  href={dashboardHref}
                  onClick={() => setOpen(false)}
                >
                  {dashboardLabel}
                </Link>
                {profileHref && profileLabel ? (
                  <Link
                    className="rounded-md px-3 py-2 hover:bg-muted"
                    href={profileHref}
                    onClick={() => setOpen(false)}
                  >
                    {profileLabel}
                  </Link>
                ) : null}
                <Link className="rounded-md px-3 py-2 hover:bg-muted" href={ordersHref} onClick={() => setOpen(false)}>
                  {ordersLabel}
                </Link>
                <PwaInstallMenuItem onNavigate={() => setOpen(false)} />
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-left hover:bg-muted"
                  onClick={() => signOutAndClearCache(queryClient, session?.user?.role)}
                >
                  Выйти
                </button>
              </>
            )
          ) : (
            <>
              <div className="px-3 py-1">
                <SupportLauncher className="w-full justify-center" />
              </div>
              <PwaInstallMenuItem onNavigate={() => setOpen(false)} />
              <Link
                className="rounded-md px-3 py-2 hover:bg-muted"
                href="/login?callbackUrl=%2Fclient"
                onClick={() => setOpen(false)}
              >
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
