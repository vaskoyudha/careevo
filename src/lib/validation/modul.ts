import { z } from "zod";

/**
 * Aturan pengerjaan sebuah modul.
 *
 * `batas_waktu_menit` di-coerce karena datang dari input `number` yang tetap
 * bisa berupa string FormData, sama seperti `durasi_min`. Batas atas 600
 * menjaga sesi tetap terverifikasi wajar: sesi lebih panjang dari itu berarti
 * kehadiran peserta tidak lagi bisa dipertanggungjawabkan.
 *
 * `ref` sengaja bebas (bukan relasi divalidasi di sini): ketersediaan materi
 * kuis/tugas bergantung pada isi modul yang sedang disusun, dan itu baru bisa
 * dicek setelah store memuat modul — bukan tugas skema.
 */
const checkpointSchema = z.object({
  batas_waktu_menit: z.coerce
    .number()
    .int("Batas waktu harus bilangan bulat")
    .min(1, "Batas waktu minimal 1 menit")
    .max(600, "Batas waktu maksimal 600 menit"),
  mode: z.enum(["materi", "kuis", "proyek"]),
  ref: z.string().trim().max(120, "Referensi maksimal 120 karakter").optional(),
});

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
  /**
   * Absen = modul memakai checkpoint default (`materi`, 30 menit) saat
   * dijalankan. Membuat checkpoint opsional di sini menjaga modul lama tetap
   * valid tanpa migrasi.
   */
  checkpoint: checkpointSchema.optional(),
});

export const updateModulSchema = modulSchema.partial();

export type ModulFormData = z.infer<typeof modulSchema>;
export type UpdateModulFormData = z.infer<typeof updateModulSchema>;
