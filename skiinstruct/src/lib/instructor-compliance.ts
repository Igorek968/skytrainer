import type { ComplianceDocType, InstructorProfile } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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

  const taxOk =
    profile?.taxStatus === "IP"
      ? approved.has("TAX_STATUS_IP") || approved.has("TAX_STATUS_NPD")
      : approved.has("TAX_STATUS_NPD") || approved.has("TAX_STATUS_IP");

  const insuranceOk = approved.has("INSURANCE");

  return {
    agencyOfferAccepted: Boolean(profile?.agencyOfferAcceptedAt),
    taxDocumentApproved: taxOk,
    insuranceApproved: insuranceOk,
    canAcceptPaidOrders:
      Boolean(profile?.agencyOfferAcceptedAt) && taxOk && insuranceOk,
    documents: docs,
  };
}

export function taxDocTypeForProfile(
  profile: Pick<InstructorProfile, "taxStatus"> | null,
): ComplianceDocType {
  return profile?.taxStatus === "IP" ? "TAX_STATUS_IP" : "TAX_STATUS_NPD";
}
