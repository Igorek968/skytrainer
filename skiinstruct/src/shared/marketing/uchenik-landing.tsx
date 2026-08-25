"use client";

import Image from "next/image";
import Link from "next/link";
import { Manrope, Unbounded } from "next/font/google";
import { Suspense, type CSSProperties } from "react";

import { YM_GOALS, trackYandexGoal } from "@/shared/analytics/yandex-metrika-client";
import { BRAND_LOGO_OFFICIAL_PNG, BRAND_NAVY, BRAND_TEAL, BRAND_WORDMARK } from "@/shared/brand/assets";
import { useReferralAwareHref } from "@/shared/marketing/use-referral-aware-href";
import { cn } from "@/lib/utils";

const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-uchenik-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-uchenik-body",
  display: "swap",
});

const HERO_SRC = "/brand/hero-uchenik-run.png?v=2";

const REASONS = [
  {
    title: "На карте",
    text: "Инструктор рядом: вид спорта, ставка и свободные слоты — без «напишите в ЛС».",
  },
  {
    title: "Проверенные анкеты",
    text: "На платформе живые тренеры после модерации, с отзывами и понятной ставкой.",
  },
  {
    title: "Оплата ЮKassa",
    text: "Бронируете занятие и платите онлайн. Без предоплат в чат и переводов «на карту».",
  },
] as const;

const UTM = { utm_source: "landing", utm_campaign: "uchenik" } as const;

function TrackedClientCta({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-6 py-3.5 text-sm font-semibold text-white",
        className,
      )}
      onClick={() => trackYandexGoal(YM_GOALS.landingUchenikCta)}
    >
      {label}
    </Link>
  );
}

function UchenikCtas() {
  const mapHref = useReferralAwareHref("/client", { ...UTM, utm_medium: "hero_map" });
  const loginHref = useReferralAwareHref("/login", { ...UTM, utm_medium: "hero_login" });

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
      <TrackedClientCta
        href={mapHref}
        label="Найти инструктора"
        className="bg-[var(--uchenik-teal)] hover:brightness-110"
      />
      <Link
        href={loginHref}
        className="inline-flex items-center justify-center px-2 py-2 text-sm font-medium text-white/85 underline-offset-4 hover:text-white hover:underline"
        style={{ fontFamily: "var(--font-uchenik-body), system-ui" }}
        onClick={() => trackYandexGoal(YM_GOALS.clientLoginOpen)}
      >
        Уже есть аккаунт — войти
      </Link>
    </div>
  );
}

function UchenikBottomCta() {
  const registerHref = useReferralAwareHref("/register", { ...UTM, utm_medium: "bottom_register" });
  return (
    <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
      <TrackedClientCta
        href={registerHref}
        label="Зарегистрироваться"
        className="bg-[var(--uchenik-ink)] hover:opacity-90"
      />
      <p className="text-sm text-[var(--uchenik-ink)]/60">
        Карта инструкторов · запись онлайн · оплата ЮKassa
      </p>
    </div>
  );
}

