"use client";

import { InstructorChatMessagePrompt } from "@/features/instructor/instructor-chat-message-prompt";
import { InstructorEventRegistrationPrompt } from "@/features/instructor/instructor-event-registration-prompt";
import { InstructorLessonSoonPrompt } from "@/features/instructor/instructor-lesson-soon-prompt";
import { InstructorPendingOrderPrompt } from "@/features/instructor/instructor-pending-order-prompt";
import { InstructorPushAlertsBanner } from "@/features/instructor/instructor-push-alerts-banner";
import { EmailVerificationGate } from "@/features/auth/email-verification-gate";
import { EventStartRemindersPrompt } from "@/features/events/event-start-reminders-prompt";
import { OrderLessonRemindersPrompt } from "@/features/orders/order-lesson-reminders-prompt";
import { TelegramChannelInvite } from "@/shared/marketing/telegram-channel-invite";
import { useAutoWebPushSubscribe } from "@/features/push/use-auto-web-push-subscribe";
import { useVisibilityInvalidate } from "@/features/push/use-visibility-invalidate";
import { unlockSiteAlertSound } from "@/lib/site-alert";
import { isWebPushAvailable, subscribeWebPush, syncWebPushSubscription } from "@/features/push/web-push-client";
import { Suspense, useEffect } from "react";

export function InstructorPanelShell({ children }: { children: React.ReactNode }) {
  useAutoWebPushSubscribe(true);
  useVisibilityInvalidate([
    ["instructor-order-alerts"],
    ["instructor-chat-alerts"],
    ["instructor-registration-alerts"],
    ["instructor-event-start-reminders"],
  ]);

  useEffect(() => {
    const unlock = () => unlockSiteAlertSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

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
      <Suspense fallback={null}>
        <EmailVerificationGate role="INSTRUCTOR" />
      </Suspense>
      <InstructorPushAlertsBanner audience="instructor" />
      <div className="mx-auto max-w-6xl space-y-3 px-4 pt-3">
        <TelegramChannelInvite
          campaign="instructor_cabinet"
          audience="instructor"
          dismissible
          dismissKey="tg-invite-instructor-v1"
        />
      </div>
      {children}
      <InstructorPendingOrderPrompt />
      <InstructorEventRegistrationPrompt />
      <InstructorChatMessagePrompt />
      <InstructorLessonSoonPrompt />
      <OrderLessonRemindersPrompt role="instructor" />
      <EventStartRemindersPrompt role="instructor" />
    </>
  );
}

/** После разрешения браузерных уведомлений — подписать инструктора на Web Push. */
export async function enableInstructorOfflineAlerts(): Promise<boolean> {
  return subscribeWebPush();
}
