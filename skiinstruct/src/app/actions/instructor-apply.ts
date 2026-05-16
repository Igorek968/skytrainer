"use server";

import { redirect } from "next/navigation";

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

  const created = await createInstructorApplication({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
    name: String(formData.get("name") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    hourlyRate: Number(formData.get("hourlyRate") ?? 0),
    primarySpecialization: String(formData.get("primarySpecialization") ?? ""),
    extraSpecializations: extra,
    achievementsRaw: String(formData.get("achievements") ?? ""),
  });

  if (!created.ok) {
    return { error: created.error, success: false };
  }

  redirect(`/instructor/login?applied=1&email=${encodeURIComponent(created.email)}`);
}
