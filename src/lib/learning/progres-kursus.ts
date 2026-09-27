/**
 * Ringkasan progres kursus milik satu principal — **server-only**.
 *
 * Satu baris per enrollment, dengan angka yang sudah dipoles untuk dirender.
 * Halaman `/progres` dan section "Pembelajaran saya" di `/belajar` membaca dari
 * sini, jadi keduanya tidak bisa menampilkan angka berbeda untuk enrollment yang
 * sama.
 *
 * Yang dikunci di sini:
 *
 * - **Modul dari resolver tunggal.** `modulUntukSumber` (modul tersimpan menang,
 *   turunan kalau tidak), persis seperti halaman katalog. `modulKursus()` tidak
 *   pernah dipanggil langsung.
 * - **Id modul basi tidak menambah apa pun.** `irisModulSelesai` menyaring
 *   hanya id yang masih ada di kurikulum saat ini, jadi satu baris lama tidak
 *   bisa membuat angka 5/5 pada kursus yang kini hanya punya 3 modul.
 * - **Progres diturunkan, tidak disimpan.** `hitungProgres` membulatkan dan
 *   menjepit ke 0–100; tidak ada kolom `progress` yang bisa berbeda dengan
 *   `module_progress`.
 * - **Angka hanya dari database.** `progresKursusDb` memuat ulang enrollment
 *   milik principal dan mengembalikan id modul yang benar-benar `completed` di
 *   sana. Tidak ada angka yang datang dari peramban.
 * - **Enrollment yang kursusnya hilang dari katalog dilewati**, bukan dirender
 *   dengan `course_id` mentah: entri yang tidak bisa dibuka peserta bukan laporan
 *   progres.
 * - **Urutan mengikuti enrollment** (paling baru dulu, dari repository), bukan
 *   diurutkan ulang di sini, supaya `/belajar` dan `/progres` menampilkan urutan
 *   yang sama.
 *
 * Nama fungsi bisnis berbahasa Indonesia; tipe dan helper infrastruktur tetap
 * Inggris.
 */

import type { SessionPrincipal } from "@/lib/auth/principal";
import { katalogBelajar, type EntriKatalog } from "@/lib/courses/katalog";
import { hitungProgres, irisModulSelesai } from "@/lib/courses/kurikulum";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { listKursusTerdaftarDb, progresKursusDb } from "@/lib/learning/service";

/**
 * Satu kursus yang diikuti peserta, beserta progresnya.
 *
 * `entri` dibawa apa adanya dari katalog, bukan field yang sudah dipilih satu per
 * satu: halaman memakai `title`/`provider` untuk label dan `courseMetaFor` untuk
 * sampul, sehingga kartu progres memakai sumber sampul yang sama dengan
 * `/belajar` dan `/jelajah` — termasuk aturan "unggahan admin menang atas
 * thumbnail bawaan".
 */
export interface ProgresKursus {
  entri: EntriKatalog;
  /** Persen 0–100, sudah dibulatkan dan dijepit. */
  progres: number;
  /** Jumlah modul selesai yang id-nya masih valid di kurikulum saat ini. */
  selesai: number;
  /** Jumlah modul kurikulum kursus ini saat ini. */
  total: number;
}

/**
 * Progres seluruh kursus yang diikuti `principal`.
 *
 * `katalog` opsional: berikan bila pemanggil sudah memuatnya (halaman katalog
 * membutuhkannya untuk merender daftarnya), supaya katalog tidak dibaca dua
 * kali. Kalau tidak, katalog dimuat di sini — `katalogBelajar` sendiri
 * di-cache per proses, jadi pemanggilan kedua tidak membaca disk lagi.
 */
export async function listProgresKursus(
  principal: SessionPrincipal,
  katalog?: EntriKatalog[],
): Promise<ProgresKursus[]> {
  const entries = katalog ?? (await katalogBelajar());
  const enrollments = await listKursusTerdaftarDb(principal);

  const hasil: ProgresKursus[] = [];
  // `for...of` yang ber-`await`, bukan `.flatMap()`: resolver modul async
  // sehingga tidak bisa dipanggil dari callback sinkron.
  for (const enrollment of enrollments) {
    const kursus = entries.find((item) => item.id === enrollment.courseId);
    if (!kursus) continue;

    const modul = await modulUntukSumber({
      id: kursus.id,
      title: kursus.title,
      tags: kursus.tags,
      duration_min: kursus.duration_min,
      url: kursus.url,
    });
    const { selesai: idSelesai } = await progresKursusDb(principal, enrollment.courseId);
    const selesai = irisModulSelesai(idSelesai, modul);

    hasil.push({
      entri: kursus,
      progres: hitungProgres(selesai.length, modul.length),
      selesai: selesai.length,
      total: modul.length,
    });
  }

  return hasil;
}
