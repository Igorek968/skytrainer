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
  });

  if (!created.ok) {
    return { error: created.error, success: false };
  }

  const afterApplyUrl = `/instructor/pending?applied=1`;

  await signOut({ redirect: false });
  const signedIn = await credentialsSignInNoRedirect(created.email, password);
  if (!signedIn.ok) {
    redirect(
      `/instructor/login?applied=1&email=${encodeURIComponent(created.email)}&signin=required`,
    );
  }

  redirect(afterApplyUrl);
}
