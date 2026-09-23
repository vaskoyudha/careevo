import { z } from "zod";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:MM");

export const scheduleSchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    start_time: timeSchema,
    end_time: timeSchema,
    weekly_target_hours: z.number().min(1).max(40),
  })
  .refine((value) => value.start_time < value.end_time, {
    message: "Jam selesai harus setelah jam mulai",
    path: ["end_time"],
  });

export type ScheduleInput = z.infer<typeof scheduleSchema>;
