import type { OrderCancelledBy, OrderStatus } from "@prisma/client";

import { orderCancellationSideText } from "@/shared/lib/order-cancellation";
import { cn } from "@/lib/utils";

type OrderCancellationSideProps = {
  status: OrderStatus;
  cancelledBy?: OrderCancelledBy | null;
  className?: string;
};

export function OrderCancellationSide({ status, cancelledBy, className }: OrderCancellationSideProps) {
  const text = orderCancellationSideText(status, cancelledBy);
  if (!text) return null;
  return <div className={cn("text-muted-foreground", className)}>{text}</div>;
}
