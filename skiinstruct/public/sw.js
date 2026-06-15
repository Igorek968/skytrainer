/* eslint-disable no-restricted-globals */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Utrainer", body: event.data ? String(event.data.text()) : "" };
  }
  const title = data.title || "Utrainer";
  const url = typeof data.url === "string" ? data.url : "/";
  const tag = typeof data.tag === "string" ? data.tag : "skiinstruct";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    vibrate: [180, 80, 180],
    silent: false,
    renotify: true,
    tag,
    data: { url },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const abs = new URL(url, self.location.origin).href;
      for (const c of clientList) {
        if ("focus" in c && c.url === abs) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(abs);
    }),
  );
});
