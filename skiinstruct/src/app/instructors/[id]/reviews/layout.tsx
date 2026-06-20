import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

/** Несуществующий или неодобренный инструктор — HTTP 404, не пустая страница с кодом 200. */
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
