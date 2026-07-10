import { getPublicProductName } from "@/shared/lib/product";

export function referralShareTitle(): string {
  return `${getPublicProductName()} — инструктор для тебя`;
}

export const REFERRAL_SHARE_TEXT =
  "Заказывай занятия с инструкторами рядом — горные лыжи, сноубoard, авто и другое.";

export async function shareOrCopyReferralLink(referralLink: string): Promise<"shared" | "copied"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: referralShareTitle(),
        text: REFERRAL_SHARE_TEXT,
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
