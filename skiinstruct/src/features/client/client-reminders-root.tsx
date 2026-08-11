"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";

import { ClientChatMessagePrompt } from "@/features/client/client-chat-message-prompt";
import { ClientEmailVerificationGate } from "@/features/auth/client-email-verification-gate";
import { OrderLessonRemindersPrompt } from "@/features/orders/order-lesson-reminders-prompt";
import { PushEnableBanner } from "@/features/push/push-enable-banner";
import { useAutoWebPushSubscribe } from "@/features/push/use-auto-web-push-subscribe";
import { useVisibilityInvalidate } from "@/features/push/use-visibility-invalidate";

function ClientEmailGateHost() {
  return (
    <Suspense fallback={null}>
      <ClientEmailVerificationGate />
    </Suspense>
  );
}

/** Напоминания клиенту по урокам + блокировка до подтверждения email. */
export function ClientRemindersRoot() {
  const { data: session, status } = useSession();
  const isClient = status === "authenticated" && session?.user?.role === "CLIENT";

  useAutoWebPushSubscribe(isClient);
  useVisibilityInvalidate([["client-order-reminders"], ["client-chat-alerts"]]);

  if (!isClient) return null;

  return (
    <>
      <ClientEmailGateHost />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-md">
        <div className="pointer-events-auto">
          <PushEnableBanner
            audience="client"
            className="mb-0 rounded-lg border border-sky-500/40 bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur"
          />
        </div>
      </div>
      <OrderLessonRemindersPrompt role="client" />
      <ClientChatMessagePrompt />
    </>
  );
}
