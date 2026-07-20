/* eslint-disable no-restricted-globals */
/* build: 20260720-push-always-notify */

const NOTIFICATION_ICON = "/icon-192.png";

function parsePushData(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Utrainer", body: event.data ? String(event.data.text()) : "" };
  }
  return data;
}

function notificationOptions(data) {
  const title = data.title || "Utrainer";
  const url = typeof data.url === "string" ? data.url : "/";
  const tag = typeof data.tag === "string" ? data.tag : "skiinstruct";
  const isInstructorOrder = data.kind === "instructor-order" && typeof data.orderId === "string";
  const isLessonReminder = data.kind === "lesson-reminder";
  const isInstructorChat = data.kind === "instructor-chat";
  const isClientChat = data.kind === "client-chat" && typeof data.orderId === "string";
  const orderId =
    typeof data.orderId === "string"
      ? data.orderId
      : typeof data.url === "string" && data.url.match(/\/orders\/([^/?#]+)/)
        ? data.url.match(/\/orders\/([^/?#]+)/)[1]
        : null;
  const hasOrderId = Boolean(orderId);

  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    vibrate: [180, 80, 180, 80, 180],
    silent: false,
    renotify: true,
    requireInteraction: isInstructorOrder || isLessonReminder || isInstructorChat || isClientChat,
    tag,
    data: {
      url,
      orderId: hasOrderId ? orderId : null,
      actionToken: typeof data.actionToken === "string" ? data.actionToken : null,
      replyToken: typeof data.replyToken === "string" ? data.replyToken : null,
      kind: data.kind || null,
      lessonPhase: data.lessonPhase || null,
      sound: data.sound || null,
    },
  };

  if (isInstructorOrder) {
    options.actions = [{ action: "accept", title: "Принять" }];
  } else if (isClientChat) {
    options.actions = [
      { action: "reply", title: "Ответить", type: "text", placeholder: "Ваш ответ…" },
      { action: "open", title: "Открыть чат" },
    ];
  } else if (isInstructorChat && hasOrderId) {
    options.actions = [{ action: "open", title: "Открыть чат" }];
  } else if (isLessonReminder && hasOrderId && data.lessonPhase === "start") {
    options.actions = [{ action: "start_lesson", title: "Начать урок" }];
  } else if (isLessonReminder && hasOrderId && data.lessonPhase === "end") {
    options.actions = [{ action: "complete_lesson", title: "Завершить урок" }];
  }

  return { title, options };
}

async function notifyOpenClients(title, options) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({
      type: "skiinstruct-push",
      title,
      body: options.body,
      url: options.data?.url,
      tag: options.tag,
      sound: options.data?.sound,
    });
  }
  return clients;
}

function orderAcceptUrl(orderId, actionToken) {
  const qs = new URLSearchParams({ pushAccept: "1" });
  if (actionToken) qs.set("pushToken", actionToken);
  return `/instructor/orders/${orderId}?${qs}`;
}

function chatUrlForKind(kind, orderId) {
  if (!orderId) return "/";
  if (kind === "client-chat") return `/client/orders/${orderId}#order-chat`;
  return `/instructor/orders/${orderId}#order-chat`;
}

function lessonActionUrl(orderId, action) {
  if (action === "start_lesson") return `/instructor/orders/${orderId}?lessonAction=start`;
  if (action === "complete_lesson") return `/instructor/orders/${orderId}?lessonAction=complete`;
  return `/instructor/orders/${orderId}`;
}

async function sendChatPushReply(orderId, replyToken, body) {
  const text = (body || "").trim();
  if (!text || !orderId) return { ok: false };
  const res = await fetch(`/api/orders/${orderId}/messages/push-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ body: text, token: replyToken || undefined }),
  });
  return { ok: res.ok };
}

async function focusOrOpen(url) {
  const abs = new URL(url, self.location.origin).href;
  const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of clientList) {
    if ("focus" in c && c.url.startsWith(self.location.origin)) {
      await c.focus();
      if ("navigate" in c) {
        try {
          await c.navigate(abs);
          return;
        } catch {
          /* openWindow fallback */
        }
      }
      break;
    }
  }
  if (self.clients.openWindow) await self.clients.openWindow(abs);
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Chrome/Android требуют fetch-handler в SW, иначе beforeinstallprompt не срабатывает
 * и «Установить приложение» не появляется. Сеть без офлайн-кэша страниц.
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(req));
});

self.addEventListener("push", (event) => {
  const data = parsePushData(event);
  const { title, options } = notificationOptions(data);
  event.waitUntil(
    (async () => {
      // Сайт (toast/звук) + системное уведомление на телефоне — всегда оба канала.
      await notifyOpenClients(title, options);
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const nd = event.notification.data || {};
  const url = nd.url || "/";
  const action = event.action;
  const orderId = nd.orderId;
  const actionToken = nd.actionToken;
  const replyToken = nd.replyToken;
  const kind = nd.kind;

  if (kind === "client-chat" && orderId && action === "reply" && event.reply) {
    event.waitUntil(
      (async () => {
        const result = await sendChatPushReply(orderId, replyToken, event.reply);
        if (result.ok) {
          await self.registration.showNotification("Utrainer", {
            body: "Ответ отправлен инструктору.",
            icon: NOTIFICATION_ICON,
            tag: "skiinstruct-chat-reply-sent",
            data: { url: chatUrlForKind(kind, orderId) },
          });
        } else {
          await focusOrOpen(chatUrlForKind(kind, orderId));
        }
      })(),
    );
    return;
  }

  if (orderId && action === "start_lesson") {
    event.waitUntil(focusOrOpen(lessonActionUrl(orderId, "start_lesson")));
    return;
  }

  if (orderId && action === "complete_lesson") {
    event.waitUntil(focusOrOpen(lessonActionUrl(orderId, "complete_lesson")));
    return;
  }

  if (orderId && action === "reject") {
    event.waitUntil(focusOrOpen(`/instructor/orders/${orderId}`));
    return;
  }

  if (orderId && action === "accept") {
    event.waitUntil(focusOrOpen(orderAcceptUrl(orderId, actionToken)));
    return;
  }

  if (orderId && (action === "open" || kind === "client-chat" || kind === "instructor-chat")) {
    event.waitUntil(focusOrOpen(chatUrlForKind(kind, orderId) || url));
    return;
  }

  event.waitUntil(
    focusOrOpen(
      orderId && kind === "instructor-order"
        ? `/instructor/orders/${orderId}?fromPush=1`
        : url,
    ),
  );
});
