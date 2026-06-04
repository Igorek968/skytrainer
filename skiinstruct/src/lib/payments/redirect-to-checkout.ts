/** Создать оплату заказа: ЮKassa → Stripe → mock (через stripe route). */
export async function redirectToOrderCheckout(orderId: string): Promise<void> {
  const yooRes = await fetch("/api/payments/yookassa/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
    credentials: "include",
  });

  if (yooRes.status !== 503) {
    const raw = await yooRes.text();
    const j = (() => {
      try {
        return (raw ? JSON.parse(raw) : {}) as { url?: string; error?: string };
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
