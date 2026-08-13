import { NextResponse } from "next/server";

import { isApiErrorResponse, requireInstructorSession } from "@/lib/api-session";
import {
  getInstructorApplicationForEdit,
  updateInstructorApplicationAndResubmit,
} from "@/lib/instructor-application-update";

/** Анкета инструктора до одобрения (просмотр / правка после отказа). */
export async function GET() {
  const auth = await requireInstructorSession();
  if (isApiErrorResponse(auth)) return auth;

  const result = await getInstructorApplicationForEdit(auth.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    verificationStatus: result.verificationStatus,
    application: result.data,
  });
}

/** Сохранить правки и снова отправить на модерацию (только после REJECTED). */
export async function POST(req: Request) {
  const auth = await requireInstructorSession();
  if (isApiErrorResponse(auth)) return auth;

  const form = await req.formData();
  const result = await updateInstructorApplicationAndResubmit({
    userId: auth.userId,
    lastName: String(form.get("lastName") ?? ""),
    firstName: String(form.get("firstName") ?? ""),
    middleName: String(form.get("middleName") ?? ""),
    nickname: String(form.get("nickname") ?? ""),
    bio: String(form.get("bio") ?? ""),
    hourlyRate: String(form.get("hourlyRate") ?? ""),
    primarySpecialization: String(form.get("primarySpecialization") ?? ""),
    achievementsRaw: String(form.get("achievements") ?? ""),
    taxStatus: String(form.get("taxStatus") ?? ""),
    inn: String(form.get("inn") ?? ""),
    phone: String(form.get("phone") ?? ""),
    birthDate: String(form.get("birthDate") ?? ""),
    passportSeries: String(form.get("passportSeries") ?? ""),
    passportNumber: String(form.get("passportNumber") ?? ""),
    passportIssuedAt: String(form.get("passportIssuedAt") ?? ""),
    passportDepartmentCode: String(form.get("passportDepartmentCode") ?? ""),
    passportScan: (() => {
      const f = form.get("passportScan");
      return f instanceof File && f.size > 0 ? f : null;
    })(),
    taxDocumentScan: (() => {
      const f = form.get("taxDocumentScan");
      return f instanceof File && f.size > 0 ? f : null;
    })(),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, verificationStatus: "PENDING" });
}
