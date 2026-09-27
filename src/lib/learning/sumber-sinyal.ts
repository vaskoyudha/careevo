import type { KJenisKejadian } from "./akses";

/**
 * Asal-usul tiap sinyal integritas — **murni**.
 *
 * Prinsip P3 di spec 2026-09-27: "keluar tab 3×" (dilaporkan peramban) dan
 * "wajah kedua terdeteksi" (diturunkan model ML) **bukan klaim yang setara**.
 * Menampilkan keduanya sebagai angka yang sama tanpa asal-usulnya membuat
 * pembaca menimbang keduanya sama, dan itu tidak benar.
 *
 * Modul ini tidak boleh mengimpor `node:fs` atau apa pun server-only: label ini
 * dirender di komponen klien (`kamera-izin.tsx`) maupun di halaman laporan staf.
 */

/** Keempat sumber sinyal, dengan tingkat keyakinan yang berbeda. */
export type AsalSinyal = "browser" | "kamera" | "luar" | "server";

export const ASAL_SINYAL: Record<KJenisKejadian, AsalSinyal> = {
  pindah_tab: "browser",
  fokus_hilang: "browser",
  keluar_fullscreen: "browser",
  paste_massal: "browser",
  pintasan_terlarang: "browser",
  salin_terlarang: "browser",
  kamera_mulai: "kamera",
  kamera_berhenti: "kamera",
  kamera_gagal: "kamera",
  wajah_tidak_terdeteksi: "kamera",
  wajah_kedua: "kamera",
  seb_aktif: "luar",
  sesi_dimulai: "server",
  sesi_diakhiri: "server",
};

/**
 * Batas yang wajib ditulis per asal. Satu kalimat pendek, seperti
 * `PERINGATAN_INTEGRITAS`: laporan ini dibaca orang yang sedang menilai, dan
 * kalimat panjang di sana hanya menunda keputusan.
 */
export const BATAS_SINYAL: Record<AsalSinyal, string> = {
  browser:
    "Dilaporkan peramban peserta, jadi bisa dihentikan sepihak dan tidak melihat tab lain.",
  kamera:
    "Dihitung model di perangkat peserta: bisa salah, dan tidak mengidentifikasi siapa pun.",
  luar:
    "Hanya terlihat kalau pengujian benar-benar berjalan di lockdown browser; tanpa itu, tidak ada yang dicek.",
  server:
    "Dihitung server dari yang tercatat; tidak melihat apa pun di luar halaman ini.",
};

/**
 * Asal satu jenis kejadian. `Object.hasOwn` (bukan `in`) supaya nilai tak
 * dikenal tidak mengambil prototipe — lihat `careevo-review` §1.
 */
export function asalSinyal(jenis: KJenisKejadian): AsalSinyal {
  return Object.hasOwn(ASAL_SINYAL, jenis) ? ASAL_SINYAL[jenis] : "server";
}
