/**
 * Kunci dan token public attestation — **server-only**.
 *
 * Fase 3 mempertahankan HMAC-SHA256 untuk portabilitas (payload bisa diverifikasi
 * tanpa login) tetapi memindahkan lifecycle ke database. Modul ini memegang dua
 * hal yang tersisa di sisi kriptografi:
 *
 * - **`kunciUntukVersi`** — pemetaan `key_version` → secret. Fase 3 hanya punya
 *   versi 1 (`ATTESTATION_SECRET`); rotasi menambah versi baru di sini tanpa
 *   menulis ulang signature lama. Pemetaan ini memungkinkan endpoint verifikasi
 *   memilih kunci yang benar untuk attestation lama setelah rotasi.
 * - **`tokenPublicBaru`** — nilai acak base64url 32-byte yang **tidak** menurunkan
 *   id database. Token public adalah identifier yang ditampilkan ke publik; ia
 *   tidak boleh membocorkan urutan penerbitan atau memungkinkan menebak token lain.
 *
 * Signing/verifying HMAC dipinjam dari `./sign.ts` dan `./verify.ts` (pure), tetapi
 * payload yang ditandatangani adalah `payload_canonical` dari `./payload.ts`.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { bacaSecret } from "@/lib/config/secrets";

/** Versi kunci yang dikenal. Fase 3 hanya `1`. */
export type KeyVersion = 1;

/** Secret per versi kunci. Menambah versi = menambah entri di sini. */
function secretUntukVersi(versi: number): string {
  if (versi === 1) return bacaSecret("ATTESTATION_SECRET");
  throw new Error(`Key version attestation tidak dikenal: ${versi}`);
}

/** Tandatangani `payloadCanonical` dengan kunci versi `versi`. */
export function tandaTangan(payloadCanonical: string, versi: KeyVersion): string {
  return createHmac("sha256", secretUntukVersi(versi))
    .update(payloadCanonical)
    .digest("hex");
}

/**
 * Verifikasi signature terhadap `payloadCanonical` dengan kunci versi `versi`.
 *
 * Perbandingan waktu-konstan (`timingSafeEqual`) supaya panjang/cocokan signature
 * tidak membocorkan informasi lewat timing.
 */
export function verifikasiSignature(
  payloadCanonical: string,
  signature: string,
  versi: number,
): boolean {
  const diharapkan = tandaTangan(payloadCanonical, versi as KeyVersion);
  const bufA = Buffer.from(diharapkan, "hex");
  const bufB = Buffer.from(signature, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Token public baru — 32 byte acak base64url.
 *
 * Sengaja bukan `randomUUID` yang di-base64-kan: uuid membawa nibble versi/varian
 * tetap yang mengurangi entropi dan bisa menyiratkan pola. Nilai acak penuh tidak
 * punya struktur yang bisa dimanfaatkan.
 */
export function tokenPublicBaru(): string {
  return randomBytes(32).toString("base64url");
}
