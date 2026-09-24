import { z } from "zod";
import { skemaUrlHttp } from "./url";

export const TIPE_MATERI = ["video", "pdf"] as const;

const judulSchema = z
  .string()
  .trim()
  .min(3, "Judul materi minimal 3 karakter")
  .max(120, "Judul materi maksimal 120 karakter");

/**
 * Skema materi sebagai discriminated union per `tipe`.
 *
 * Union (bukan satu objek dengan banyak field opsional) memaksa payload tiap
 * tipe lengkap dan membuat cabang yang tak dikenal ditolak di gerbang ini,
 * bukan meledak belakangan di store. `updateMateriSchema` sengaja identik:
 * mengganti tipe berarti mengganti payload utuh, bukan menambalnya.
 *
 * Dua varian sudah tidak ada di sini, masing-masing karena punya rumah sendiri:
 * `teks` → halaman berformat (`validation/halaman.ts`), `kuis` → entitas di
 * bank soal (`validation/kuis.ts`). Data lama dari kedua bentuk itu
 * dipromosikan saat dibaca; lihat `normalisasiHalamanLama()` dan
 * `promosiKuisLama()`.
 */
export const materiSchema = z.discriminatedUnion("tipe", [
  z.object({
    tipe: z.literal("video"),
    judul: judulSchema,
    // Pakai skema http/https — bukan `z.url()` yang menerima `javascript:`.
    url: skemaUrlHttp,
    durasi_min: z.coerce
      .number()
      .int("Durasi harus bilangan bulat")
      .min(0, "Durasi tidak boleh negatif"),
  }),
  z.object({
    tipe: z.literal("pdf"),
    judul: judulSchema,
    path: z
      .string()
      .trim()
      .min(1, "Path berkas tidak boleh kosong")
      .max(500, "Path berkas maksimal 500 karakter")
      // Harus berada di folder unggahan kita sendiri. `path` dirender ke
      // `<a href>` dan `<object data>`, jadi tanpa batasan ini sebuah
      // `javascript:` atau URL eksternal bisa diselundupkan lewat form — route
      // unggah hanya memvalidasi berkas yang benar-benar diunggah, bukan nilai
      // yang dikirim ulang ke sini.
      .refine((nilai) => nilai.startsWith("/uploads/") && !nilai.includes(".."), {
        message: "Path berkas harus berada di /uploads/",
      }),
    ukuran_bytes: z.coerce
      .number()
      .int("Ukuran berkas harus bilangan bulat")
      .min(0, "Ukuran berkas tidak boleh negatif"),
  }),
]);

export const updateMateriSchema = materiSchema;

export type MateriFormData = z.infer<typeof materiSchema>;
export type UpdateMateriFormData = z.infer<typeof updateMateriSchema>;
