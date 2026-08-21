import { prisma } from "@/lib/prisma";
import { markEventRegistrationPaid } from "@/lib/services/event-checkout";
import { fetchYooKassaPayment, isYooKassaConfigured } from "@/lib/yookassa";

export type SyncYooEventPaymentResult = {
  paid: boolean;
  status: string | null;
};

/**
 * Подтвердить оплату записи на событие через API ЮKassa
 * (если webhook не дошёл — задержка сети, фильтр IP и т.п.).
 */
export async function syncYooEventRegistrationPayment(
  registrationId: string,
  clientId: string,
): Promise<SyncYooEventPaymentResult> {
  const reg = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      clientId: true,
      status: true,
      paidAt: true,
      yookassaPaymentId: true,
    },
  });

  if (!reg || reg.clientId !== clientId) {
    throw new Error("Not found");
  }

  if (reg.status === "PAID" || reg.paidAt) {
    return { paid: true, status: reg.status };
  }

  const paymentId = reg.yookassaPaymentId?.trim();
  if (!paymentId) {
    return { paid: false, status: reg.status };
  }

  if (!isYooKassaConfigured()) {
    return { paid: false, status: reg.status };
  }

  const verified = await fetchYooKassaPayment(paymentId);
  if (!verified || verified.status !== "succeeded") {
    return { paid: false, status: reg.status };
  }

  await markEventRegistrationPaid({
    registrationId: reg.id,
    yookassaPaymentId: paymentId,
  });

  const refreshed = await prisma.eventRegistration.findUnique({
    where: { id: reg.id },
    select: { status: true },
  });

  return {
    paid: true,
    status: refreshed?.status ?? null,
  };
}
