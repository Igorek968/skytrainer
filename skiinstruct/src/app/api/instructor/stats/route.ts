import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const completed = await prisma.order.findMany({
    where: {
      instructorId: session.user.id,
      status: "COMPLETED",
      paymentStatus: "PAID",
    },
    select: {
      amountTotal: true,
      instructorShareAmount: true,
      platformFeePercent: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const earned = completed.reduce((acc, o) => acc + Number(o.instructorShareAmount ?? 0), 0);
  const gross = completed.reduce((acc, o) => acc + Number(o.amountTotal ?? 0), 0);

  return NextResponse.json({
    orders: completed.length,
    instructorShareTotal: earned,
    grossTotal: gross,
  });
}
