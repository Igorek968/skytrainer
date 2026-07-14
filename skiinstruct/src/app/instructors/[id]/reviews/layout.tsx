import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { pageMetadata } from "@/lib/seo";
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

/** Несуществующий или неодобренный инструктор — HTTP 404. */
export default async function InstructorReviewsLayout({ children, params }: LayoutProps) {
  const { id } = await params;

  const instructor = await prisma.user.findFirst({
    where: {
      id,
      role: "INSTRUCTOR",
      instructorProfile: { is: { verificationStatus: "APPROVED" } },
    },
    select: { id: true },
  });

  if (!instructor) {
    notFound();
  }

  return children;
}
