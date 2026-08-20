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

export async function shareOrCopyReferralLink(referralLink: string): Promise<"shared" | "copied"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: referralShareTitle(),
        text: referralShareText(),
        url: referralLink,
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  await navigator.clipboard.writeText(referralLink);
  return "copied";
}
