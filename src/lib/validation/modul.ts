import { z } from "zod";

/**
 * Skema modul — dipakai untuk memvalidasi input yang **sudah dirakit** action,
 * bukan `FormData` mentah. Karena itu `urutan` tidak ada di sini: store selalu
 * menaruh modul baru di akhir dan menomori ulang seluruh daftar, sehingga
 * menerimanya dari pemanggil hanya membuka celah nomor berlubang.
 */
export const modulSchema = z.object({
  judul: z
    .string()
    .trim()
    .min(3, "Judul modul minimal 3 karakter")
    .max(120, "Judul modul maksimal 120 karakter"),
  ringkasan: z
    .string()
    .trim()
    .min(10, "Ringkasan minimal 10 karakter")
    .max(500, "Ringkasan maksimal 500 karakter"),
  durasi_min: z.coerce
    .number()
    .int("Durasi harus bilangan bulat")
    .min(1, "Durasi minimal 1 menit")
    .max(10000, "Durasi maksimal 10.000 menit"),
});

export const updateModulSchema = modulSchema.partial();

export type ModulFormData = z.infer<typeof modulSchema>;
export type UpdateModulFormData = z.infer<typeof updateModulSchema>;
