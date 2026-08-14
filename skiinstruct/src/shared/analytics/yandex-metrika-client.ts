"use client";

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

const COUNTER_ID = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim() || "";

export const YM_GOALS = {
  supportOpen: "support_open",
  loginStepEmail: "login_step_email",
  loginSubmit: "login_submit",
  /** Клиент нажал «Зарегистрироваться» и форма прошла базовую проверку (не каждый клик). */
  registerSubmit: "register_submit",
  /** Клиент создан и попал в поток подтверждения email / кабинет. */
  registerSuccess: "register_success",
  instructorLoginOpen: "instructor_login_open",
  clientLoginOpen: "client_login_open",
  googleAuthStart: "google_auth_start",
  emailClick: "email_click",
  /** Анкета инструктора отправлена и прошла базовую проверку полей. */
  instructorApplySubmit: "instructor_apply_submit",
  /** Заявка создана (экран pending / login с applied=1). */
  instructorApplySuccess: "instructor_apply_success",
  orderCreate: "order_create",
  orderPaid: "order_paid",
  phoneClick: "phone_click",
  messengerTelegram: "messenger_telegram",
  messengerWhatsapp: "messenger_whatsapp",
  landingAutoCta: "landing_auto_cta",
  landingInstructorCta: "landing_instructor_cta",
  landingEventsCta: "landing_events_cta",
} as const;

function canTrack(): boolean {
  return Boolean(COUNTER_ID) && typeof window !== "undefined" && typeof window.ym === "function";
}

export function trackYandexGoal(goal: string, params?: Record<string, unknown>): void {
  if (!canTrack()) return;
  if (params && Object.keys(params).length > 0) {
    window.ym?.(COUNTER_ID, "reachGoal", goal, params);
    return;
  }
  window.ym?.(COUNTER_ID, "reachGoal", goal);
}

export function trackYandexHit(url: string, referer?: string): void {
  if (!canTrack()) return;
  if (referer) {
    window.ym?.(COUNTER_ID, "hit", url, { referer });
    return;
  }
  window.ym?.(COUNTER_ID, "hit", url);
}
