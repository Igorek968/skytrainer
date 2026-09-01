import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { instructorPublicPath, instructorPublicReviewsPath } from "@/lib/instructor-profile-slug";
import { prisma } from "@/lib/prisma";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd, reviewJsonLd } from "@/lib/seo-schema";
import { canonicalizeActivityLabels } from "@/lib/services/instructor-match";
import { resolveInstructorByPublicKey } from "@/lib/services/instructor-nickname-uniqueness";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

async function loadApproved(publicKey: string) {
  const key = await resolveInstructorByPublicKey(publicKey);
  if (!key) return null;
  return prisma.user.findFirst({
    where: {
      id: key.id,
      role: "INSTRUCTOR",
      instructorProfile: { is: { verificationStatus: "APPROVED" } },
    },
    select: {
      id: true,
      name: true,
      nickname: true,
      profileSlug: true,
      instructorProfile: {
        select: { specializations: true, ratingAvg: true, reviewCount: true },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const instructor = await loadApproved(id);
  if (!instructor?.instructorProfile) {
    return { title: "Отзывы | ТвойТренер.рф" };
  }
  const specs = canonicalizeActivityLabels(instructor.instructorProfile.specializations);
  const sports = specs.slice(0, 2).join(", ") || "тренировки";
  const name = instructor.name || "Инструктор";
  return pageMetadata({
    title: `Отзывы об инструкторе ${name} (${sports}) | ТвойТренер.рф`,
    description: `Отзывы клиентов об инструкторе ${name} на ТвойТренер.рф. Рейтинг ${instructor.instructorProfile.ratingAvg.toFixed(1)}, отзывов: ${instructor.instructorProfile.reviewCount}.`,
    path: instructorPublicReviewsPath(instructor),
  });
}

/** Несуществующий или неодобренный инструктор — HTTP 404. SSR JSON-LD отзывов для поиска и ИИ. */
export default async function InstructorReviewsLayout({ children, params }: LayoutProps) {
  const { id: publicKey } = await params;
  const instructor = await loadApproved(publicKey);

  if (!instructor) {
    notFound();
  }

  if (instructor.profileSlug && publicKey !== instructor.profileSlug) {
    redirect(instructorPublicReviewsPath(instructor));
  }

  const name = instructor.name || "Инструктор";
  const profilePath = instructorPublicPath(instructor);
  const reviewsPath = instructorPublicReviewsPath(instructor);
  const reviews = await prisma.order.findMany({
    where: {
      instructorId: instructor.id,
      status: "COMPLETED",
      clientRating: { not: null },
    },
    select: {
      createdAt: true,
      clientRating: true,
      clientReview: true,
      client: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const schemas: Record<string, unknown>[] = [
    breadcrumbJsonLd([
      { name: "ТвойТренер.рф", path: "/" },
      { name, path: profilePath },
      { name: "Отзывы", path: reviewsPath },
    ]),
    ...reviews
      .filter((r) => r.clientRating != null)
      .map((r) =>
        reviewJsonLd({
          itemName: name,
          itemUrl: profilePath,
          ratingValue: r.clientRating!,
          reviewBody: r.clientReview,
          authorName: r.client.name,
          datePublished: r.createdAt,
        }),
      ),
  ];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          // eslint-disable-next-line react/no-array-index-key 

          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      {children}
    </>
  );
}
