"use client";

import { MessageCircle } from "lucide-react";

import { useSupportLauncher } from "@/features/support/support-provider";
import { YM_GOALS, trackYandexGoal } from "@/shared/analytics/yandex-metrika-client";
import { cn } from "@/lib/utils";

/**
 * Плавающая кнопка: веб-чат поддержки ↔ MAX.
 * Сообщения уходят оператору в MAX; ответ — Reply на сообщение бота → снова в чат на сайте.
 */
export function MessengerWidgets({ className }: { className?: string }) {
  const { openSupport } = useSupportLauncher();

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-[6000] flex flex-col items-end gap-2 sm:right-4",
        className,
      )}
      aria-label="Быстрая связь"
    >
      <button
        type="button"
        className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#2E3E55] text-white shadow-lg hover:opacity-95"
        aria-label="Связаться через мессенджер"
        aria-haspopup="dialog"
        onClick={() => {
          trackYandexGoal(YM_GOALS.supportOpen);
          openSupport();
        }}
      >
        <MessageCircle className="h-6 w-6" aria-hidden />
      </button>
    </div>
  );
}
