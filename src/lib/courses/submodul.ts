import type { Course, Halaman, Modul, Submodul } from "@/types/course";

/**
 * Operasi murni atas sub-modul — bab di dalam sebuah modul.
 *
 * Sama seperti `blok.ts` dan `halaman.ts`: **tidak boleh** menyentuh store atau
 * `node:fs`. Berkas ini ikut masuk bundel klien lewat panel silabus, jadi satu
 * impor `node:*` di sini menjatuhkan build produksi.
 *
 * ## Kenapa halaman tidak lagi menempel langsung di modul
 *
 * Satu modul ("Eloquent, Migrasi, dan Validasi") biasanya berisi beberapa bab,
 * dan tiap bab punya beberapa halaman. Sebelum tingkat sub-modul ada, seluruh
 * halaman menempel pada modul, sehingga silabus tidak bisa menjawab "saya
 * sedang di bagian mana" — dan pertanyaan itu justru pertanyaan pertama saat
 * membaca modul yang panjang.
 *
 * Karena itu `Modul.halaman` digantikan `Modul.submodul[].halaman`, dan berkas
 * ini adalah **satu-satunya** tempat yang tahu cara meratakan kembali pohon itu
 * menjadi daftar halaman berurutan. Pane reader, panel silabus, penomoran
 * halaman, dan navigasi "halaman berikutnya" semuanya memakai fungsi di sini —
 * kalau masing-masing meratakan sendiri, urutannya akan menyimpang tanpa error.
 */

/** Sub-modul sebuah modul, terurut menaik. Modul tanpa sub-modul → `[]`. */
export function submodulUntukModul(modul: Pick<Modul, "submodul">): Submodul[] {
  if (!modul.submodul?.length) return [];
  return [...modul.submodul].sort((a, b) => a.urutan - b.urutan);
}

/** Halaman **satu** sub-modul, terurut menaik. */
export function halamanSubmodul(submodul: Pick<Submodul, "halaman">): Halaman[] {
  if (!submodul.halaman?.length) return [];
  return [...submodul.halaman].sort((a, b) => a.urutan - b.urutan);
}

/**
 * Seluruh halaman modul, diratakan menurut urutan bab lalu urutan halaman.
 *
 * Urutan inilah yang dipakai penomoran "Halaman N" di seluruh UI: nomor
 * halaman adalah **posisi dalam modul**, bukan posisi dalam babnya, karena
 * peserta membaca modul sebagai satu rangkaian, bukan sebagai kumpulan bab yang
 * saling terpisah.
 */
export function halamanModul(modul: Pick<Modul, "submodul">): Halaman[] {
  const hasil: Halaman[] = [];
  for (const sub of submodulUntukModul(modul)) {
    for (const halaman of halamanSubmodul(sub)) hasil.push(halaman);
  }
  return hasil;
}

/** Jumlah seluruh halaman modul — dipakai baris meta dan hitungan silabus. */
export function jumlahHalamanModul(modul: Pick<Modul, "submodul">): number {
  let total = 0;
  for (const sub of modul.submodul ?? []) total += sub.halaman?.length ?? 0;
  return total;
}

/** Cari satu halaman di seluruh modul, atau `null`. */
export function cariHalamanDiModul(
  modul: Pick<Modul, "submodul">,
  halamanId: string,
): Halaman | null {
  return halamanModul(modul).find((h) => h.id === halamanId) ?? null;
}

/**
 * Sub-modul yang memuat sebuah halaman, atau `null`.
 *
 * Dipakai panel silabus untuk membuka bab yang benar saat halaman dibuka lewat
 * deep link (`?halaman=`): tanpa ini, peserta mendarat di halaman yang benar
 * tetapi babnya tertutup, sehingga "kamu di sini" tidak terlihat.
 */
export function submodulUntukHalaman(
  modul: Pick<Modul, "submodul">,
  halamanId: string,
): Submodul | null {
  for (const sub of submodulUntukModul(modul)) {
    if (halamanSubmodul(sub).some((h) => h.id === halamanId)) return sub;
  }
  return null;
}

/**
 * Nomor halaman (1-based) **dalam modul**, atau `null` bila tidak ada.
 *
 * Dihitung dari hasil `halamanModul`, bukan dari `urutan` tersimpan: `urutan`
 * hanya berlaku di dalam babnya, sehingga halaman pertama bab kedua akan
 * berbunyi "1" kalau angka tersimpan dipakai langsung.
 */
