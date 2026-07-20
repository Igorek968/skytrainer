function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function postSubscription(sub: PushSubscription): Promise<boolean> {
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false;
  const res = await fetch("/api/me/push-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: j.endpoint,
      keys: { p256dh: j.keys.p256dh, auth: j.keys.auth },
    }),
  });
  return res.ok;
}

export function isWebPushAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return Boolean(vapid && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window);
}

/** iOS Web Push работает только из «На экран Домой» (standalone). */
export function isIosHomeScreenPwa(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  return standalone;
}

export function canRequestWebPushOnThisDevice(): boolean {
  if (!isWebPushAvailable()) return false;
  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIos && !isIosHomeScreenPwa()) return false;
  return true;
}

/** Синхронизирует существующую подписку с сервером (без запроса разрешения). */
export async function syncWebPushSubscription(): Promise<boolean> {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapid || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await reg.update().catch(() => {});
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return false;
    return postSubscription(sub);
  } catch {
    return false;
  }
}

/** Запрашивает разрешение и регистрирует Web Push на сервере. */
export async function subscribeWebPush(): Promise<boolean> {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapid || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;

  let perm = Notification.permission;
  if (perm === "default") {
    perm = await Notification.requestPermission();
  }
  if (perm !== "granted") return false;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await reg.update().catch(() => {});
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      });
    }
    return postSubscription(sub);
  } catch {
    return false;
  }
}
