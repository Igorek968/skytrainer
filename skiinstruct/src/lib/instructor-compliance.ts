import type { ComplianceDocType, InstructorProfile, InstructorTaxStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ComplianceFlags = {
  agencyOfferAccepted: boolean;
  taxDocumentApproved: boolean;
  insuranceApproved: boolean;
  canAcceptPaidOrders: boolean;
};

export function computeComplianceFlags(input: {
  agencyOfferAcceptedAt: Date | null | undefined;
  taxStatus: InstructorTaxStatus | null | undefined;
  approvedDocTypes: Set<string>;
}): ComplianceFlags {
  const approved = input.approvedDocTypes;
  const taxOk =
    input.taxStatus === "IP"
      ? approved.has("TAX_STATUS_IP") || approved.has("TAX_STATUS_NPD")
      : approved.has("TAX_STATUS_NPD") || approved.has("TAX_STATUS_IP");
  const insuranceOk = approved.has("INSURANCE");
  const agencyOfferAccepted = Boolean(input.agencyOfferAcceptedAt);

  return {
    agencyOfferAccepted,
    taxDocumentApproved: taxOk,
    insuranceApproved: insuranceOk,
    canAcceptPaidOrders: agencyOfferAccepted && taxOk && insuranceOk,
  };
}

/** Для ИП вместо NPD допускается TAX_STATUS_IP. */
export async function getInstructorComplianceStatus(userId: string) {
  const profile = await prisma.instructorProfile.findUnique({
    where: { userId },
    select: { taxStatus: true, agencyOfferAcceptedAt: true, inn: true },
  });
  const docs = await prisma.instructorComplianceDocument.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const approved = new Set(
    docs.filter((d) => d.status === "APPROVED").map((d) => d.type),
  );

  const flags = computeComplianceFlags({
    agencyOfferAcceptedAt: profile?.agencyOfferAcceptedAt,
    taxStatus: profile?.taxStatus,
    approvedDocTypes: approved,
  });

  return {
    ...flags,
    documents: docs,
  };
}

export const COMPLIANCE_BLOCK_MESSAGE =
  "Для приёма оплаченных заявок нужны: акцепт агентского договора, одобренные документы НПД/ИП и страхование. Загрузите их в разделе «Соответствие и выплаты».";

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
