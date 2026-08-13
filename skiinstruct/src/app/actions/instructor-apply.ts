"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import { credentialsSignInNoRedirect } from "@/lib/credentials-sign-in-core";
import { createInstructorApplication } from "@/lib/instructor-application";

export type InstructorApplyState = {
  error: string | null;
  success: boolean;
};

export async function instructorApplyAction(
  _prev: InstructorApplyState,
  formData: FormData,
): Promise<InstructorApplyState> {
  const extra = formData.getAll("extraSpecializations").map((v) => String(v));
  const password = String(formData.get("password") ?? "");

  const taxStatusRaw = String(formData.get("taxStatus") ?? "");
  const taxStatus =
    taxStatusRaw === "IP" ? ("IP" as const) : taxStatusRaw === "SELF_EMPLOYED" ? ("SELF_EMPLOYED" as const) : undefined;

  const acquisition: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
    const v = String(formData.get(key) ?? "").trim();
    if (v) acquisition[key] = v.slice(0, 200);
  }

  const created = await createInstructorApplication({
    email: String(formData.get("email") ?? ""),
    password,
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    middleName: String(formData.get("middleName") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    hourlyRate: Number(formData.get("hourlyRate") ?? 0),
    primarySpecialization: String(formData.get("primarySpecialization") ?? ""),
    extraSpecializations: extra,
    achievementsRaw: String(formData.get("achievements") ?? ""),
    acceptAgencyOffer: formData.get("acceptAgencyOffer") === "on",
    acceptPrivacy: formData.get("acceptPrivacy") === "on",
    taxStatus,
    inn: String(formData.get("inn") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
    passportSeries: String(formData.get("passportSeries") ?? ""),
    passportNumber: String(formData.get("passportNumber") ?? ""),
    passportIssuedAt: String(formData.get("passportIssuedAt") ?? ""),
    passportDepartmentCode: String(formData.get("passportDepartmentCode") ?? ""),
    passportScan: (() => {
      const f = formData.get("passportScan");
      return f instanceof File && f.size > 0 ? f : null;
    })(),
    taxDocumentScan: (() => {
      const f = formData.get("taxDocumentScan");
      return f instanceof File && f.size > 0 ? f : null;
    })(),
    acquisition: Object.keys(acquisition).length > 0 ? acquisition : undefined,
  });

  if (!created.ok) {
    return { error: created.error, success: false };
  }

  const afterApplyUrl = `/instructor/pending?applied=1&verifyEmail=1`;

  await signOut({ redirect: false });
  const signedIn = await credentialsSignInNoRedirect(created.email, password);
  if (!signedIn.ok) {
    redirect(
      `/instructor/login?applied=1&verifyEmail=1&email=${encodeURIComponent(created.email)}&signin=required`,
    );
  }

  redirect(afterApplyUrl);
}
