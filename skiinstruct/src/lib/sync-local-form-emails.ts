import { FORM_DRAFT_KEYS, readFormDraft, saveFormDraft } from "@/lib/form-draft-storage";
import { readClientCheckoutDraft, saveClientCheckoutDraft } from "@/lib/client-checkout-draft";

type DraftWithEmail = { email?: string };

/**
 * После смены неподтверждённого email — подставить новый адрес во все локальные черновики анкет.
 */
export function syncLocalFormEmails(nextEmail: string): void {
  const email = nextEmail.trim().toLowerCase();
  if (!email.includes("@")) return;

  const checkout = readClientCheckoutDraft();
  if (checkout) {
    saveClientCheckoutDraft({ ...checkout, email });
  }

  for (const key of [FORM_DRAFT_KEYS.clientRegister, FORM_DRAFT_KEYS.instructorApply] as const) {
    const draft = readFormDraft<DraftWithEmail>(key);
    if (draft && typeof draft === "object") {
      saveFormDraft(key, { ...draft, email });
    }
  }
}
