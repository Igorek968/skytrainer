"use client";

import { useSession } from "next-auth/react";

import { ClientChatMessagePrompt } from "@/features/client/client-chat-message-prompt";
import { OrderLessonRemindersPrompt } from "@/features/orders/order-lesson-reminders-prompt";
import { useAutoWebPushSubscribe } from "@/features/push/use-auto-web-push-subscribe";
import { useVisibilityInvalidate } from "@/features/push/use-visibility-invalidate";

/** Напоминания клиенту по урокам (1 ч, старт, завершение). */
export function ClientRemindersRoot() {
  const { data: session, status } = useSession();
  const isClient = status === "authenticated" && session?.user?.role === "CLIENT";

  useAutoWebPushSubscribe(isClient);
  useVisibilityInvalidate([["client-order-reminders"], ["client-chat-alerts"]]);

  if (!isClient) return null;

  return (
    <>
      <OrderLessonRemindersPrompt role="client" />
      <ClientChatMessagePrompt />
    </>
  );
}
