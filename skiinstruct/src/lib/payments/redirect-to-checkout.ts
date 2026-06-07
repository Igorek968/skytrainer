/** Создать оплату заказа через ЮKassa (при необходимости — с привязкой карты). */
export async function redirectToOrderCheckout(
  orderId: string,
  opts?: { bindAndPay?: boolean },
): Promise<void> {
  const yooRes = await fetch("/api/payments/yookassa/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, bindAndPay: opts?.bindAndPay === true }),
    credentials: "include",
  });

  if (yooRes.status !== 503) {
    const raw = await yooRes.text();
    const j = (() => {
      try {
        return (raw ? JSON.parse(raw) : {}) as { url?: string; error?: string; code?: string };
      } catch {
        return {};
      }
    })();
    if (!yooRes.ok || !j.url) {
      throw new Error(typeof j.error === "string" ? j.error : "Не удалось перейти к оплате");
    }
    window.location.href = j.url;
    return;
  }

  const stripeRes = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
    credentials: "include",
  });
  const raw = await stripeRes.text();
  const j = (() => {
    try {
      return (raw ? JSON.parse(raw) : {}) as { url?: string; error?: string };
    } catch {
      return {};
    }
  })();
  if (!stripeRes.ok || !j.url) {
    throw new Error(typeof j.error === "string" ? j.error : "Не удалось перейти к оплате");
  }
  window.location.href = j.url;
}

/** Привязка карты через ЮKassa (нулевая сумма). */
export async function redirectToYooCardBinding(returnUrl?: string): Promise<void> {
  const r = await fetch("/api/payments/yookassa/bind", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(returnUrl ? { returnUrl } : {}),
    credentials: "include",
  });
  const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!r.ok || !j.url) {
    throw new Error(typeof j.error === "string" ? j.error : "Не удалось открыть привязку карты");
  }
  window.location.href = j.url;
}

/** После return_url от ЮKassa — подтянуть статус привязки (если webhook не дошёл). */
export async function syncYooCardBinding(): Promise<{ hasCard: boolean }> {
  const r = await fetch("/api/payments/yookassa/sync-card", {
    method: "POST",
    credentials: "include",
  });
  const j = (await r.json().catch(() => ({}))) as { hasCard?: boolean; error?: string };
  if (!r.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Не удалось проверить карту");
  }
  return { hasCard: Boolean(j.hasCard) };
}
