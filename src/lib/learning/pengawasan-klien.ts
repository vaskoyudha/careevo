/**
 * Klasifikasi sinyal browser untuk pemantauan anti-curang — **murni**.
 *
 * Modul ini tidak menyentuh DOM, `window`, `document`, `node:fs`, atau
 * `next/headers`. Ia hanya menerima angka dan bentuk peristiwa, lalu
 * memutuskan apakah peristiwa itu layak dicatat sebagai kejadian integritas.
 *
 * **Mengapa logikanya di sini, bukan di dalam `addEventListener`.** Repo ini
 * tidak punya harness render (Vitest `include` persis `src` dengan akhiran `.test.ts`,
 * environment `node`, tanpa jsdom), jadi logika yang hanya hidup di dalam
 * event listener tidak pernah diuji — persis kelas defect yang hilang dari diff
 * dan hanya terlihat di peramban. Ambang dan daftar kombinasi adalah keputusan
 * bisnis, jadi ia harus bisa diuji tanpa browser.
 *
 * **Sinyal di sini adalah self-report.** Peramban peserta yang mengirimi
 * peristiwa-peristiwa ini bisa dimatikan melekat di peramban peserta. Karena itu tidak
 * satu pun dari sinyal ini boleh dipakai untuk menghukum: semuanya konteks
 * untuk ditinjau manusia.
 */

/** Panjang minimum (karakter) paste/salin yang dianggap bukan mengetik sendiri. */
export const AMBANG_PASTE_MINIMAL = 200;

/** Tombol yang dipetakan ke nama kanonik untuk payload. */
const NAMA_TOMBOL: Record<string, string> = {
  c: "c", v: "v", x: "x", s: "s", p: "p", a: "a", tab: "tab",
};

/**
 * Kombinasi yang paling sering dipakai membawa jawaban ke luar dari halaman
 * ujian: salin, tempel, potong, cetak layar, dan pindah jendela.
 */
export const PINTAKAN_TERLARANG: readonly string[] = ["c", "v", "x", "s", "p", "a", "tab"];

/**
 * Jeda "tidak diketahui" saat belum ada ketikan sama sekali.
 *
 * Angka besar, bukan nol: menempel 400 karakter tanpa pernah mengetik di
 * halaman itu bukan menulis. Menitipkan `0` akan membaca sebaliknya.
 */
export const JEDA_TIDAK_DIKETAHUI = 9999;

export interface SinyalFullscreen {
  jenis: "keluar_fullscreen";
  jumlah_keluar: number;
}
export interface SinyalPaste {
  jenis: "paste_massal";
  panjang: number;
  sejak_mengetik_detik: number;
}
export interface SinyalPintasan {
  jenis: "pintasan_terlarang";
  kombinasi: string;
}
export interface SinyalSalin {
  jenis: "salin_terlarang";
  panjang: number;
}

export type SinyalBrowser = SinyalFullscreen | SinyalPaste | SinyalPintasan | SinyalSalin;

function tidakSah(nilai: number): boolean {
  return !Number.isFinite(nilai) || nilai < 0;
}

/** Detik sejak ketikan terakhir; tidak pernah negatif dan tidak pernah `NaN`. */
export function sejakDetikTerakhirMengetik(terakhir: number | null, sekarang: number): number {
  if (terakhir === null || tidakSah(terakhir) || tidakSah(sekarang)) return JEDA_TIDAK_DIKETAHUI;
  const detik = Math.floor((sekarang - terakhir) / 1000);
  return detik < 0 ? 0 : detik;
}

/** Sinyal paste, atau `null` bila belum di ambang. */
export function sinyalPaste(panjang: number, sejakMengetikDetik: number): SinyalPaste | null {
  if (tidakSah(panjang) || panjang < AMBANG_PASTE_MINIMAL) return null;
  return {
    jenis: "paste_massal",
    panjang,
    sejak_mengetik_detik: sejakMengetikDetik < 0 ? 0 : sejakMengetikDetik,
  };
}

/** Sinyal salin/cut, atau `null` bila belum di ambang. */
export function sinyalSalin(panjang: number): SinyalSalin | null {
  if (tidakSah(panjang) || panjang < AMBANG_PASTE_MINIMAL) return null;
  return { jenis: "salin_terlarang", panjang };
}

export interface BaganPintasan {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

/**
 * Sinyal pintasan terlarang, atau `null`.
 *
 * Kombinasi yang sampai ke sini di-*normalkan* ke nama kanonik kecil
 * (`Ctrl` dan `V` → `"v"`), jadi satu kombinasi tidak bisa tercatat dua kali
 * hanya karena kapitalitasnya berbeda.
 */
export function sinyalPintasan(e: BaganPintasan): SinyalPintasan | null {
  if (!e.ctrl && !e.meta && !e.alt) return null;
  const tombol = NAMA_TOMBOL[String(e.key ?? "").toLowerCase()];
  if (!tombol || !PINTAKAN_TERLARANG.includes(tombol)) return null;
  const pengenal = e.ctrl ? "ctrl" : e.meta ? "meta" : "alt";
  return { jenis: "pintasan_terlarang", kombinasi: `${pengenal}+${tombol}` };
}
