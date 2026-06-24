/* eslint-disable no-restricted-globals */

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
  const isChat = data.kind === "instructor-chat";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    vibrate: [180, 80, 180, 80, 180],
    silent: false,
    renotify: true,
    requireInteraction: isInstructorOrder || isLessonReminder || isChat,
    tag,
    data: {
      url,
      orderId: isInstructorOrder ? data.orderId : null,
      actionToken: typeof data.actionToken === "string" ? data.actionToken : null,
      kind: data.kind || null,
      sound: data.sound || null,
    },
  };
  if (isInstructorOrder) {
    options.actions = [{ action: "accept", title: "Принять" }];
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

async function respondToOrder(orderId, actionToken, action) {
  const res = await fetch(`/api/orders/${orderId}/push-respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action, token: actionToken || undefined }),
  });
  let payload = {};
  try {
    payload = await res.json();
  } catch {
    payload = {};
  }
  return { ok: res.ok, payload, status: res.status };
}

async function showResultNotification(title, body, url) {
  await self.registration.showNotification(title, {
    body,
    icon: NOTIFICATION_ICON,
    tag: "skiinstruct-action-result",
    data: { url: url || "/" },
    vibrate: [100, 50, 100],
  });
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
          /* fall through */
        }
      }
      return;
    }
  }
  if (self.clients.openWindow) await self.clients.openWindow(abs);
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
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
      // В фоне / экран заблокирован — системное уведомление на шторке Android.
      // Если вкладка на экране — дублирует страница (SitePushForegroundBridge).
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

  if (orderId && action === "reject") {
    // Старые уведомления с кнопкой «Отклонить» — только открываем заказ, без авто-отклонения.
    event.waitUntil(focusOrOpen(`/instructor/orders/${orderId}`));
    return;
  }

  if (orderId && action === "accept") {
    event.waitUntil(
      (async () => {
        const result = await respondToOrder(orderId, actionToken, action);
        if (result.ok) {
          const msg =
            action === "accept"
              ? "Заявка принята. Откройте заказ для деталей."
              : "Заявка отклонена.";
          await showResultNotification(
            action === "accept" ? "Заявка принята" : "Заявка отклонена",
            msg,
            `/instructor/orders/${orderId}`,
          );
          await focusOrOpen(`/instructor/orders/${orderId}?accepted=1`);
          return;
        }
        const errMsg =
          (result.payload && result.payload.error) ||
          (action === "accept" ? "Не удалось принять заявку" : "Не удалось отклонить");
        await showResultNotification("Utrainer", `${errMsg}. Откройте сайт.`, url);
        await focusOrOpen(url);
      })(),
    );
    return;
  }

  event.waitUntil(
    focusOrOpen(orderId ? `/instructor/orders/${orderId}?fromPush=1` : url),
  );
});
