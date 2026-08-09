"use client";

import { useEffect, useState } from "react";

import { brandTelegramChannelUrl, SUPPORT_TELEGRAM_HANDLE } from "@/lib/support-config";
import { cn } from "@/lib/utils";

type Props = {
  /** UTM-кампания для аналитики */
  campaign: string;
  /** Кому показываем: клиент / инструктор / общий */
  audience?: "client" | "instructor" | "public";
  className?: string;
  /** Можно скрыть крестиком (localStorage) */
  dismissible?: boolean;
  dismissKey?: string;
};

const COPY = {
  client: {
    title: "Спорт Сочи в Telegram",
    text: "Афиша, советы и кто на линии рядом — без спама, 2–3 поста в день.",
    cta: "Открыть канал",
  },
  instructor: {
    title: "Канал для инструкторов",
    text: "Афиша региона и анонсы площадки. Можно репостнуть сторис ученикам.",
    cta: "Подписаться",
  },
  public: {
    title: "Telegram ТвойТренер.рф",
    text: "Локальный спорт Сочи и подбор инструктора на карте.",
    cta: "Перейти в канал",
  },
} as const;

/**
 * Мягкий инвайт в публичный канал @tvoitrenerrf.
 * Не навязывает подписку: одна ссылка, без попапов и без автоподписки.
 */
export function TelegramChannelInvite({
  campaign,
  audience = "public",
  className,
  dismissible = false,
  dismissKey = "tg-channel-invite-dismissed",
}: Props) {
  const [hidden, setHidden] = useState(!dismissible ? false : true);
  const copy = COPY[audience];
  const href = brandTelegramChannelUrl({ campaign, content: audience });

  useEffect(() => {
    if (!dismissible) {
      setHidden(false);
      return;
    }
    try {
      setHidden(window.localStorage.getItem(dismissKey) === "1");
    } catch {
      setHidden(false);
    }
  }, [dismissible, dismissKey]);

  if (hidden) return null;

  return (
    <div
      className={cn(
        "relative rounded-lg border border-[#027676]/25 bg-[#027676]/5 px-3 py-2.5 text-left text-sm",
        className,
      )}
    >
      {dismissible ? (
        <button
          type="button"
          className="absolute right-2 top-1.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Скрыть"
          onClick={() => {
            try {
              window.localStorage.setItem(dismissKey, "1");
            } catch {
              /* ignore */
            }
            setHidden(true);
          }}
        >
          ✕
        </button>
      ) : null}
      <p className="pr-6 font-medium text-foreground">{copy.title}</p>
      <p className="mt-0.5 text-muted-foreground">{copy.text}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex text-sm font-semibold text-[#027676] underline-offset-2 hover:underline"
      >
        {copy.cta} → {SUPPORT_TELEGRAM_HANDLE}
      </a>
    </div>
  );
}
