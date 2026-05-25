import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const instructors = await prisma.user.findMany({
  where: { role: "INSTRUCTOR" },
  select: {
    id: true,
    name: true,
    email: true,
    instructorProfile: {
      select: {
        verificationStatus: true,
        isOnline: true,
        lat: true,
        lng: true,
        agencyOfferAcceptedAt: true,
        taxStatus: true,
      },
    },
  },
});

const docs = await prisma.instructorComplianceDocument.findMany({
  orderBy: { createdAt: "desc" },
});

for (const u of instructors) {
  const p = u.instructorProfile;
  const userDocs = docs.filter((d) => d.userId === u.id);
  const approved = new Set(userDocs.filter((d) => d.status === "APPROVED").map((d) => d.type));
  const taxOk =
    p?.taxStatus === "IP"
      ? approved.has("TAX_STATUS_IP") || approved.has("TAX_STATUS_NPD")
      : approved.has("TAX_STATUS_NPD") || approved.has("TAX_STATUS_IP");
  const insuranceOk = approved.has("INSURANCE");
  const canGoOnline =
    p?.verificationStatus === "APPROVED" &&
    Boolean(p?.agencyOfferAcceptedAt) &&
    taxOk &&
    insuranceOk;

  console.log(
    JSON.stringify({
      email: u.email,
      name: u.name,
      verification: p?.verificationStatus,
      isOnline: p?.isOnline,
      lat: p?.lat,
      lng: p?.lng,
      agencyOffer: Boolean(p?.agencyOfferAcceptedAt),
      taxOk,
      insuranceOk,
      canGoOnline,
    }),
  );
}

await prisma.$disconnect();
