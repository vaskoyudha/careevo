import { z } from "zod";
import { blokListSchema } from "./blok";

/**
 * Skema halaman berformat.
 *
 * `urutan` tidak ada di sini dengan alasan yang sama seperti `modulSchema`:
 * store selalu menomori ulang seluruh daftar, jadi menerimanya dari pemanggil
 * hanya membuka celah nomor berlubang.
 */
export const halamanSchema = z.object({
  judul: z
    .string()
    .trim()
    .min(1, "Judul halaman tidak boleh kosong")
    .max(120, "Judul halaman maksimal 120 karakter"),
  blok: blokListSchema.optional(),
});

export const updateHalamanSchema = halamanSchema;

/** Jumlah halaman yang boleh dibuat sekaligus bersama sebuah modul baru. */
export const BATAS_HALAMAN_PER_MODUL = 50;

/**
 * Skema jumlah halaman saat pembuatan modul.
 *
 * `coerce` supaya nilai dari `<input type="number">` (string) ikut diterima.
 * Bawaan 0 = modul dibuat tanpa halaman; `halamanSchema` di atas mengurus isi
 * halaman setelahnya.
 */
export const jumlahHalamanSchema = z.coerce
  .number()
  .int("Jumlah halaman harus bilangan bulat")
  .min(0, "Jumlah halaman tidak boleh negatif")
  .max(BATAS_HALAMAN_PER_MODUL, `Jumlah halaman maksimal ${BATAS_HALAMAN_PER_MODUL}`);

export type HalamanFormData = z.infer<typeof halamanSchema>;
export type UpdateHalamanFormData = z.infer<typeof updateHalamanSchema>;
