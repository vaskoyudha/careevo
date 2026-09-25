/**
 * Token sesi — **server-only**.
 *
 * Cookie klien hanya membawa token *opaque*: nilai acak yang tidak memuat satu
 * pun klaim. Artinya cookie tidak bisa dipakai untuk membaca identitas (itu
 * selalu dari database), dan membocorkan `DATABASE_URL` tidak sama dengan
 * membocorkan sesi aktif, karena yang tersimpan di database hanya hash-nya.
 *
 * Aturan yang dikunci:
 *
 * - **32 byte acak kriptografis**, bukan UUID/`Math.random`. `randomBytes`
 *   adalah CSPRNG; `Math.random` adalah PRNG yang dapat diprediksi.
 * - **Base64url**, bukan hex: 32 byte menjadi 43 karakter yang aman di cookie
 *   tanpa escaping, dan jauh lebih padat daripada hex (64 karakter).
 * - **Hash SHA-256 tanpa salt, dan itu disengaja.** Ini bukan password: token
 *   sudah 256 bit acak sehingga tidak ada kamus yang bisa menebaknya, dan hash
 *   cepat membuat lookup saat setiap request tetap murah. Yang membuatnya aman
 *   adalah entropi token, bukan lambatnya fungsi hash.
 * - **Perbandingan rahasia memakai `timingSafeEqual`.** Perbandingan `===`
 *   pada string bocor lewat waktu eksekusi (berhenti di byte pertama yang
 *   berbeda), dan itu cukup untuk memulihkan nilai rahasia byte demi byte.
 *   Panjang dicek lebih dulu karena `timingSafeEqual` melempar bila berbeda.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Panjang token dalam byte sebelum di-encode. 256 bit entropi. */
export const PANJANG_TOKEN_BYTE = 32;

/** Membangkitkan token sesi opaque baru. Satu token per session row. */
export function buatTokenOpaque(): string {
  return randomBytes(PANJANG_TOKEN_BYTE).toString("base64url");
}

/**
 * Hash token untuk disimpan/dicari — SHA-256 hex (64 karakter).
 *
 * Nilai ini yang masuk kolom `sessions.token_hash`; token aslinya tidak pernah
 * menyentuh database maupun log.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Perbandingan string yang tahan waktu.
 *
 * Panjang yang berbeda langsung mengembalikan `false` — panjang bukan rahasia
 * di sini (token selalu 43 karakter), dan `timingSafeEqual` melempar bila
 * buffer-nya tidak sama panjang.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
