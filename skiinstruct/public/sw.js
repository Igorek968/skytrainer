/* eslint-disable no-restricted-globals */
/* build: 20260624-client-chat-reply */

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
  const hasOrderId =
    typeof data.orderId === "string" &&
    (isInstructorOrder || isInstructorChat || isClientChat);

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
      orderId: hasOrderId ? data.orderId : null,
      actionToken: typeof data.actionToken === "string" ? data.actionToken : null,
      replyToken: typeof data.replyToken === "string" ? data.replyToken : null,
      kind: data.kind || null,
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
          /* openWindow fallback below */
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
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const data = parsePushData(event);
  const { title, options } = notificationOptions(data);
  event.waitUntil(
    (async () => {
      const clients = await notifyOpenClients(title, options);
      const hasVisibleClient = clients.some((c) => c.visibilityState === "visible");
      if (!hasVisibleClient) {
        await self.registration.showNotification(title, options);
      }
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
