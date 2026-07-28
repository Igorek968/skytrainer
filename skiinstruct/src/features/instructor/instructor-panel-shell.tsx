"use client";

import { InstructorChatMessagePrompt } from "@/features/instructor/instructor-chat-message-prompt";
import { InstructorEventRegistrationPrompt } from "@/features/instructor/instructor-event-registration-prompt";
import { InstructorLessonSoonPrompt } from "@/features/instructor/instructor-lesson-soon-prompt";
import { InstructorPendingOrderPrompt } from "@/features/instructor/instructor-pending-order-prompt";
import { InstructorPushAlertsBanner } from "@/features/instructor/instructor-push-alerts-banner";
import { OrderLessonRemindersPrompt } from "@/features/orders/order-lesson-reminders-prompt";
import { useAutoWebPushSubscribe } from "@/features/push/use-auto-web-push-subscribe";
import { useVisibilityInvalidate } from "@/features/push/use-visibility-invalidate";
import { unlockSiteAlertSound } from "@/lib/site-alert";
import { isWebPushAvailable, subscribeWebPush, syncWebPushSubscription } from "@/features/push/web-push-client";
import { useEffect } from "react";

export function InstructorPanelShell({ children }: { children: React.ReactNode }) {
  useAutoWebPushSubscribe(true);
  useVisibilityInvalidate([
    ["instructor-order-alerts"],
    ["instructor-chat-alerts"],
    ["instructor-registration-alerts"],
  ]);

  useEffect(() => {
    const unlock = () => unlockSiteAlertSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    // Не вызываем requestPermission() без жеста — на iOS PWA это молча ломает push.
    // Баннер «Включить уведомления» запрашивает разрешение по тапу.
    if (isWebPushAvailable() && typeof Notification !== "undefined" && Notification.permission === "granted") {
      void syncWebPushSubscription();
    }

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <>
      <InstructorPushAlertsBanner audience="instructor" />
      {children}
      <InstructorPendingOrderPrompt />
      <InstructorEventRegistrationPrompt />
      <InstructorChatMessagePrompt />
      <InstructorLessonSoonPrompt />
      <OrderLessonRemindersPrompt role="instructor" />
    </>
  );
}

/** После разрешения браузерных уведомлений — подписать инструктора на Web Push (заявки вне сайта). */
export async function enableInstructorOfflineAlerts(): Promise<boolean> {
  return subscribeWebPush();
}
