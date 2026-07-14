"use client";

import { useEffect } from "react";

import { fireSiteAlert } from "@/lib/site-alert";

type PushMessage = {
  type?: string;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  sound?: "order" | "chat" | "reminder";
};

/**
 * Когда PWA открыта (Android/iOS), push из service worker дублируется звуком и вибрацией на сайте.
 */
export function SitePushForegroundBridge() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent<PushMessage>) => {
      const data = event.data;
      if (!data || data.type !== "skiinstruct-push") return;
      if (!data.title) return;

      const sound =
        data.sound ??
        (data.tag?.startsWith("instructor-order")
          ? "order"
          : data.tag?.startsWith("instructor-verification-approved")
            ? "order"
            : data.tag?.startsWith("instructor-chat") ||
                data.tag?.startsWith("client-chat") ||
                data.tag?.startsWith("lesson-") ||
                data.tag?.startsWith("instructor-verification")
              ? "chat"
              : "reminder");

      fireSiteAlert({
        title: data.title,
        body: data.body ?? "",
        sound,
        tag: data.tag,
        url: data.url,
        requireInteraction: Boolean(
          data.tag?.startsWith("instructor-order") ||
            data.tag?.startsWith("lesson-") ||
            data.tag?.startsWith("instructor-chat") ||
            data.tag?.startsWith("client-chat") ||
            data.tag?.startsWith("instructor-verification"),
        ),
        toastAction: data.url
          ? {
              label: "Открыть",
              onClick: () => {
                window.location.href = data.url!;
              },
            }
          : undefined,
      });
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return null;
}
