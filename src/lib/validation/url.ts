import { z } from "zod";

/**
 * Skema URL yang hanya menerima `http:` dan `https:`.
 *
 * **Jangan pakai `z.url()` / `z.string().url()`.** Keduanya memvalidasi
 * *bentuk* URL, bukan keamanan protokol: `z.url().safeParse("javascript:alert(1)")`
 * mengembalikan `success: true` di zod v4. URL semacam itu tersimpan lalu
 * dirender ke `<a href>` dan `iframe src`, jadi lubangnya nyata, bukan teoretis.
 *
 * Dipakai untuk `url` kursus dan `url` materi video (embed).
 */
export const skemaUrlHttp = z
  .string()
  .trim()
  .min(1, "URL tidak boleh kosong")
  .refine(
    (nilai) => {
      try {
        const url = new URL(nilai);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL harus diawali http:// atau https://" },
  );
