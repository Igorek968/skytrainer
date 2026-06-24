"use client";

import { useSession } from "next-auth/react";

import { OrderLessonRemindersPrompt } from "@/features/orders/order-lesson-reminders-prompt";
import { useAutoWebPushSubscribe } from "@/features/push/use-auto-web-push-subscribe";
import { useVisibilityInvalidate } from "@/features/push/use-visibility-invalidate";

/** Напоминания клиенту по урокам (1 ч, старт, завершение). */
export function ClientRemindersRoot() {
  const { data: session, status } = useSession();
  const isClient = status === "authenticated" && session?.user?.role === "CLIENT";

  useAutoWebPushSubscribe(isClient);
  useVisibilityInvalidate([["client-order-reminders"]]);

  if (!isClient) return null;

  return <OrderLessonRemindersPrompt role="client" />;
}
