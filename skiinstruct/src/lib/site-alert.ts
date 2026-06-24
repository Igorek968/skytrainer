"use client";

import { toast } from "sonner";

import {
  playInstructorChatMessageBeep,
  unlockInstructorChatMessageBeep,
} from "@/features/instructor/instructor-chat-message-beep";
import { playInstructorOrderBeep, unlockInstructorOrderBeep } from "@/features/instructor/instructor-order-beep";
import { getPublicProductName } from "@/shared/lib/product";

export type SiteAlertSound = "order" | "chat" | "reminder";

const VIBRATE_PATTERN = [120, 60, 120, 60, 140] as const;

export type FireSiteAlertOptions = {
  title: string;
  body: string;
  sound?: SiteAlertSound;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
  toastDuration?: number;
  toastAction?: { label: string; onClick: () => void };
  /** Не воспроизводить звук (например, если уже идёт повторяющийся сигнал). */
  skipSound?: boolean;
  skipToast?: boolean;
  skipNotification?: boolean;
  skipVibrate?: boolean;
};

/** Разблокировать звук после первого клика/клавиши (требование браузера). */
export function unlockSiteAlertSound(): void {
  unlockInstructorOrderBeep();
  unlockInstructorChatMessageBeep();
}

/** Вибрация на телефоне и поддерживаемых устройствах. */
export function vibrateSiteAlert(): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate([...VIBRATE_PATTERN]);
  } catch {
    /* ignore */
  }
}

function playSiteAlertSound(sound: SiteAlertSound): void {
  switch (sound) {
    case "order":
      playInstructorOrderBeep();
      break;
    case "chat":
    case "reminder":
      playInstructorChatMessageBeep();
      break;
  }
}

function showBrowserNotification(options: FireSiteAlertOptions): void {
  if (options.skipNotification) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(options.title, {
      body: options.body,
      tag: options.tag ?? "skiinstruct-site-alert",
      requireInteraction: options.requireInteraction ?? false,
    });
    if (options.url) {
      n.onclick = () => {
        window.focus();
        window.location.href = options.url!;
        n.close();
      };
    }
  } catch {
    /* ignore */
  }
}

function showSiteToast(options: FireSiteAlertOptions): void {
  if (options.skipToast) return;
  toast.message(options.title, {
    description: options.body,
    duration: options.toastDuration ?? 12_000,
    action: options.toastAction,
  });
}

/**
 * Полный набор оповещений с сайта: звук, вибрация, системное уведомление, toast.
 * Модальные окна вызывающий код показывает отдельно.
 */
export function fireSiteAlert(options: FireSiteAlertOptions): void {
  if (!options.skipSound) {
    playSiteAlertSound(options.sound ?? "order");
  }
  if (!options.skipVibrate) {
    vibrateSiteAlert();
  }
  showBrowserNotification(options);
  showSiteToast(options);
}

export function siteAlertTitle(shortTitle: string): string {
  return `${getPublicProductName()}: ${shortTitle}`;
}
