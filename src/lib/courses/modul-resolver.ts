import { getCourseById, listKuis } from "./store";
import { modulKursus, type ModulKursus, type SumberModul } from "./kurikulum";
import { kuisUntukModul } from "./kuis";
import type { Kuis, Modul } from "@/types/course";

/**
 * Resolver modul — **hanya untuk server**.
 *
 * Modul `kurikulum.ts` sengaja tetap murni (tanpa IO) karena juga diimpor
 * komponen klien seperti `detail-kursus.tsx`. Resolver di sini menyentuh store,
 * yang menarik `node:fs`, sehingga tempatnya bukan di sana: menaruhnya di
 * `kurikulum.ts` membuat bundel klien memuat `node:fs/promises` dan build
 * produksi Turbopack gagal dengan "chunking context does not support external
 * modules".
 */

/**
 * Ubah modul tersimpan menjadi `ModulKursus` yang dipakai UI learner.
 *
 * Modul tersimpan tidak membawa `url` sendiri (materi yang punya), jadi `url`
 * kursus induknya diisikan di sini — sama seperti modul turunan.
 *
 * `bank` diteruskan, bukan dibaca di sini, supaya bank soal hanya dimuat sekali
 * untuk seluruh kursus — bukan sekali per modul.
 */
function dariTersimpan(modul: Modul[], urlKursus: string, bank: Kuis[]): ModulKursus[] {
  return [...modul]
    .sort((a, b) => a.urutan - b.urutan)
    .map((m) => ({
      id: m.id,
      judul: m.judul,
      ringkasan: m.ringkasan,
      durasi_min: m.durasi_min,
      url: urlKursus,
      materi: [...(m.materi ?? [])].sort((a, b) => a.urutan - b.urutan),
      // Halaman ikut dibawa karena prosa kini tinggal di sana; tanpa ini,
      // modul tersimpan akan tampak kosong di halaman belajar walau sudah diisi.
      halaman: [...(m.halaman ?? [])].sort((a, b) => a.urutan - b.urutan),
      // Id kuis diresolusi ke entri banknya di sini. Id yatim (kuisnya sudah
      // dihapus) otomatis gugur lewat `kuisUntukModul`, jadi UI tidak pernah
      // menerima referensi yang tidak bisa dirender.
      kuis: kuisUntukModul(m, bank),
    }));
}

/**
 * Sumber tunggal kebenaran modul untuk sebuah kursus.
 *
 * Modul **tersimpan** menang bila ada; kalau tidak, jatuh ke `modulKursus()`
 * yang menurunkan 5 modul dengan id lama (`${id}-m1`). Dua cabang ini sengaja
 * dibedakan supaya:
 *
 * - Kursus yang belum pernah diedit admin tetap memakai id lama, sehingga
 *   progres di cookie `ls_enroll` milik pengguna nyata tetap terbaca.
 * - `actions/enrollment.test.ts` yang menandai id literal `crs-1-m1` tetap lulus.
 *
 * Kursus yang sudah dimigrasikan ke modul tersimpan memakai id baru; progres
 * lamanya dibuang dengan aman oleh `irisModulSelesai` (perilaku teruji).
 */
export async function modulUntuk(courseId: string): Promise<ModulKursus[]> {
  const kursus = await getCourseById(courseId);
  if (!kursus) return [];
  return modulUntukSumber({
    id: kursus.id,
    title: kursus.title,
    tags: kursus.tags,
    duration_min: kursus.duration_min,
    url: kursus.url,
  });
}

/**
 * Varian `modulUntuk` untuk entri katalog yang mungkin berupa fixture.
 *
 * Entri fixture tidak punya modul tersimpan, jadi selalu memakai cabang turunan
 * — tetapi lewat satu jalur agar keempat pemanggil lama tidak lagi membangun
 * modul sendiri-sendiri.
 */
export async function modulUntukSumber(sumber: SumberModul): Promise<ModulKursus[]> {
  const kursus = await getCourseById(sumber.id);
  if (kursus?.modul && kursus.modul.length > 0) {
    return dariTersimpan(kursus.modul, kursus.url, await listKuis());
  }
  return modulKursus(sumber);
}
