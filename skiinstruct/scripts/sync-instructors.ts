/**
 * Экспорт / импорт «живых» анкет инструкторов (не demo-skier-*).
 *
 * export: DATABASE_URL=... tsx scripts/sync-instructors.ts export > instructors.json
 * import: DATABASE_URL=... tsx scripts/sync-instructors.ts import instructors.json
 */
import fs from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ProfilePayload = {
  bio: string | null;
  certificationLevel: string | null;
  certifications: string[];
  skillLevels: string[];
  languages: string[];
  hourlyRate: string;
  photoUrl: string | null;
  photoGallery: string[];
  age: number | null;
  experienceYears: number | null;
  sportsExperienceYears: number | null;
  totalLessons: number | null;
  achievements: string[];
  lat: number | null;
  lng: number | null;
  isOnline: boolean;
  verificationStatus: string;
  profileDraft: unknown;
  profileDraftStatus: string;
  profileDraftSubmittedAt: string | null;
  profileDraftRejectNote: string | null;
  profileDraftRejectedAt: string | null;
  specializations: string[];
  specializationOffers: unknown;
  additionalServices: string[];
  offeredDurations: string[];
  availabilitySlots: unknown;
  cancellationPolicy: string | null;
  supportContact: string | null;
  legalInfo: string | null;
  agencyOfferAcceptedAt: string | null;
  agencyOfferVersion: string | null;
  taxStatus: string | null;
  inn: string | null;
  payoutAccountHint: string | null;
  telegramUrl: string | null;
  whatsappUrl: string | null;
  instagramUrl: string | null;
  videoVisitUrl: string | null;
  ratingAvg: number;
  reviewCount: number;
};

type ExportedInstructor = {
  email: string;
  name: string | null;
  phone: string | null;
  image: string | null;
  passwordHash: string | null;
  profile: ProfilePayload;
};

function profilePayload(
  p: NonNullable<
    Awaited<
      ReturnType<
        typeof prisma.user.findMany<{ include: { instructorProfile: true } }>
      >
    >[number]["instructorProfile"]
  >,
): ProfilePayload {
  return {
    bio: p.bio,
    certificationLevel: p.certificationLevel,
    certifications: p.certifications,
    skillLevels: p.skillLevels,
    languages: p.languages,
    hourlyRate: p.hourlyRate.toString(),
    photoUrl: p.photoUrl,
    photoGallery: p.photoGallery,
    age: p.age,
    experienceYears: p.experienceYears,
    sportsExperienceYears: p.sportsExperienceYears,
    totalLessons: p.totalLessons,
    achievements: p.achievements,
    lat: p.lat,
    lng: p.lng,
    isOnline: p.isOnline,
    verificationStatus: p.verificationStatus,
    profileDraft: p.profileDraft,
    profileDraftStatus: p.profileDraftStatus,
    profileDraftSubmittedAt: p.profileDraftSubmittedAt?.toISOString() ?? null,
    profileDraftRejectNote: p.profileDraftRejectNote,
    profileDraftRejectedAt: p.profileDraftRejectedAt?.toISOString() ?? null,
    specializations: p.specializations,
    specializationOffers: p.specializationOffers,
    additionalServices: p.additionalServices,
    offeredDurations: p.offeredDurations,
    availabilitySlots: p.availabilitySlots,
    cancellationPolicy: p.cancellationPolicy,
    supportContact: p.supportContact,
    legalInfo: p.legalInfo,
    agencyOfferAcceptedAt: p.agencyOfferAcceptedAt?.toISOString() ?? null,
    agencyOfferVersion: p.agencyOfferVersion,
    taxStatus: p.taxStatus,
    inn: p.inn,
    payoutAccountHint: p.payoutAccountHint,
    telegramUrl: p.telegramUrl,
    whatsappUrl: p.whatsappUrl,
    instagramUrl: p.instagramUrl,
    videoVisitUrl: p.videoVisitUrl,
    ratingAvg: p.ratingAvg,
    reviewCount: p.reviewCount,
  };
}

function profileCreateInput(row: ProfilePayload): Prisma.InstructorProfileUncheckedCreateWithoutUserInput {
  return {
    ...row,
    hourlyRate: row.hourlyRate,
    profileDraft: row.profileDraft as Prisma.InputJsonValue,
    specializationOffers: row.specializationOffers as Prisma.InputJsonValue,
    availabilitySlots: row.availabilitySlots as Prisma.InputJsonValue,
    profileDraftSubmittedAt: row.profileDraftSubmittedAt
      ? new Date(row.profileDraftSubmittedAt)
      : null,
    profileDraftRejectedAt: row.profileDraftRejectedAt
      ? new Date(row.profileDraftRejectedAt)
      : null,
    agencyOfferAcceptedAt: row.agencyOfferAcceptedAt
      ? new Date(row.agencyOfferAcceptedAt)
      : null,
  };
}

async function exportInstructors(): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      role: "INSTRUCTOR",
      email: { not: { startsWith: "demo-skier-" } },
      instructorProfile: { isNot: null },
    },
    include: { instructorProfile: true },
    orderBy: { email: "asc" },
  });

  const payload: ExportedInstructor[] = users
    .filter((u) => u.instructorProfile)
    .map((u) => ({
      email: u.email,
      name: u.name,
      phone: u.phone,
      image: u.image,
      passwordHash: u.passwordHash,
      profile: profilePayload(u.instructorProfile!),
    }));

  process.stdout.write(JSON.stringify(payload, null, 2));
}

async function importInstructors(filePath: string): Promise<void> {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const payload = JSON.parse(raw) as ExportedInstructor[];

  for (const row of payload) {
    const user = await prisma.user.upsert({
      where: { email: row.email },
      update: {
        name: row.name,
        role: "INSTRUCTOR",
        phone: row.phone,
        image: row.image,
        ...(row.passwordHash ? { passwordHash: row.passwordHash } : {}),
      },
      create: {
        email: row.email,
        name: row.name,
        role: "INSTRUCTOR",
        phone: row.phone,
        image: row.image,
        passwordHash: row.passwordHash,
      },
    });

    const profileData = profileCreateInput(row.profile);

    await prisma.instructorProfile.upsert({
      where: { userId: user.id },
      update: profileData,
      create: {
        userId: user.id,
        ...profileData,
      },
    });

    console.error(`OK ${row.email} -> ${user.id}`);
  }

  console.error(`Imported ${payload.length} instructor(s).`);
}

async function main(): Promise<void> {
  const [cmd, filePath] = process.argv.slice(2);
  if (cmd === "export") {
    await exportInstructors();
    return;
  }
  if (cmd === "import" && filePath) {
    await importInstructors(filePath);
    return;
  }
  console.error("Usage: sync-instructors.ts export | import <file.json>");
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
