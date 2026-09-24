import { z } from "zod";

/**
 * Skema kuis sebagai entitas asesmen.
 *
 * Dulu soal kuis divalidasi sebagai bagian dari `materiSchema`. Sejak kuis
 * berdiri sendiri, aturannya tinggal di sini dan dipakai bersama oleh form
 * bank soal — satu tempat untuk batas jumlah soal, bentuk pilihan, dan rentang
 * nilai lulus.
 */

/** Batas jumlah soal satu kuis. Menjaga muatan aksi dan panjang halaman tetap wajar. */
const MAKS_SOAL_PER_KUIS = 100;

/** Batas jumlah pilihan per soal — cukup untuk pilihan ganda, bukan untuk daftar panjang. */
const MAKS_PILIHAN_PER_SOAL = 10;

/** Batas panjang teks satu pertanyaan dan satu pilihan. */
const MAKS_PERTANYAAN = 2000;
const MAKS_PILIHAN = 500;

/**
 * Skema satu soal.
 *
 * `jawaban_benar` adalah indeks ke `pilihan`, jadi batas atasnya baru diketahui
 * setelah array-nya ikut terurai — `max()` tidak bisa menyatakannya, dan itulah
 * sebabnya pemeriksaannya lewat `refine`.
 */
export const soalKuisSchema = z
  .object({
    id: z.string().trim().min(1, "ID soal tidak boleh kosong").max(120),
    pertanyaan: z
      .string()
      .trim()
      .min(3, "Pertanyaan minimal 3 karakter")
      .max(MAKS_PERTANYAAN, "Pertanyaan terlalu panjang"),
    pilihan: z
      .array(z.string().trim().min(1, "Pilihan tidak boleh kosong").max(MAKS_PILIHAN))
      .min(2, "Setiap soal minimal memiliki 2 pilihan")
      .max(MAKS_PILIHAN_PER_SOAL, `Maksimal ${MAKS_PILIHAN_PER_SOAL} pilihan per soal`),
    jawaban_benar: z.coerce
      .number()
      .int("Indeks jawaban benar harus bilangan bulat")
      .min(0, "Indeks jawaban benar tidak boleh negatif"),
  })
  .refine((soal) => soal.jawaban_benar < soal.pilihan.length, {
    message: "Indeks jawaban benar berada di luar rentang pilihan",
    path: ["jawaban_benar"],
  })
  // Dua pilihan dengan teks sama membuat soal tidak punya jawaban yang jelas:
  // peserta bisa memilih yang mana pun dan salah satunya dihitung benar.
  .refine((soal) => new Set(soal.pilihan).size === soal.pilihan.length, {
    message: "Pilihan tidak boleh ada yang sama",
    path: ["pilihan"],
  });

/**
 * Bidang bersama, **tanpa** nilai bawaan.
 *
 * Bawaan sengaja tidak dipasang di sini. `updateKuisSchema` diturunkan dari
 * objek ini lewat `partial()`, dan `partial()` tidak menghapus `.default()`:
 * bila bawaan dipasang di sini, menyunting judul kuis akan ikut mengisi
 * `nilai_lulus` dengan 70 dan menimpa nilai lulus yang sudah disetel admin.
 * Bawaan hanya boleh berlaku pada jalur pembuatan — lihat di bawah.
 */
const bidangKuis = {
  judul: z
    .string()
    .trim()
    .min(3, "Judul kuis minimal 3 karakter")
    .max(120, "Judul kuis maksimal 120 karakter"),
  deskripsi: z.string().trim().max(500, "Deskripsi maksimal 500 karakter").optional(),
  soal: z
    .array(soalKuisSchema)
    .min(1, "Kuis minimal memiliki 1 soal")
    .max(MAKS_SOAL_PER_KUIS, `Maksimal ${MAKS_SOAL_PER_KUIS} soal per kuis`),
  nilai_lulus: z.coerce
    .number()
    .int("Nilai lulus harus bilangan bulat")
    .min(0, "Nilai lulus tidak boleh negatif")
    .max(100, "Nilai lulus maksimal 100")
    .optional(),
};

/** Skema pembuatan kuis — di sini bawaan boleh mengisi field yang tidak dikirim. */
export const kuisSchema = z.object({
  ...bidangKuis,
  deskripsi: bidangKuis.deskripsi.default(""),
  nilai_lulus: bidangKuis.nilai_lulus.default(70),
});

/**
 * Skema perubahan kuis.
 *
 * `partial()` supaya penyuntingan bisa menyentuh satu field saja — mis. hanya
 * mengganti judul tanpa mengirim ulang seluruh daftar soal. Bentuk `soal` yang
 * dikirim tetap divalidasi penuh, jadi "sebagian" berlaku antar-field, bukan
 * di dalam sebuah soal yang setengah terisi.
 *
 * Tanpa nilai bawaan, field yang tidak dikirim tetap `undefined` dan store
 * mempertahankan nilai lamanya — bukan mengosongkannya.
 */
export const updateKuisSchema = z.object(bidangKuis).partial();

export type KuisFormData = z.infer<typeof kuisSchema>;
export type UpdateKuisFormData = z.infer<typeof updateKuisSchema>;
export type SoalKuisFormData = z.infer<typeof soalKuisSchema>;
