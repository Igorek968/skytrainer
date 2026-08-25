import { getPublicProductName } from "@/shared/lib/product";

export function referralShareTitle(): string {
  return getPublicProductName();
}

/** Текст шаринга: сначала название сайта, потом оффер. */
export function referralShareText(): string {
  return `${getPublicProductName()} — занятия с инструкторами рядом: горные лыжи, сноуборд, авто и другое.`;
}

/** @deprecated используйте referralShareText() */
export const REFERRAL_SHARE_TEXT = referralShareText();

/**
 * Нативный Web Share есть в Chrome/Edge на Windows, но лист часто не открывается
 * и `share()` зависает — кнопка «ничего не делает». Оставляем его телефонам и планшетам.
 */
export function canUseWebShare(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  const ua = navigator.userAgent;
  const maxTouch = navigator.maxTouchPoints ?? 0;
  const isiPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1);
  const isPhone = /Android|iPhone|iPod|Mobile/i.test(ua);
  if (!isiPad && !isPhone) return false;
  if (typeof navigator.canShare !== "function") return true;
  try {
    return navigator.canShare({ url: "https://example.com/" });
  } catch {
    return true;
  }
}

export async function copyReferralLink(referralLink: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(referralLink);
      return;
    } catch {
      /* fallback ниже */
    }
  }
  if (typeof document === "undefined") {
    throw new Error("clipboard unavailable");
  }
  const el = document.createElement("textarea");
  el.value = referralLink;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  if (!ok) throw new Error("copy failed");
}

function shareDataFor(referralLink: string): ShareData {
  const data: ShareData = {
    title: referralShareTitle(),
    url: referralLink,
  };
  const withText = { ...data, text: referralShareText() };
  if (typeof navigator.canShare === "function") {
    try {
      if (navigator.canShare(withText)) return withText;
    } catch {
      /* url+title */
    }
  }
  return data;
}

export async function shareOrCopyReferralLink(referralLink: string): Promise<"shared" | "copied"> {
  if (canUseWebShare()) {
    try {
      await navigator.share(shareDataFor(referralLink));
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  await copyReferralLink(referralLink);
  return "copied";
}
