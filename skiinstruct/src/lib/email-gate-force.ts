/** Клиентский флаг: сразу показать стоп-окно подтверждения email (заказ / регистрация). */

const KEY = "tt-force-email-gate";

export function forceEmailVerificationGate(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* private mode */
  }
}

export function clearForcedEmailVerificationGate(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function isEmailVerificationGateForced(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
