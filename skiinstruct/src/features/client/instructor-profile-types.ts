import type { InstructorTaxStatus } from "@prisma/client";

import type { SpecializationOffer } from "@/lib/instructor-specialization-offers";

export type ClientInstructorListItem = {
  id: string;
  name: string | null;
  taxStatus?: InstructorTaxStatus | null;
  image: string | null;
  photoUrl?: string | null;
  age?: number | null;
  isOnline?: boolean;
  hourlyRate: number;
  lessonsForDiscipline?: number | null;
  ratingAvg: number;
  reviewCount: number;
  languages: string[];
  specializations: string[];
  distanceKm: number;
  lat: number | null;
  lng: number | null;
};

export type ClientInstructorProfileInstructor = {
  id: string;
  name: string | null;
  image: string | null;
  profile: {
    bio: string | null;
    photoUrl: string | null;
    photoGallery: string[];
    certificationLevel: string | null;
    certifications: string[];
    skillLevels: string[];
    languages: string[];
    specializations: string[];
    specializationOffers?: SpecializationOffer[];
    additionalServices: string[];
    offeredDurations: string[];
    availabilitySlots: { day: number; from: string; to: string; busy?: boolean }[];
    age: number | null;
    experienceYears: number | null;
    sportsExperienceYears: number | null;
    totalLessons: number | null;
    hourlyRate: number;
    taxStatus?: InstructorTaxStatus | null;
    ratingAvg: number;
    reviewCount: number;
  };
  stats: {
    completedLessons: number;
    taughtHours: number;
  };
  achievements: string[];
  reviews: {
    id: string;
    rating: number | null;
    text: string | null;
    createdAt: string;
    authorName: string | null;
  }[];
};

export type ClientInstructorProfileResponse = {
  instructor: ClientInstructorProfileInstructor;
};
