import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.order.aggregate({
    where: { paymentStatus: "PAID" },
    _count: { _all: true },
    _sum: { amountTotal: true, instructorShareAmount: true },
  });

  console.log("Before:", {
    paidOrders: before._count._all,
    gross: before._sum.amountTotal?.toString() ?? "0",
    instructorShare: before._sum.instructorShareAmount?.toString() ?? "0",
  });

  const reset = await prisma.order.updateMany({
    where: { paymentStatus: "PAID" },
    data: {
      paymentStatus: "PENDING",
      amountTotal: null,
      instructorShareAmount: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      yookassaPaymentId: null,
      instructorPayoutReleasedAt: null,
      payoutEligibleAt: null,
    },
  });

  console.log("Reset orders:", reset.count);

  const deletedPayments = await prisma.payment.deleteMany({ where: { status: "PAID" } });
  console.log("Deleted payments:", deletedPayments.count);

  const deletedPayouts = await prisma.instructorPayoutRequest.deleteMany({});
  console.log("Deleted payout requests:", deletedPayouts.count);

  const deletedPenalties = await prisma.instructorPlatformPenalty.deleteMany({});
  console.log("Deleted penalties:", deletedPenalties.count);

  const after = await prisma.order.aggregate({
    where: { paymentStatus: "PAID" },
    _count: { _all: true },
    _sum: { amountTotal: true, instructorShareAmount: true },
  });

  console.log("After:", {
    paidOrders: after._count._all,
    gross: after._sum.amountTotal?.toString() ?? "0",
    instructorShare: after._sum.instructorShareAmount?.toString() ?? "0",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
