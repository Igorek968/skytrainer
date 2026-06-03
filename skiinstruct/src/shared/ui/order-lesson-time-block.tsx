import {
  hasOrderLessonActualTime,
  orderLessonActualTimeLine,
} from "@/shared/lib/order-lesson-times";

type OrderLessonTimeBlockProps = {
  order: {
    requestedStartDate?: Date | string | null;
    requestedEndDate?: Date | string | null;
    notes?: string | null;
  };
  className?: string;
  timeClassName?: string;
};

export function OrderLessonTimeBlock({
  order,
  className,
  timeClassName,
}: OrderLessonTimeBlockProps) {
  if (!hasOrderLessonActualTime(order)) return null;
  const line = orderLessonActualTimeLine(order);
  if (!line) return null;
  return (
    <div className={className}>
      <div className={timeClassName}>{line}</div>
    </div>
  );
}
