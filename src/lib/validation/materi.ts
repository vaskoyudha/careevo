import { z } from "zod";
import { skemaUrlHttp } from "./url";

export const TIPE_MATERI = ["video", "pdf", "kuis"] as const;

const judulSchema = z
  .string()
  .trim()
  .min(3, "Judul materi minimal 3 karakter")
  .max(120, "Judul materi maksimal 120 karakter");

const soalKuisSchema = z
  .object({
    id: z.string(),
    pertanyaan: z
      .string()
      .trim()
      .min(3, "Pertanyaan minimal 3 karakter"),
    pilihan: z
      .array(z.string().trim().min(1, "Pilihan tidak boleh kosong"))
      .min(2, "Setiap soal minimal memiliki 2 pilihan"),
    jawaban_benar: z.coerce
      .number()
      .int("Indeks jawaban benar harus bilangan bulat")
      .min(0, "Indeks jawaban benar tidak boleh negatif"),
  })
  // `jawaban_benar` adalah indeks ke `pilihan`, jadi batas atasnya baru diketahui
  // setelah array-nya ikut terurai — `max()` tidak bisa menyatakannya.
  .refine((soal) => soal.jawaban_benar < soal.pilihan.length, {
    message: "Indeks jawaban benar berada di luar rentang pilihan",
    path: ["jawaban_benar"],
  });

/**
 * Skema materi sebagai discriminated union per `tipe`.
 *
 * Union (bukan satu objek dengan banyak field opsional) memaksa payload tiap
 * tipe lengkap dan membuat cabang yang tak dikenal ditolak di gerbang ini,
 * bukan meledak belakangan di store. `updateMateriSchema` sengaja identik:
 * mengganti tipe berarti mengganti payload utuh, bukan menambalnya.
 *
 * Varian `teks` sudah tidak ada: prosa kini ditulis sebagai halaman berformat
 * (`validation/halaman.ts`). Materi `teks` yang tersimpan dari versi lama
 * dipromosikan menjadi halaman saat dibaca — lihat `normalisasiHalamanLama()`.
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
  z.object({
    tipe: z.literal("kuis"),
    judul: judulSchema,
    soal: z.array(soalKuisSchema).min(1, "Kuis minimal memiliki 1 soal"),
    nilai_lulus: z.coerce
      .number()
      .int("Nilai lulus harus bilangan bulat")
      .min(0, "Nilai lulus tidak boleh negatif")
      .max(100, "Nilai lulus maksimal 100"),
  }),
]);

export const updateMateriSchema = materiSchema;

export type MateriFormData = z.infer<typeof materiSchema>;
export type UpdateMateriFormData = z.infer<typeof updateMateriSchema>;
