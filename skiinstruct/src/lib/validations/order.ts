import { z } from "zod";

/**
 * HTML `<input type="time">` в части браузеров отдаёт `HH:MM:SS` (иногда с долями секунды),
 * а не только `HH:MM` — без нормализации Zod отклонял тело POST /api/orders.
 */
const lessonClockHmSchema = z
  .string()
  .transform((s) => {
    const m = s.trim().match(/^(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : s.trim();
  })
  .pipe(z.string().regex(/^\d{2}:\d{2}$/, "Некорректное время"));

/** JSON иногда присылает `null` вместо отсутствия ключа — optional() это не принимает. */
const optionalClockHm = z.preprocess(
  (v) => (v === null || v === undefined || v === "" ? undefined : v),
  lessonClockHmSchema.optional(),
);

export const createOrderSchema = z
  .object({
    meetLat: z.coerce.number().min(-90).max(90),
    meetLng: z.coerce.number().min(-180).max(180),
    skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
    languagePref: z.string().min(1).max(64),
    duration: z.enum(["ONE_HOUR", "TWO_HOURS", "HALF_DAY", "FULL_DAY"]),
    notes: z.string().max(2000).optional(),
    lessonDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    lessonEndDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    lessonDays: z.preprocess(
      (v) => (v === null || v === undefined || v === "" ? undefined : v),
      z.coerce.number().int().min(1).max(30).optional(),
    ),
    /** Время начала в день начала (ЧЧ:ММ). */
    lessonStartTime: optionalClockHm,
    /** Время окончания в день окончания (ЧЧ:ММ). */
    lessonEndTime: optionalClockHm,
    resortId: z.preprocess(
      (v) => (v === null || v === undefined || v === "" ? undefined : v),
      z.string().cuid().optional(),
    ),
    instructorId: z.preprocess(
      (v) => (v === null || v === undefined || v === "" ? undefined : v),
      z.string().cuid().optional(),
    ),
    /** Запись на дату: показывать офлайн-инструкторов, без таймера ответа после оплаты. */
    flexibleInstructorInvite: z.preprocess((v) => {
      if (v === true || v === "true" || v === 1 || v === "1") return true;
      if (v === false || v === "false" || v === 0 || v === "0") return false;
      return v;
    }, z.boolean().optional().default(false)),
  })
  .refine(
    (d) => {
      if (!d.lessonDate || !d.lessonEndDate) return true;
      const t0 = d.lessonStartTime ?? "09:00";
      const t1 = d.lessonEndTime ?? "18:00";
      if (d.lessonDate < d.lessonEndDate) return true;
      if (d.lessonDate > d.lessonEndDate) return false;
      return t0 < t1;
    },
    {
      message: "В один день время окончания должно быть позже времени начала",
      path: ["lessonEndTime"],
    },
  );

export const orderActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("accept"),
    etaMinutes: z.number().int().min(1).max(240).optional(),
  }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("en_route") }),
  z.object({ action: z.literal("start_lesson") }),
  z.object({ action: z.literal("complete_lesson") }),
  z.object({
    action: z.literal("add_review"),
    rating: z.number().int().min(1).max(5),
    review: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("add_client_review"),
    rating: z.number().int().min(1).max(5),
    review: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("set_payment_cash"),
  }),
  z.object({
    action: z.literal("set_eta"),
    etaMinutes: z.number().int().min(1).max(240),
  }),
  z.object({
    action: z.literal("request_instructor"),
    instructorId: z.string().cuid(),
    flexibleInstructorInvite: z.boolean().optional(),
  }),
]);

export const messageSchema = z.object({
  body: z.string().min(1).max(4000),
});
