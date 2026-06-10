import type { InstructorTaxStatus } from "@prisma/client";

import { clearFormDraft, readFormDraft, saveFormDraft } from "@/lib/form-draft-storage";

const STORAGE_KEY = "skiinstruct_form_draft:client_checkout";

export type ClientCheckoutDraft = {
  instructorId: string;
  instructorName: string | null;
  hourlyRate: number;
  taxStatus?: InstructorTaxStatus | null;
  step: "account" | "pay" | "wrongRole";
  authMode: "login" | "register";
  email: string;
  password: string;
  passwordConfirm: string;
  name: string;
  acceptLegal: boolean;
};

export function saveClientCheckoutDraft(payload: ClientCheckoutDraft): void {
  saveFormDraft(STORAGE_KEY, payload);
}

export function readClientCheckoutDraft(): ClientCheckoutDraft | null {
  const j = readFormDraft<ClientCheckoutDraft>(STORAGE_KEY);
  if (!j?.instructorId || typeof j.instructorId !== "string") return null;
  return {
    instructorId: j.instructorId,
    instructorName: j.instructorName ?? null,
    hourlyRate: Number(j.hourlyRate) || 0,
    taxStatus: j.taxStatus ?? null,
    step: j.step === "pay" || j.step === "wrongRole" ? j.step : "account",
    authMode: j.authMode === "login" ? "login" : "register",
    email: j.email ?? "",
    password: j.password ?? "",
    passwordConfirm: j.passwordConfirm ?? "",
    name: j.name ?? "",
    acceptLegal: Boolean(j.acceptLegal),
  };
}

export function clearClientCheckoutDraft(): void {
  clearFormDraft(STORAGE_KEY);
}
