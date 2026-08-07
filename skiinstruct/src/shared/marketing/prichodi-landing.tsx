import Image from "next/image";
import Link from "next/link";
import { Manrope, Unbounded } from "next/font/google";
import type { CSSProperties } from "react";

import { BRAND_LOGO_OFFICIAL_PNG, BRAND_WORDMARK } from "@/shared/brand/assets";
import { TrackedHireCta } from "@/shared/marketing/tracked-hire-cta";

const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-prichodi-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-prichodi-body",
  display: "swap",
});

const HERO_SRC = "/brand/avito-vacancy/hero-prichodi.png";

const REASONS = [
  {
    title: "Свои клиенты",
    text: "Заявки с карты по городу и виду спорта — без холодных чатов и «напишите в ЛС».",
  },
  {
    title: "Свободный график",
    text: "Вы сами решаете, когда выходить «на линию» и принимать занятия.",
  },
  {
    title: "Прозрачная оплата",
    text: "Ставка ваша, оплата онлайн через ЮKassa, без предоплат «в чат».",
  },
] as const;

/** Визуальная посадочная «Приходи к нам» для набора инструкторов. */
export function PrichodiLanding() {
  return (
    <div
      className={`${display.variable} ${body.variable} -mx-3 -mt-4 w-[100vw] max-w-[100vw] relative left-1/2 -translate-x-1/2 sm:-mx-4 sm:-mt-6`}
      style={
        {
          ["--prichodi-teal" as string]: "#027676",
          ["--prichodi-ink" as string]: "#1e293b",
        } as CSSProperties
      }
    >
      <style>{`
        @keyframes prichodi-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes prichodi-ken {
          from { transform: scale(1.06); }
          to { transform: scale(1); }
        }
        @keyframes prichodi-glow {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.75; }
        }
        .prichodi-hero-copy > * {
          animation: prichodi-fade-up 0.85s ease-out both;
        }
        .prichodi-hero-copy > *:nth-child(1) { animation-delay: 0.05s; }
        .prichodi-hero-copy > *:nth-child(2) { animation-delay: 0.18s; }
        .prichodi-hero-copy > *:nth-child(3) { animation-delay: 0.3s; }
        .prichodi-hero-copy > *:nth-child(4) { animation-delay: 0.42s; }
        .prichodi-hero-media {
          animation: prichodi-ken 8s ease-out both;
        }
        .prichodi-sun {
          animation: prichodi-glow 5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .prichodi-hero-copy > *,
          .prichodi-hero-media,
          .prichodi-sun { animation: none !important; }
        }
      `}</style>

      <section className="relative isolate min-h-[min(92dvh,920px)] overflow-hidden bg-[var(--prichodi-ink)] text-white">
        <div className="prichodi-hero-media absolute inset-0">
          <Image
            src={HERO_SRC}
            alt="Инструктор ТвойТренер проводит персональную тренировку на улице"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[62%_center] sm:object-center"
          />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-r from-[var(--prichodi-ink)]/92 via-[var(--prichodi-ink)]/55 to-[var(--prichodi-ink)]/20"
          aria-hidden
        />
        <div
          className="prichodi-sun pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full bg-[var(--prichodi-teal)]/35 blur-3xl"
          aria-hidden
        />

        <div className="prichodi-hero-copy relative z-10 mx-auto flex min-h-[min(92dvh,920px)] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 sm:justify-center sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
          <div className="inline-flex items-center rounded-md bg-white/95 px-2.5 py-1.5 shadow-sm">
            <Image
              src={BRAND_LOGO_OFFICIAL_PNG}
              alt="Твой Тренер"
              width={220}
              height={68}
              className="h-10 w-auto sm:h-11"
              priority
            />
          </div>

          <h1
            className="mt-6 max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
            style={{ fontFamily: "var(--font-prichodi-display), system-ui" }}
          >
            Приходи к нам
          </h1>

          <p
            className="mt-4 max-w-md text-base leading-relaxed text-white/85 sm:text-lg"
            style={{ fontFamily: "var(--font-prichodi-body), system-ui" }}
          >
            Спортивное комьюнити инструкторов, тренеров и гидов: заявки рядом, свой график и честный
            заработок на ТвойТренер.рф.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TrackedHireCta
              href="/instructor/apply?utm_source=landing&utm_campaign=prichodi"
              label="Стать инструктором"
              className="rounded-md bg-[var(--prichodi-teal)] px-6 py-3.5 text-sm font-semibold text-white hover:brightness-110"
            />
            <Link
              href="/landings/instructor?utm_source=landing&utm_campaign=prichodi"
              className="inline-flex items-center justify-center px-2 py-2 text-sm font-medium text-white/85 underline-offset-4 hover:text-white hover:underline"
              style={{ fontFamily: "var(--font-prichodi-body), system-ui" }}
            >
              Как это работает
            </Link>
          </div>
        </div>
      </section>

      <section
        className="bg-[#f3f7f6] px-4 py-14 sm:px-6 sm:py-16 lg:px-8"
        style={{ fontFamily: "var(--font-prichodi-body), system-ui" }}
      >
        <div className="mx-auto max-w-6xl">
          <h2
            className="max-w-2xl text-2xl font-semibold tracking-tight text-[var(--prichodi-ink)] sm:text-3xl"
            style={{ fontFamily: "var(--font-prichodi-display), system-ui" }}
          >
            Здесь вас ждут ученики, а не пустые чаты
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--prichodi-ink)]/70">
            {BRAND_WORDMARK}.рф — маркетплейс персональных тренировок. Вы ведёте занятие, платформа
            помогает с заявками и оплатой.
          </p>

          <ul className="mt-10 grid gap-8 sm:grid-cols-3">
            {REASONS.map((item) => (
              <li key={item.title} className="space-y-2">
                <p
                  className="text-lg font-semibold text-[var(--prichodi-teal)]"
                  style={{ fontFamily: "var(--font-prichodi-display), system-ui" }}
                >
                  {item.title}
                </p>
                <p className="text-sm leading-relaxed text-[var(--prichodi-ink)]/75">{item.text}</p>
              </li>
            ))}
          </ul>

          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TrackedHireCta
              href="/instructor/apply?utm_source=landing&utm_campaign=prichodi"
              label="Прийти в команду"
              className="rounded-md bg-[var(--prichodi-ink)] px-6 py-3.5 text-sm font-semibold text-white hover:opacity-90"
            />
            <p className="text-sm text-[var(--prichodi-ink)]/60">
              Самозанятый или ИП · модерация анкеты · выход «на линию»
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
