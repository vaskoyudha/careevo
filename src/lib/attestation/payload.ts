/**
 * Kanonikalisasi payload attestation — **pure, client-safe**.
 *
 * Fase 3 memindahkan attestation dari stateless (payload datang dari browser,
 * ditandatangani, dilupakan) menjadi authoritative di database. Bentuk payload
 * **tetap** `AttestationPayload` (`sign.ts`) supaya renderer verify publik dan
 * profil `/p/[username]` tidak berubah kontraknya; yang berubah adalah asal
 * nilainya: dibangun server-side dari baris review, bukan dari `FormData`.
 *
 * Modul ini memegang dua hal kecil yang `sign.ts` tidak punya:
 *
 * - **`kanonik`** — alias eksplisit dari `canonicalize` (kunci terurut lalu
 *   serialisasi). Dipakai sebagai `attestations.payload_canonical` supaya yang
 *   tersimpan persis sama dengan yang ditandatangani.
 * - **`dariKanonik`** — parsing balik `payload_canonical` menjadi objek, atau
 *   `null` bila bentuknya tidak sah. Dipakai endpoint verify untuk memisahkan
 *   "payload rusak" dari "signature tidak cocok" tanpa melempar.
 *
 * Modul ini **pure**: tidak membaca env, tidak menyentuh database.
 */

import { canonicalize, type AttestationPayload } from "./sign";

export type { AttestationPayload };

/** String JSON kanonik sebuah payload (kunci terurut). Alias `sign.canonicalize`. */
export function kanonik(payload: AttestationPayload): string {
  return canonicalize(payload);
}

/**
 * Parsing balik `payload_canonical` menjadi objek, atau `null` bila tidak sah.
 *
 * Bentuk yang diperiksa sama dengan `isAttestationPayload` di `token.ts`, tetapi
 * diketik eksplisit di sini supaya endpoint verify (yang memakai `payload_canonical`)
 * tidak bergantung pada `decodeToken`.
 */
export function dariKanonik(teks: string): AttestationPayload | null {
  try {
    const nilai = JSON.parse(teks) as unknown;
    if (typeof nilai !== "object" || nilai === null) return null;
    const kandidat = nilai as Record<string, unknown>;
    const wajibString = ["username", "task_id", "task_title", "track", "level", "issued_at"];
    for (const kunci of wajibString) {
      if (typeof kandidat[kunci] !== "string" || (kandidat[kunci] as string).length === 0) {
        return null;
      }
    }
    if (typeof kandidat.score !== "number" || !Number.isFinite(kandidat.score)) {
      return null;
    }
    return kandidat as unknown as AttestationPayload;
  } catch {
    return null;
  }
}