/** Визуальная посадочная для учеников по клиентской реферальной ссылке (без chrome сайта). */
export function UchenikLanding() {
  return (
    <div
      className={`${display.variable} ${body.variable} w-full`}
      style={
        {
          ["--uchenik-teal" as string]: BRAND_TEAL,
          ["--uchenik-ink" as string]: BRAND_NAVY,
        } as CSSProperties
      }
    >
      <style>{`
        @keyframes uchenik-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes uchenik-ken {
          from { transform: scale(1.06); }
          to { transform: scale(1); }
        }
        @keyframes uchenik-glow {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.75; }
        }
        .uchenik-hero-copy > * {
          animation: uchenik-fade-up 0.85s ease-out both;
        }
        .uchenik-hero-copy > *:nth-child(1) { animation-delay: 0.05s; }
        .uchenik-hero-copy > *:nth-child(2) { animation-delay: 0.12s; }
        .uchenik-hero-copy > *:nth-child(3) { animation-delay: 0.22s; }
        .uchenik-hero-copy > *:nth-child(4) { animation-delay: 0.34s; }
        .uchenik-hero-copy > *:nth-child(5) { animation-delay: 0.44s; }
        .uchenik-hero-media {
          animation: uchenik-ken 8s ease-out both;
        }
        .uchenik-sun {
          animation: uchenik-glow 5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .uchenik-hero-copy > *,
          .uchenik-hero-media,
          .uchenik-sun { animation: none !important; }
        }
      `}</style>

      <section className="relative isolate min-h-[min(100dvh,920px)] overflow-hidden bg-[var(--uchenik-ink)] text-white">
        <div className="uchenik-hero-media absolute inset-0">
          <Image
            src={HERO_SRC}
            alt="Бег с инструктором ТвойТренер"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_35%] sm:object-[center_40%]"
          />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-r from-[var(--uchenik-ink)]/70 via-[var(--uchenik-ink)]/30 to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[var(--uchenik-ink)]/45 via-transparent to-[var(--uchenik-ink)]/20"
          aria-hidden
        />
        <div
          className="uchenik-sun pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full bg-[var(--uchenik-teal)]/25 blur-3xl"
          aria-hidden
        />

        <div className="relative z-10 mx-auto flex min-h-[min(100dvh,920px)] max-w-6xl flex-col px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
          <div className="inline-flex w-fit items-center rounded-md bg-white px-2 py-1.5 shadow-sm">
            <Image
              src={BRAND_LOGO_OFFICIAL_PNG}
              alt="Твой Тренер"
              width={220}
              height={68}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </div>

          <div className="uchenik-hero-copy flex flex-1 flex-col justify-end pb-14 pt-10 sm:justify-center sm:pb-20">
            <p
              className="inline-flex w-fit rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/90"
              style={{ fontFamily: "var(--font-uchenik-body), system-ui" }}
            >
              Друг пригласил вас
            </p>

            <h1
              className="mt-4 max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
              style={{ fontFamily: "var(--font-uchenik-display), system-ui" }}
            >
              Твой тренер рядом
            </h1>

            <p
              className="mt-4 max-w-md text-base leading-relaxed text-white/85 sm:text-lg"
              style={{ fontFamily: "var(--font-uchenik-body), system-ui" }}
            >
              Найдите инструктора на карте, запишитесь и оплатите онлайн. Без чатов вслепую.
            </p>

            <Suspense fallback={null}>
              <UchenikCtas />
            </Suspense>
          </div>
        </div>
      </section>

      <section
        className="bg-[#f3f7f6] px-4 py-14 sm:px-6 sm:py-16 lg:px-8"
        style={{ fontFamily: "var(--font-uchenik-body), system-ui" }}
      >
        <div className="mx-auto max-w-6xl">
          <h2
            className="max-w-2xl text-2xl font-semibold tracking-tight text-[var(--uchenik-ink)] sm:text-3xl"
            style={{ fontFamily: "var(--font-uchenik-display), system-ui" }}
          >
            Как это работает
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--uchenik-ink)]/70">
            {BRAND_WORDMARK}.рф — маркетплейс персональных тренировок. Выбираете живого инструктора,
            бронируете слот и платите через ЮKassa.
          </p>

          <ul className="mt-10 grid gap-8 sm:grid-cols-3">
            {REASONS.map((item) => (
              <li key={item.title} className="space-y-2">
                <p
                  className="text-lg font-semibold text-[var(--uchenik-teal)]"
                  style={{ fontFamily: "var(--font-uchenik-display), system-ui" }}
                >
                  {item.title}
                </p>
                <p className="text-sm leading-relaxed text-[var(--uchenik-ink)]/75">{item.text}</p>
              </li>
            ))}
          </ul>

          <Suspense fallback={null}>
            <UchenikBottomCta />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
