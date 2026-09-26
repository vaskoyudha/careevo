/**
 * Backfill lazy — **server-only adapter** di atas `backfill.ts`.
 *
 * `backfill.ts` sengaja murni: ia menerima `Pendaftaran[]` yang sudah didekode
 * dan tidak pernah membaca cookie. Modul ini yang membaca cookie `ls_enroll`,
 * dan ia melakukannya **hanya di dalam request milik pemilik cookie itu**:
 * satu-satunya cara mendapat `principal` adalah dari `getSession()`, dan
 * `principal.userId` adalah kunci kepemilikan enrollment di database.
 *
 * Kenapa "lazy" dan bukan sekali di migrasi: pengguna nyata masih membawa
 * progres di cookie peramban mereka. Membaca seluruh cookie saat deploy tidak
 * mungkin — cookienya tidak ada di server. Jadi migrasi terjadi saat pemiliknya
 * kembali, dan **hanya sekali**:
 *
 * 1. Principal tanpa `userId` (sesi legacy tanpa baris `users`) langsung
 *    dilewati: tidak ada kunci kepemilikan, jadi tidak ada yang boleh ditulis.
 * 2. Principal yang **sudah** punya minimal satu enrollment di database
 *    dilewati tanpa membaca cookie sama sekali. Ini yang membuat panggilan
 *    berulang murah dan idempoten: setelah backfill pertama berhasil, halaman
 *    yang sama tidak lagi menyentuh cookie.
 * 3. Cookie dibaca di dalam `try/catch`. Di luar request lifecycle,
 *    `next/headers` melempar; itu diperlakukan sebagai "dilewati", bukan galat
 *    yang menjatuhkan halaman. Cookie kosong juga "dilewati" — tidak ada yang
 *    perlu dimigrasikan.
 *
 * Yang **tidak** dilakukan di sini: menulis garis waktu sendiri. Penulisan
 * barisnya tetap milik `backfillEnrollmentDariCookie`, termasuk aturannya bahwa
 * bukti cookie lama selalu `informal` dan tidak pernah menimpa baris yang sudah
 * selesai (menimpanya akan **menurunkan** bukti terverifikasi, bukan
 * memigrasikannya).
 *
 * Nama fungsi bisnis berbahasa Indonesia; tipe/helper infrastruktur Inggris.
 */

import { cookies } from "next/headers";
import { normalizeOwner } from "@/lib/auth/types";
import type { SessionPrincipal } from "@/lib/auth/principal";
import {
  ENROLL_COOKIE,
  decodePendaftaran,
  type Pendaftaran,
} from "@/lib/courses/enrollment";
import { backfillEnrollmentDariCookie, type HasilBackfill } from "./backfill";
import { listKursusTerdaftarDb } from "./service";

/**
 * Hasil satu kali `pastikanBackfill`.
 *
 * `dilewati` bukan sekadar hiasan: ia membedakan "tidak ada yang perlu
 * dimigrasikan" dari "ada yang dimigrasikan tetapi nol baris" — dua keadaan
 * yang terlihat sama dari angka `migrasi` dan `modul`.
 */
export interface HasilPastikanBackfill extends HasilBackfill {
  /** True bila cookie tidak pernah dibaca dan tidak ada baris yang ditulis. */
  dilewati: boolean;
}

const NOL: HasilPastikanBackfill = { migrasi: 0, ignored: 0, modul: 0, dilewati: true };

/** Entri cookie yang benar-benar milik principal — owner lain bukan urusan kita. */
function milikPrincipal(daftar: Pendaftaran[], email: string): Pendaftaran[] {
  const owner = normalizeOwner(email);
  return daftar.filter(
    (item) => item.owner !== undefined && normalizeOwner(item.owner) === owner,
  );
}

/**
 * Pastikan enrollment cookie principal sudah ada di database — sekali saja.
 *
 * Aman dipanggil dari Server Component maupun Server Action: satu-satunya
 * penulisan yang terjadi adalah baris enrollment/progres milik principal itu
 * sendiri, dan hanya bila ia belum punya satu pun enrollment di database.
 */
export async function pastikanBackfill(
  principal: SessionPrincipal,
): Promise<HasilPastikanBackfill> {
  if (!principal?.userId?.trim()) return NOL;

  // Idempotensi cepat: sudah punya enrollment berarti migrasi untuk principal
  // ini pernah (atau tidak perlu) berjalan. Cookie tidak dibaca lagi.
  if ((await listKursusTerdaftarDb(principal)).length > 0) return NOL;

  let daftar: Pendaftaran[];
  try {
    const jar = await cookies();
    daftar = milikPrincipal(decodePendaftaran(jar.get(ENROLL_COOKIE)?.value), principal.email);
  } catch {
    // Di luar request lifecycle `cookies()` melempar, dan cookie yang tidak bisa
    // dibaca sama artinya dengan tidak ada: tidak ada yang bisa dimigrasikan.
    return NOL;
  }

  if (daftar.length === 0) return NOL;

  return { ...(await backfillEnrollmentDariCookie({ principal, daftar })), dilewati: false };
}
