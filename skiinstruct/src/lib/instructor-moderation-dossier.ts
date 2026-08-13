import { complianceDocTypeLabel } from "@/lib/instructor-agency-registry";
import { computeComplianceFlags } from "@/lib/instructor-compliance";
import { parseProfileDraft } from "@/lib/instructor-profile-draft";
import { prisma } from "@/lib/prisma";
import { readSensitiveUpload } from "@/lib/private-uploads";
import { resolveSensitiveUploadDisplaySrc } from "@/lib/sensitive-upload-urls";

export type InstructorModerationDocument = {
  id: string;
  type: string;
  typeLabel: string;
  status: string;
  rejectNote: string | null;
  createdAt: string;
  /** URL для просмотра в админке (/api/private-media/...). */
  viewUrl: string | null;
  /** Запись в БД есть, файла на диске нет (часто после деплоя без volume). */
  fileMissing?: boolean;
};

export type InstructorModerationDossier = {
  userId: string;
  moderationKind: "NEW_ACCOUNT" | "PROFILE_UPDATE" | "NONE";
  verificationStatus: string;
  /** Блок для заполнения / проверки агентского договора */
  contract: {
    fullName: string;
    lastName: string | null;
    firstName: string | null;
    middleName: string | null;
    nickname: string | null;
    email: string;
    phone: string | null;
    birthDate: string | null;
    inn: string | null;
    taxStatus: "SELF_EMPLOYED" | "IP" | null;
    taxStatusLabel: string;
    agencyOfferAcceptedAt: string | null;
    agencyOfferVersion: string | null;
    passportSeries: string | null;
    passportNumber: string | null;
    passportIssuedAt: string | null;
    passportDepartmentCode: string | null;
    payoutAccountHint: string | null;
  };
  profile: {
    bio: string | null;
    hourlyRate: number | null;
    specializations: string[];
    certificationLevel: string | null;
  };
  compliance: {
    agencyOfferAccepted: boolean;
    taxDocumentApproved: boolean;
    insuranceApproved: boolean;
    passportApproved: boolean;
    canAcceptPaidOrders: boolean;
    /** Что ещё нужно для допуска к оплаченным заявкам */
    blockers: string[];
  };
  documents: InstructorModerationDocument[];
  pendingDocumentIds: string[];
  acquisitionSource: string | null;
  certificateUrl: string;
};

function taxLabel(status: "SELF_EMPLOYED" | "IP" | null): string {
  if (status === "IP") return "ИП (нужна выписка ЕГРИП)";
  if (status === "SELF_EMPLOYED") return "Самозанятый НПД (нужна справка «Мой налог»)";
  return "не указан";
}

function formatDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function fetchInstructorModerationDossier(
  userId: string,
): Promise<InstructorModerationDossier | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "INSTRUCTOR" },
    select: {
      id: true,
      email: true,
      name: true,
      middleName: true,
      nickname: true,
      phone: true,
      birthDate: true,
      instructorProfile: {
        select: {
          verificationStatus: true,
          profileDraft: true,
          profileDraftStatus: true,
          bio: true,
          hourlyRate: true,
          specializations: true,
          certificationLevel: true,
          inn: true,
          taxStatus: true,
          agencyOfferAcceptedAt: true,
          agencyOfferVersion: true,
          passportSeries: true,
          passportNumber: true,
          passportIssuedAt: true,
          passportDepartmentCode: true,
          payoutAccountHint: true,
        },
      },
    },
  });

  if (!user?.instructorProfile) return null;
  const p = user.instructorProfile;
  const draft = parseProfileDraft(p.profileDraft);
  const draftRaw =
    p.profileDraft && typeof p.profileDraft === "object" && !Array.isArray(p.profileDraft)
      ? (p.profileDraft as Record<string, unknown>)
      : null;
  const acqRaw = draftRaw?.acquisition;
  const acq =
    acqRaw && typeof acqRaw === "object" && !Array.isArray(acqRaw)
      ? (acqRaw as Record<string, unknown>)
      : null;

  const docs = await prisma.instructorComplianceDocument.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const approved = new Set(docs.filter((d) => d.status === "APPROVED").map((d) => d.type));
  const flags = computeComplianceFlags({
    agencyOfferAcceptedAt: p.agencyOfferAcceptedAt,
    taxStatus: p.taxStatus,
    approvedDocTypes: approved,
    requiresPassportApproval: Boolean(p.passportSeries && p.passportNumber),
  });

  const blockers: string[] = [];
  if (!flags.agencyOfferAccepted) blockers.push("Нет акцепта агентской оферты");
  if (!flags.taxDocumentApproved) {
    blockers.push(
      p.taxStatus === "IP"
        ? "Нужно одобрить выписку ЕГРИП (ИП)"
        : "Нужно одобрить справку «Мой налог» (НПД)",
    );
  }
  if (p.passportSeries && p.passportNumber && !flags.passportApproved) {
    blockers.push("Нужно одобрить скан паспорта");
  }

  const nameParts = (user.name ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = draft?.firstName?.trim() || nameParts[0] || null;
  const lastName =
    draft?.lastName?.trim() || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : null);
  const middleName = (draft?.middleName ?? user.middleName)?.trim() || null;
  const fullName =
    [lastName, firstName, middleName].filter(Boolean).join(" ") ||
    user.name?.trim() ||
    user.email;

  const acquisitionSource = acq
    ? [acq.utm_source, acq.utm_medium, acq.utm_campaign, acq.utm_content, acq.utm_term]
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
        .join(" / ") || null
    : null;

  let moderationKind: InstructorModerationDossier["moderationKind"] = "NONE";
  if (p.verificationStatus !== "APPROVED") moderationKind = "NEW_ACCOUNT";
  else if (p.profileDraftStatus === "PENDING_REVIEW") moderationKind = "PROFILE_UPDATE";

  const documents: InstructorModerationDocument[] = await Promise.all(
    docs.map(async (d) => {
      const viewUrl = resolveSensitiveUploadDisplaySrc(d.fileUrl);
      let fileMissing = false;
      if (viewUrl?.startsWith("/api/private-media/")) {
        const segments = viewUrl.slice("/api/private-media/".length).split("/").filter(Boolean);
        const buf = await readSensitiveUpload(segments);
        fileMissing = !buf;
      } else if (!viewUrl) {
        fileMissing = true;
      }
      return {
        id: d.id,
        type: d.type,
        typeLabel: complianceDocTypeLabel(d.type),
        status: d.status,
        rejectNote: d.rejectNote,
        createdAt: d.createdAt.toISOString(),
        viewUrl: fileMissing ? null : viewUrl,
        fileMissing,
      };
    }),
  );

  const pendingDocumentIds = documents.filter((d) => d.status === "PENDING").map((d) => d.id);

  return {
    userId: user.id,
    moderationKind,
    verificationStatus: p.verificationStatus,
    contract: {
      fullName,
      lastName,
      firstName,
      middleName,
      nickname: (draft?.nickname ?? user.nickname)?.trim() || null,
      email: user.email,
      phone: user.phone,
      birthDate: formatDateOnly(user.birthDate),
      inn: p.inn,
      taxStatus: p.taxStatus,
      taxStatusLabel: taxLabel(p.taxStatus),
      agencyOfferAcceptedAt: p.agencyOfferAcceptedAt?.toISOString() ?? null,
      agencyOfferVersion: p.agencyOfferVersion,
      passportSeries: p.passportSeries,
      passportNumber: p.passportNumber,
      passportIssuedAt: formatDateOnly(p.passportIssuedAt),
      passportDepartmentCode: p.passportDepartmentCode,
      payoutAccountHint: p.payoutAccountHint,
    },
    profile: {
      bio: p.bio,
      hourlyRate: p.hourlyRate != null ? Number(p.hourlyRate) : null,
      specializations: p.specializations,
      certificationLevel: p.certificationLevel,
    },
    compliance: {
      ...flags,
      blockers,
    },
    documents,
    pendingDocumentIds,
    acquisitionSource,
    certificateUrl: `/api/admin/agency-registry/${user.id}/certificate`,
  };
}
