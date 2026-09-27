/**
 * Katalog jenis pelanggaran integritas — **murni, client-safe**.
 *
 * Satu daftar, tiga konsumen: CHECK constraint di `schema.ts`, form reviewer,
 * dan tabel report. Kalau bentuk katalog dan bentuk CHECK menyimpang, DB akan
 * menolak nilai yang UI tawarkan — atau menerima nilai yang tidak punya bobot.
 *
 * Yang dikunci di sini:
 *
 * - **Kata vonis tidak boleh muncul di label maupun detail.** Yang dirender dari
 *   katalog adalah *deskripsi catatan*, bukan vonis. Vonis tetap mungkin — tapi
 *   ditulis manusia di kolom `reason` yang disaring, bukan di sini. Batas ini
 *   Batas ini tidak pernah hilang dari repo: ia dijaga `katalog.test.ts` dan
 *   `performa/integritas.test.ts`.
 * - **Bobot berurutan dengan tingkat.** Ringan < sedang < berat. Bobot yang tidak
 *   monoton membuat tabel report menampilkan "berat" di atas "ringan".
 * - **Bobot teringan harus di bawah batas per course** (20, lihat `skor.ts`),
 *   supaya empat pelanggaran ringan di satu course tidak menyamai satu yang berat.
 *
 * Modul ini tidak menyentuh database, `node:fs`, atau `next/headers`, dan tidak
 * punya fungsi yang mengimpor apa pun — aman dari komponen client maupun dari
 * `drizzle-kit`.
 */

/** Tingkat pelanggaran, dari yang paling ringan. Satu sumber untuk bobot & label. */
export const TINGKAT_PELANGGARAN = ["ringan", "sedang", "berat"] as const;
export type TingkatPelanggaran = (typeof TINGKAT_PELANGGARAN)[number];

/**
 * Bentuk nilai untuk `integrity_violations.kind`.
 *
 * Dipisah dari `KATALOG_PELANGGARAN` supaya `schema.ts` bisa membangun CHECK
 * darinya dengan `sql.raw` — interpolasi biasa pada `sql()` menjadi bind
 * parameter, dan CHECK di dalam `CREATE TABLE` tidak boleh memuat parameter
 * (pola yang sama dengan `onboarding_profiles` di `schema.ts`).
 */
export const JENIS_PELANGGARAN = [
  "meninggalkan_sesi",
  "pola_salin_tempel",
  "plagiarisme",
] as const;
export type JenisPelanggaran = (typeof JENIS_PELANGGARAN)[number];

export interface DefinisiPelanggaran {
  jenis: JenisPelanggaran;
  tingkat: TingkatPelanggaran;
  /** Poin penalti, di-snapshot ke baris pelanggaran saat dicatat. */
  bobot: number;
  /** Nama tabel di report. Fakta, bukan vonis. */
  label: string;
  /** Satu kalimat: apa yang tercatat, dan apa yang tidak bisa disimpulkan. */
  detail: string;
}

/**
 * Definisi tiap jenis. Bobot dipilih supaya penalti *bertahap*: satu yang
 * ringan hampir tidak terasa, satu yang berat prohibitif.
 */
export const KATALOG_PELANGGARAN: Record<JenisPelanggaran, DefinisiPelanggaran> = {
  meninggalkan_sesi: {
    jenis: "meninggalkan_sesi",
    tingkat: "ringan",
    bobot: 5,
    label: "Meninggalkan sesi terverifikasi",
    detail: "Halaman ini ditinggalkan saat sesi terverifikasi berjalan. Yang dibuka tidak diketahui.",
  },
  pola_salin_tempel: {
    jenis: "pola_salin_tempel",
    tingkat: "sedang",
    bobot: 10,
    label: "Pola salin-tempel saat asesmen",
    detail: "Bahan ditempel atau disalin dalam jumlah besar saat menjawab asesmen.",
  },
  plagiarisme: {
    jenis: "plagiarisme",
    tingkat: "berat",
    bobot: 20,
    label: "Karya tidak berasal dari peserta",
    detail: "Penyalinan karya orang lain, atau dikerjakan pihak lain, dibuktikan dari isi karya.",
  },
};

/**
 * Definisi satu jenis, atau `null` bila tidak dikenal.
 *
 * `Object.hasOwn` (bukan `in`) supaya nilai tak dikenal tidak mengambil
 * prototipe — lihat `careevo-review` §1. `"toString" in KATALOG_PELANGGARAN`
 * bernilai benar dan mengembalikan fungsi, bukan `undefined`.
 */
export function definisiPelanggaran(jenis: string): DefinisiPelanggaran | null {
  return Object.hasOwn(KATALOG_PELANGGARAN, jenis)
    ? KATALOG_PELANGGARAN[jenis as JenisPelanggaran]
    : null;
}

/** Apakah `jenis` ada di katalog — gerbang sebelum menyentuh database. */
export function jenisPelanggaranValid(jenis: string): jenis is JenisPelanggaran {
  return Object.hasOwn(KATALOG_PELANGGARAN, jenis);
}

/** Katalog sebagai array, untuk merender form pilihan reviewer. */
export const DAFTAR_PELANGGARAN: DefinisiPelanggaran[] = JENIS_PELANGGARAN.map(
  (j) => KATALOG_PELANGGARAN[j],
);
