import { z } from "zod";

/**
 * Skema bab (sub-modul).
 *
 * `urutan` tidak ada di sini dengan alasan yang sama seperti `modulSchema`:
 * store selalu menaruh bab baru di akhir dan menomori ulang seluruh daftarnya,
 * jadi menerimanya dari pemanggil hanya membuka celah nomor berlubang.
 *
 * `ringkasan` **opsional** — berbeda dari `modulSchema` yang mewajibkannya.
 * Sebuah bab sering hanya perlu judul ("Instalasi", "Relasi"); memaksa satu
 * kalimat ringkasan untuk setiap bab membuat admin menulis kalimat yang tidak
 * dibaca siapa pun, dan yang tidak dibaca akan diisi asal.
 */
export const submodulSchema = z.object({
  judul: z
    .string()
    .trim()
    .min(2, "Judul bab minimal 2 karakter")
    .max(120, "Judul bab maksimal 120 karakter"),
  ringkasan: z
    .string()
    .trim()
    .max(300, "Ringkasan maksimal 300 karakter")
    .optional()
    .or(z.literal("")),
});

export const updateSubmodulSchema = submodulSchema.partial();

export type SubmodulFormData = z.infer<typeof submodulSchema>;
export type UpdateSubmodulFormData = z.infer<typeof updateSubmodulSchema>;
