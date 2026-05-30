import type { Prisma } from "@prisma/client";

import {
  mergeProfileDraft,
  parseProfileDraft,
  snapshotProfileToDraft,
  type InstructorProfileDraftPayload,
} from "@/lib/instructor-profile-draft";
import { prisma } from "@/lib/prisma";

type ProfilePhotoRow = {
  verificationStatus: string;
  profileDraft: unknown;
  profileDraftStatus: string;
  photoUrl: string | null;
  photoGallery: string[];
  bio: string | null;
  certificationLevel: string | null;
  certifications: string[];
  skillLevels: string[];
  languages: string[];
  specializations: string[];
  specializationOffers: unknown;
  additionalServices: string[];
  offeredDurations: string[];
  achievements: string[];
  experienceYears: number | null;
  sportsExperienceYears: number | null;
  totalLessons: number | null;
  age: number | null;
  availabilitySlots: unknown;
  cancellationPolicy: string | null;
  supportContact: string | null;
  legalInfo: string | null;
  videoVisitUrl: string | null;
  hourlyRate: unknown;
};

async function savePhotoDraft(
  userId: string,
  profile: ProfilePhotoRow,
  userName: string | null,
  patch: Pick<InstructorProfileDraftPayload, "photoUrl" | "photoGallery">,
) {
  const parsed =
    profile.profileDraftStatus === "PENDING_REVIEW"
      ? parseProfileDraft(profile.profileDraft)
      : null;
  const base = parsed ?? snapshotProfileToDraft(profile, userName);
  const merged = mergeProfileDraft(base, patch);

  await prisma.instructorProfile.update({
    where: { userId },
    data: {
      profileDraft: merged as Prisma.InputJsonValue,
      profileDraftStatus: "PENDING_REVIEW",
      profileDraftSubmittedAt: new Date(),
    },
  });

  return {
    photoUrl: merged.photoUrl ?? null,
    photoGallery: merged.photoGallery ?? [],
    profilePendingReview: true as const,
  };
}

export function effectivePhotoGallery(profile: ProfilePhotoRow, userName: string | null): {
  photoGallery: string[];
  photoUrl: string | null;
} {
  const parsed =
    profile.profileDraftStatus === "PENDING_REVIEW"
      ? parseProfileDraft(profile.profileDraft)
      : null;
  if (parsed?.photoGallery) {
    return { photoGallery: parsed.photoGallery, photoUrl: parsed.photoUrl ?? profile.photoUrl };
  }
  return { photoGallery: profile.photoGallery ?? [], photoUrl: profile.photoUrl };
}

export async function applyInstructorPhotoUpdate(
  userId: string,
  userName: string | null,
  profile: ProfilePhotoRow,
  patch: Pick<InstructorProfileDraftPayload, "photoUrl" | "photoGallery">,
) {
  return savePhotoDraft(userId, profile, userName, patch);
}
