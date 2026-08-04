"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
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
import { YM_GOALS, trackYandexGoal } from "@/shared/analytics/yandex-metrika-client";

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

const navLinkClass =
  "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:px-4";

const navLinkOutlineClass =
  "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:px-4";

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

  function handleSignOut() {
    signOutAndClearCache(queryClient, role);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
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
            <SiteLogo className="hidden sm:inline-flex" />
          </Link>
          <HeaderAccountHint />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Ссылки — с lg: на узких десктопах у инструктора «Выйти» раньше уезжал за край */}
          <nav className="hidden items-center gap-1 lg:flex lg:gap-2" aria-label="Основная навигация">
            {showAuthenticatedNav ? (
              isClientUser ? (
                <>
                  <Link href="/client/orders" className={navLinkClass}>
                    Мои заказы
                  </Link>
                  <Link href="/client/referral" className={navLinkClass}>
                    Пригласить друга
                  </Link>
                  <Button
                    type="button"
                    variant="accent"
                    onClick={() => openClientPersonalData(pathname, router)}
                  >
                    Личные данные
                  </Button>
                </>
              ) : (
                <>
                  {bookHref && bookLabel ? (
                    <Link href={bookHref} className={navLinkOutlineClass}>
                      {bookLabel}
                    </Link>
                  ) : null}
                  <Link href={dashboardHref} className={navLinkClass}>
                    {dashboardLabel}
                  </Link>
                  {profileHref && profileLabel ? (
                    <Link href={profileHref} className={navLinkClass}>
                      {profileLabel}
                    </Link>
                  ) : null}
                  <Link href={ordersHref} className={navLinkClass}>
                    {ordersLabel}
                  </Link>
                </>
              )
            ) : (
              <>
                <Link
                  href="/login?callbackUrl=%2Fclient"
                  className={navLinkClass}
                  onClick={() => trackYandexGoal(YM_GOALS.clientLoginOpen)}
                >
                  Войти
                </Link>
                <Link
                  href="/landings/instructor?utm_source=site&utm_medium=header&utm_campaign=hire"
                  className={navLinkOutlineClass}
                  onClick={() => trackYandexGoal(YM_GOALS.landingInstructorCta)}
                >
                  Инструктору
                </Link>
              </>
            )}
          </nav>

          <SupportLauncher className="hidden h-9 px-2 text-xs sm:inline-flex" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Переключить тему"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {showAuthenticatedNav ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              aria-label="Выйти"
              className="gap-1.5"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="lg:hidden"
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
        className={cn("border-t border-border lg:hidden", open ? "block" : "hidden")}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
          {showAuthenticatedNav ? (
            isClientUser ? (
              <>
                <Link
                  className="rounded-md px-3 py-2 hover:bg-muted"
                  href="/client/orders"
                  onClick={() => setOpen(false)}
                >
                  Мои заказы
                </Link>
                <Link
                  className="rounded-md px-3 py-2 hover:bg-muted"
                  href="/client/referral"
                  onClick={() => setOpen(false)}
                >
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
                  onClick={handleSignOut}
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
                <Link
                  className="rounded-md px-3 py-2 hover:bg-muted"
                  href={ordersHref}
                  onClick={() => setOpen(false)}
                >
                  {ordersLabel}
                </Link>
                <div className="px-3 py-1 sm:hidden">
                  <SupportLauncher className="w-full justify-center" />
                </div>
                <PwaInstallMenuItem onNavigate={() => setOpen(false)} />
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-left hover:bg-muted"
                  onClick={handleSignOut}
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
              <button
                type="button"
                className="rounded-md px-3 py-2 text-left hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  trackYandexGoal(YM_GOALS.clientLoginOpen);
                  window.location.assign("/login?callbackUrl=%2Fclient");
                }}
              >
                Войти
              </button>
              <button
                type="button"
                className="rounded-md px-3 py-2 text-left hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  trackYandexGoal(YM_GOALS.landingInstructorCta);
                  window.location.assign(
                    "/landings/instructor?utm_source=site&utm_medium=header&utm_campaign=hire",
                  );
                }}
              >
                Инструктору
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
