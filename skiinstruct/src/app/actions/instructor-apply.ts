"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import { credentialsSignInNoRedirect, isNextRedirect } from "@/lib/credentials-sign-in-core";
import { createInstructorApplication } from "@/lib/instructor-application";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  TRAFFIC_SOURCE_COOKIE_NAME,
  mergeAcquisitionWithRestrictedTraffic,
} from "@/lib/restricted-social-traffic";
import { captchaTokenFromFormData, verifyTurnstileToken } from "@/lib/security/captcha";

export type InstructorApplyState = {
  error: string | null;
  success: boolean;
};

export async function instructorApplyAction(
  _prev: InstructorApplyState,
  formData: FormData,
): Promise<InstructorApplyState> {
  try {
    return await instructorApplyActionInner(formData);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    console.error("[instructor-apply]", error);
    return {
      error: "Не удалось сохранить заявку. Проверьте файлы и интернет, затем попробуйте снова.",
      success: false,
    };
  }
}

async function instructorApplyActionInner(formData: FormData): Promise<InstructorApplyState> {
  const h = await headers();
  const ip = clientIp(h);
  const emailKey = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 120);
  if (
    !rateLimit(`instructor-apply:ip:${ip}`, 8, 3600_000) ||
    (emailKey && !rateLimit(`instructor-apply:email:${emailKey}`, 4, 3600_000))
  ) {
    return { error: "Слишком много попыток. Подождите и попробуйте позже.", success: false };
  }

  const captchaToken = captchaTokenFromFormData(formData);
  const humanOk = await verifyTurnstileToken(captchaToken, ip);
  if (!humanOk) {
    return { error: "Подтвердите, что вы не робот, и отправьте анкету снова.", success: false };
  }

  const extra = formData.getAll("extraSpecializations").map((v) => String(v));
  const password = String(formData.get("password") ?? "");

  const taxStatusRaw = String(formData.get("taxStatus") ?? "");
  const taxStatus =
    taxStatusRaw === "IP" ? ("IP" as const) : taxStatusRaw === "SELF_EMPLOYED" ? ("SELF_EMPLOYED" as const) : undefined;

  const acquisition: Record<string, string> = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "restricted_social",
    "traffic_evidence",
    "traffic_referrer",
  ] as const) {
    const v = String(formData.get(key) ?? "").trim();
    if (v) acquisition[key] = v.slice(0, 200);
  }
  const cookieStore = await cookies();
  const mergedAcquisition = mergeAcquisitionWithRestrictedTraffic(acquisition, {
    referer: h.get("referer") ?? h.get("referrer"),
    userAgent: h.get("user-agent"),
    cookie: cookieStore.get(TRAFFIC_SOURCE_COOKIE_NAME)?.value,
  });

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
    acquisition: Object.keys(mergedAcquisition).length > 0 ? mergedAcquisition : undefined,
    referralCode: String(formData.get("referralCode") ?? "").trim() || undefined,
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