export function nomorHalamanModul(
  modul: Pick<Modul, "submodul">,
  halamanId: string,
): number | null {
  const posisi = halamanModul(modul).findIndex((h) => h.id === halamanId);
  return posisi === -1 ? null : posisi + 1;
}

/**
 * Apakah modul ini punya bab (sub-modul) sama sekali?
 *
 * Dipakai UI untuk memilih bentuk: modul tanpa bab dirender seperti sebelum
 * tingkat ini ada (daftar halaman langsung), bukan sebagai satu bab kosong yang
 * mengundang pertanyaan "kok cuma ada satu bagian?".
 */
export function punyaSubmodul(modul: Pick<Modul, "submodul">): boolean {
  return (modul.submodul?.length ?? 0) > 0;
}

/** Judul bawaan bab ke-`urutan` (1-based). */
export function judulSubmodulOtomatis(urutan: number): string {
  return `Bagian ${urutan}`;
}

/**
 * Bentuk modul lama: halaman menempel langsung ke modul.
 *
 * Didefinisikan terpisah, bukan `Modul & { halaman?: Halaman[] }`, karena
 * `Modul` sudah tidak punya `halaman` — irisan seperti itu bertipe `never` pada
 * `halaman` dan setiap aksesnya jadi error tipe. Data dari disk tetap bisa
 * memuatnya, jadi bentuknya dinyatakan sendiri di sini.
 */
interface ModulLama {
  id: string;
  judul: string;
  urutan: number;
  halaman?: Halaman[];
  submodul?: Submodul[];
}

/** Halaman yang masih menempel langsung di modul lama, atau `null`. */
function halamanLangsung(modul: unknown): Halaman[] | null {
  if (typeof modul !== "object" || modul === null) return null;
  const kandidat = modul as Record<string, unknown>;
  return Array.isArray(kandidat.halaman) && kandidat.halaman.length > 0
    ? (kandidat.halaman as Halaman[])
    : null;
}

/**
 * Naikkan modul lama ke bentuk ber-sub-modul.
 *
 * **Idempoten dan deterministik**, dengan pola yang sama seperti
 * `normalisasiHalamanLama` dan `promosiKuisLama`: id bab bawaan diturunkan dari
 * id modul (`sub-<id modul>`), bukan dari waktu, sehingga menjalankan migrasi
 * dua kali menghasilkan id yang sama dan tidak menggandakan bab.
 *
 * Halaman lama dibungkus menjadi **satu** bab. Itu memang kasar — bab yang
 * sebenarnya ("Instalasi", "Relasi", "Validasi") tidak bisa ditebak dari data
 * yang ada, dan menebaknya berarti menuliskan struktur karangan ke kurikulum
 * orang. Admin memecahnya setelahnya; yang penting tidak ada halaman yang
 * hilang dan modul lama tetap terbaca persis seperti sebelumnya.
 *
 * Modul yang sudah punya bab dikembalikan **apa adanya** (referensi yang sama),
 * sehingga tidak memicu penulisan disk tanpa perubahan nyata.
 */
export function normalisasiSubmodulLama(course: Course): Course {
  if (!course.modul?.length) return course;

  const now = new Date().toISOString();
  let berubah = false;

  const modul = course.modul.map((m) => {
    const lama = m as unknown as ModulLama;
    // Sudah punya bab: tidak ada yang dimigrasikan. Sisa `halaman` (kalau ada,
    // mis. berkas hasil sunting tangan) dibiarkan — `halamanModul` hanya membaca
    // lewat sub-modul, jadi halaman yatim itu tidak akan muncul dua kali.
    if (lama.submodul?.length) return m;
    const halamanLama = halamanLangsung(m);
    if (!halamanLama) return m;

    berubah = true;

    const submodul: Submodul = {
      id: `sub-${m.id}`,
      modul_id: m.id,
      course_id: course.id,
      judul: judulSubmodulOtomatis(1),
      ringkasan: "",
      urutan: 1,
      halaman: halamanLama.map((h, index) => ({
        ...h,
        submodul_id: `sub-${m.id}`,
        modul_id: m.id,
        course_id: course.id,
        urutan: index + 1,
      })),
      created_at: now,
      updated_at: now,
    };

    // `halaman` dibuang dari modul: dua tempat menyimpan prosa yang sama akan
    // menyimpang, dan pane reader hanya membaca yang di dalam sub-modul.
    const sisa: Record<string, unknown> = { ...lama };
    delete sisa.halaman;
    return { ...(sisa as unknown as Modul), submodul: [submodul] } as Modul;
  });

  if (!berubah) return course;

  return {
    ...course,
    modul,
    updated_at: now,
  };
}
