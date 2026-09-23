import { z } from "zod";

export const TRACKS = ["web-dev", "data", "game-dev", "cyber-sec"] as const;
export const LEVELS = ["dasar", "menengah", "lanjut"] as const;
export const COURSE_TYPES = ["course", "video", "artikel", "bootcamp"] as const;
export const COURSE_STATUSES = ["published", "draft", "archived"] as const;

export const courseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Judul kursus minimal 3 karakter")
    .max(120, "Judul kursus maksimal 120 karakter"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung")
    .optional(),
  description: z
    .string()
    .trim()
    .min(10, "Deskripsi minimal 10 karakter")
    .max(1000, "Deskripsi maksimal 1000 karakter"),
  provider: z
    .string()
    .trim()
    .min(2, "Provider / Penyelenggara minimal 2 karakter")
    .max(80, "Provider maksimal 80 karakter"),
  type: z
    .enum(COURSE_TYPES, {
      message: "Tipe harus salah satu dari: course, video, artikel, bootcamp",
    })
    .default("course"),
  track: z
    .enum(TRACKS, {
      message: "Jalur harus salah satu dari: web-dev, data, game-dev, cyber-sec",
    })
    .default("web-dev"),
  level: z
    .enum(LEVELS, {
      message: "Tingkat harus salah satu dari: dasar, menengah, lanjut",
    })
    .default("dasar"),
  tags: z
    .union([
      z.array(z.string()),
      z.string().transform((val) =>
        val
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ])
    .default([]),
  url: z
    .string()
    .trim()
    .min(1, "URL tidak boleh kosong"),
  duration_min: z.coerce
    .number()
    .int("Durasi harus bilangan bulat")
    .min(1, "Durasi minimal 1 menit")
    .max(10000, "Durasi maksimal 10.000 menit"),
  is_free: z.boolean().default(true),
  price: z.coerce
    .number()
    .min(0, "Harga tidak boleh negatif")
    .default(0),
  status: z
    .enum(COURSE_STATUSES, {
      message: "Status harus salah satu dari: published, draft, archived",
    })
    .default("published"),
});

export const updateCourseSchema = courseSchema.partial();

export type CourseFormData = z.infer<typeof courseSchema>;
export type UpdateCourseFormData = z.infer<typeof updateCourseSchema>;
