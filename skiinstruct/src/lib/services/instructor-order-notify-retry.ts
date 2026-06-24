import { prisma } from "@/lib/prisma";
import { notifyInstructorOfPendingOrder } from "@/lib/services/instructor-order-notify";

/** Повтор push/email, если первая попытка не удалась (нет подписки, сбой сети). */
export async function retryPendingInstructorOrderPush(): Promise<number> {
  const stuck = await prisma.order.findMany({
    where: {
      status: "PENDING_INSTRUCTOR",
      instructorId: { not: null },
      instructorPendingNotifiedAt: null,
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true },
  });

  let sent = 0;
  for (const o of stuck) {
    const ok = await notifyInstructorOfPendingOrder(o.id);
    if (ok) sent += 1;
  }
  return sent;
}
