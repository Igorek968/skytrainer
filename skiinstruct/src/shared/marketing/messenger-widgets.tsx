"use client";

import { MessageCircle } from "lucide-react";

import { supportTelegramUrl, supportWhatsAppUrl } from "@/lib/support-config";
import { YM_GOALS, trackYandexGoal } from "@/shared/analytics/yandex-metrika-client";
import { cn } from "@/lib/utils";

/** Плавающие кнопки WhatsApp / Telegram для быстрой связи с рекламного трафика. */
export function MessengerWidgets({ className }: { className?: string }) {
  const tg = supportTelegramUrl();
  const wa = supportWhatsAppUrl();
  if (!tg && !wa) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-[6000] flex flex-col items-end gap-2 sm:right-4",
        className,
      )}
      aria-label="Быстрая связь"
    >
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:opacity-95"
          aria-label="Написать в WhatsApp"
          onClick={() => trackYandexGoal(YM_GOALS.messengerWhatsapp)}
        >
          <span className="text-lg font-bold" aria-hidden>
            WA
          </span>
        </a>
      ) : null}
      {tg ? (
        <a
          href={tg}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#2AABEE] text-white shadow-lg hover:opacity-95"
          aria-label="Написать в Telegram"
          onClick={() => trackYandexGoal(YM_GOALS.messengerTelegram)}
        >
          <MessageCircle className="h-6 w-6" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
