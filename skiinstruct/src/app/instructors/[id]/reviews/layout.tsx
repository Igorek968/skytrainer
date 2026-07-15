import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd, reviewJsonLd } from "@/lib/seo-schema";
import { canonicalizeActivityLabels } from "@/lib/services/instructor-match";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const instructor = await prisma.user.findFirst({
    where: {
      id,
      role: "INSTRUCTOR",
      instructorProfile: { is: { verificationStatus: "APPROVED" } },
    },
    select: {
      name: true,
      instructorProfile: {
        select: { specializations: true, ratingAvg: true, reviewCount: true },
      },
    },
  });
  if (!instructor?.instructorProfile) {
    return { title: "Отзывы | ТвойТренер.рф" };
  }
  const specs = canonicalizeActivityLabels(instructor.instructorProfile.specializations);
  const sports = specs.slice(0, 2).join(", ") || "тренировки";
  const name = instructor.name || "Инструктор";
  return pageMetadata({
    title: `Отзывы об инструкторе ${name} (${sports}) | ТвойТренер.рф`,
    description: `Отзывы клиентов об инструкторе ${name} на ТвойТренер.рф. Рейтинг ${instructor.instructorProfile.ratingAvg.toFixed(1)}, отзывов: ${instructor.instructorProfile.reviewCount}.`,
    path: `/instructors/${id}/reviews`,
  });
}

/** Несуществующий или неодобренный инструктор — HTTP 404. SSR JSON-LD отзывов для поиска и ИИ. */
export default async function InstructorReviewsLayout({ children, params }: LayoutProps) {
  const { id } = await params;

  const instructor = await prisma.user.findFirst({
    where: {
      id,
      role: "INSTRUCTOR",
      instructorProfile: { is: { verificationStatus: "APPROVED" } },
    },
    select: { id: true, name: true },
  });

  if (!instructor) {
    notFound();
  }

  const name = instructor.name || "Инструктор";
  const reviews = await prisma.order.findMany({
    where: {
      instructorId: id,
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
      { name, path: `/instructors/${id}` },
      { name: "Отзывы", path: `/instructors/${id}/reviews` },
    ]),
    ...reviews
      .filter((r) => r.clientRating != null)
      .map((r) =>
        reviewJsonLd({
          itemName: name,
          itemUrl: `/instructors/${id}`,
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
