import type { ComplianceDocType, InstructorProfile, InstructorTaxStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ComplianceFlags = {
  agencyOfferAccepted: boolean;
  taxDocumentApproved: boolean;
  insuranceApproved: boolean;
  passportApproved: boolean;
  canAcceptPaidOrders: boolean;
};

export function computeComplianceFlags(input: {
  agencyOfferAcceptedAt: Date | null | undefined;
  taxStatus: InstructorTaxStatus | null | undefined;
  approvedDocTypes: Set<string>;
  /** Если паспортные реквизиты уже собраны — требуем одобренный скан. Старые анкеты без паспорта не блокируем. */
  requiresPassportApproval?: boolean;
}): ComplianceFlags {
  const approved = input.approvedDocTypes;
  const taxOk =
    input.taxStatus === "IP"
      ? approved.has("TAX_STATUS_IP") || approved.has("TAX_STATUS_NPD")
      : approved.has("TAX_STATUS_NPD") || approved.has("TAX_STATUS_IP");
  const insuranceOk = approved.has("INSURANCE");
  const passportUploadedOk = approved.has("PASSPORT");
  const passportOk = input.requiresPassportApproval ? passportUploadedOk : true;
  const agencyOfferAccepted = Boolean(input.agencyOfferAcceptedAt);

  return {
    agencyOfferAccepted,
    taxDocumentApproved: taxOk,
    insuranceApproved: insuranceOk,
    passportApproved: passportUploadedOk,
    // Страховка опциональна: не блокирует выплаты и приём оплаченных заявок.
    canAcceptPaidOrders: agencyOfferAccepted && taxOk && passportOk,
  };
}

/** Для ИП вместо NPD допускается TAX_STATUS_IP. */
export async function getInstructorComplianceStatus(userId: string) {
  const [profile, user, docs] = await Promise.all([
    prisma.instructorProfile.findUnique({
      where: { userId },
      select: {
        taxStatus: true,
        agencyOfferAcceptedAt: true,
        inn: true,
        payoutAccountHint: true,
        passportSeries: true,
        passportNumber: true,
        passportIssuedAt: true,
        passportDepartmentCode: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, birthDate: true },
    }),
    prisma.instructorComplianceDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const approved = new Set(
    docs.filter((d) => d.status === "APPROVED").map((d) => d.type),
  );

  const flags = computeComplianceFlags({
    agencyOfferAcceptedAt: profile?.agencyOfferAcceptedAt,
    taxStatus: profile?.taxStatus,
    approvedDocTypes: approved,
    requiresPassportApproval: Boolean(profile?.passportSeries && profile?.passportNumber),
  });

  return {
    ...flags,
    taxStatus: profile?.taxStatus ?? null,
    inn: profile?.inn ?? null,
    payoutAccountHint: profile?.payoutAccountHint ?? null,
    phone: user?.phone ?? null,
    birthDate: user?.birthDate?.toISOString() ?? null,
    passportSeries: profile?.passportSeries ?? null,
    passportNumber: profile?.passportNumber ?? null,
    passportIssuedAt: profile?.passportIssuedAt?.toISOString() ?? null,
    passportDepartmentCode: profile?.passportDepartmentCode ?? null,
    documents: docs,
  };
}

export const COMPLIANCE_BLOCK_MESSAGE =
  "Для приёма оплаченных заявок нужны: акцепт агентского договора, паспорт и одобренный документ НПД/ИП. Документ НПД/ЕГРИП загружается в анкете при регистрации; паспорт и реквизиты — в кабинете при необходимости.";

export async function assertInstructorCanAcceptPaidOrders(userId: string): Promise<string | null> {
  const status = await getInstructorComplianceStatus(userId);
  if (status.canAcceptPaidOrders) return null;
  return COMPLIANCE_BLOCK_MESSAGE;
}

export function taxDocTypeForProfile(
  profile: Pick<InstructorProfile, "taxStatus"> | null,
): ComplianceDocType {
  return profile?.taxStatus === "IP" ? "TAX_STATUS_IP" : "TAX_STATUS_NPD";
}
