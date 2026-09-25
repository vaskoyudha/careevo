/**
 * Hashing password — **server-only**.
 *
 * Argon2id dipakai, bukan SHA-256, karena SHA-256 adalah fungsi cepat: ia
 * dirancang untuk dihitung miliaran kali per detik, yang justru properti yang
 * diinginkan penyerang yang memegang dump database. Argon2id memaksa biaya
 * memori dan waktu per tebakan, dan varian `id` adalah rekomendasi normatif
 * karena menggabungkan ketahanan side-channel (i) dengan ketahanan GPU (d).
 *
 * Aturan yang dikunci:
 *
 * - **Parameter eksplisit, bukan default pustaka.** Nilai di bawah adalah
 *   baseline OWASP (`m=19456` KiB, `t=2`, `p=1`). Menulisnya eksplisit berarti
 *   perubahan nilai selalu terlihat di diff; mengandalkan default berarti
 *   upgrade pustaka bisa menaikkan/menurunkan biaya tanpa jejak.
 * - **Hash yang tersimpan memuat parameternya sendiri** (format PHC:
 *   `$argon2id$v=19$m=...,t=...,p=...$salt$hash`), jadi verifikasi tidak
 *   bergantung pada konstanta di berkas ini dan hash lama tetap dapat diverifikasi
 *   setelah parameter dinaikkan.
 * - **`verifyPassword` tidak pernah melempar untuk hash yang cacat.** Hash rusak
 *   di database adalah kegagalan autentikasi, bukan galat 500; mengembalikan
 *   `false` juga mencegah pesan galat menjadi oracle "hash user ini rusak".
 * - **`Algorithm.Argon2id` sengaja ditulis sebagai literal `2`,** bukan
 *   `Algorithm.Argon2id`. `@node-rs/argon2` mengekspornya sebagai *ambient const
 *   enum*, dan `tsc` menolak mengaksesnya ketika `isolatedModules` menyala
 *   (TS2748) — opsi yang sudah dipakai repo ini. Nilainya dipatok
 *   `npm test` di `password.test.ts` terhadap `Algorithm.Argon2id`, sehingga
 *   konstantanya tidak bisa bergeser tanpa ada yang gagal.
 */

import { hash as argonHash, verify as argonVerify, type Options } from "@node-rs/argon2";

/**
 * `Algorithm.Argon2id` dari `@node-rs/argon2` (lihat catatan modul). Nilainya
 * benar-benar dipakai, dan hash yang dihasilkan tetap memuat `argon2id` di
 * string PHC-nya — jadi kesalahan nilai ini akan terlihat di test, bukan
 * tersembunyi.
 */
export const ARGON2ID = 2;

/** Parameter hashing. Baseline OWASP untuk Argon2id. */
export const OPSI_ARGON2ID: Readonly<Options> = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hash sebuah password. Mengembalikan string PHC lengkap (termasuk salt acak),
 * sehingga dua hash dari password yang sama selalu berbeda.
 */
export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, OPSI_ARGON2ID);
}

/**
 * Verifikasi password terhadap hash tersimpan.
 *
 * Mengembalikan `false` — bukan melempar — untuk hash yang tidak berbentuk
 * PHC, kosong, atau algoritmanya tidak dikenal. Pemanggil memperlakukan hasil
 * ini sebagai satu-satunya sinyal "password cocok".
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (!hash || !password) return false;
  try {
    return await argonVerify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Hash tiruan untuk menyamakan waktu respons saat email tidak ditemukan.
 *
 * Tanpa ini, login terhadap email yang tidak ada kembali jauh lebih cepat
 * (tidak ada verifikasi Argon2) daripada email yang ada, dan selisih waktu itu
 * adalah oracle enumerasi akun. Pemanggil menjalankan `verifyPassword` terhadap
 * hash ini supaya biaya kedua jalur sama.
 *
 * Nilainya hash nyata, bukan placeholder: verifikasi terhadapnya harus benar-benar
 * menghitung Argon2id. Dibangkitkan sekali per proses dari password acak yang
 * tidak pernah ditulis ke mana pun.
 */
let hashUmpan: string | undefined;

/** Bangun (sekali) hash umpan untuk pemerataan waktu. Server-only. */
export async function hashUmpanWaktu(): Promise<string> {
  hashUmpan ??= await hashPassword(`careevo-umpan-${Math.random()}-${Date.now()}`);
  return hashUmpan;
}
