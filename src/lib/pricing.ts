/**
 * Sumber kebenaran tunggal untuk harga Careevo.
 *
 * Aturan:
 * - Semua harga katalog dalam IDR. Jangan tulis angka harga langsung di
 *   komponen; ambil dari sini. Dulu "Careevo Plus" muncul Rp342.000 di
 *   /careevo-plus dan Rp99.000 di /loker — dua angka untuk satu produk yang
 *   sama menghancurkan kepercayaan. Sekarang satu angka.
 * - `Plus` = paket belajar massal (anchor untuk pencari kerja).
 *   `Pro` = paket karier berbayar tinggi. Jangan campur nama keduanya.
 * - Tahunan selalu lebih murah per bulan daripada bulanan. Kalau tidak,
 *   tombol tahunan malah merugikan pelanggan dan pesan "hemat" jadi bohong.
 * - Tidak ada harga promo bertenggat di sini. Diskon (mis. uji coba) adalah
 *   keputusan kampanye terpisah, bukan bagian dari harga katalog.
 */

export const MATA_UANG = "IDR";

export const HARGA = {
  /** Gratis: papan loker penuh + Socrates terbatas. */
  gratis: 0,

  /** Careevo Plus — anchor massal pencari kerja. */
  plusBulanan: 99_000,
  plusSemester: 499_000, // 6 bulan, ≈ Rp83.167/bulan
  plusTahunan: 990_000, // hemat 2 bulan, ≈ Rp82.500/bulan

  /** Careevo Pro — Socrates penuh, Fit Score, simulasi interview, bukti HMAC. */
  proBulanan: 199_000,
  proSemester: 995_000, // 6 bulan, ≈ Rp165.833/bulan
  proTahunan: 1_990_000, // hemat 2 bulan

  /** Satu kursus premium, sekali bayar. Sengaja dekat dengan Plus supaya
   *  Plus terlihat lebih untung (decoy), bukan jebakan yang membingungkan. */
  kursusTunggal: 249_000,

  /** Careevo for Teams, minimum 5 kursi. */
  teamsPerKursiBulanan: 149_000,
} as const;

/** "Rp 99.000" */
export function rupiah(nilai: number): string {
  return `Rp ${nilai.toLocaleString("id-ID")}`;
}

/** Harga per bulan bila ditagih tahunan — "Rp 82.500". */
export function perBulanTahunan(tahunan: number): string {
  return rupiah(Math.round(tahunan / 12));
}

/** Persentase hemat tahunan dibanding 12× bulanan, dibulatkan — 17. */
export function hematTahunanPersen(bulanan: number, tahunan: number): number {
  return Math.round((1 - tahunan / (bulanan * 12)) * 100);
}
