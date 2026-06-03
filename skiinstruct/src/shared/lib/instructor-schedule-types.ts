import type { OrderStatus } from "@prisma/client";

/** Промежуток между уроками (минуты). */
export const LESSON_SCHEDULE_GAP_MINUTES = 60;

export const SCHEDULE_GRID_HOUR_START = 6;
export const SCHEDULE_GRID_HOUR_END = 24;

export type WeekScheduleHourCell = {
  hour: number;
  busy: boolean;
  orderIds: string[];
};

export type WeekScheduleDay = {
  ymd: string;
  weekday: number;
  label: string;
  hours: WeekScheduleHourCell[];
};

export type InstructorWeekSchedule = {
  weekStartYmd: string;
  weekEndYmd: string;
  days: WeekScheduleDay[];
  lessons: Array<{
    orderId: string;
    ymd: string;
    fromHm: string;
    toHm: string;
    clientName: string | null;
    status: OrderStatus;
  }>;
};
