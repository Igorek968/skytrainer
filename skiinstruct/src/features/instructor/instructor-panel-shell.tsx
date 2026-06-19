"use client";

import { InstructorLessonSoonPrompt } from "@/features/instructor/instructor-lesson-soon-prompt";
import { InstructorPendingOrderPrompt } from "@/features/instructor/instructor-pending-order-prompt";
import { InstructorPushAlertsBanner } from "@/features/instructor/instructor-push-alerts-banner";
import { unlockInstructorOrderBeep } from "@/features/instructor/instructor-order-beep";
import { isWebPushAvailable, subscribeWebPush, syncWebPushSubscription } from "@/features/push/web-push-client";
import { useEffect } from "react";

export function InstructorPanelShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unlock = () => unlockInstructorOrderBeep();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {});
    }

    if (isWebPushAvailable() && Notification.permission === "granted") {
      void syncWebPushSubscription();
    }

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <>
      <InstructorPushAlertsBanner />
      {children}
      <InstructorPendingOrderPrompt />
      <InstructorLessonSoonPrompt />
    </>
  );
}

/** После разрешения браузерных уведомлений — подписать инструктора на Web Push (заявки вне сайта). */
export async function enableInstructorOfflineAlerts(): Promise<boolean> {
  if (!isWebPushAvailable()) return false;
  return subscribeWebPush();
}
