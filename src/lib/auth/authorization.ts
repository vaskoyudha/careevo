/**
 * Policy otorisasi terpusat — **server-only**.
 *
 * Sebelum modul ini, hak akses dibaca langsung dari claim role di cookie
 * (`getSession() → session.role`). Cookie ditandatangani, jadi isinya tidak bisa
 * dipalsukan, tetapi ia **tidak bisa dicabut**: role yang diturunkan tetap
 * berlaku sampai cookie kedaluwarsa (8 jam). Gate di sini membaca `roles` dari
 * principal database (`user_roles.revoked_at is null`), sehingga pencabutan
 * role berlaku pada permintaan berikutnya.
 *
 * Aturan yang dikunci:
 *
 * - **Role tidak pernah dibaca dari input publik.** Tidak ada fungsi di sini
 *   yang menerima role/FormData dari browser; pemanggil harus sudah memegang
 *   `SessionPrincipal` dari `getSession()`.
 * - **Kepemilikan adalah tentang id, bukan nama.** `cekPemilik` membandingkan
 *   `userId` principal dengan `user_id` pemilik. `cekPemilikEmail` adalah
 *   adapter untuk domain yang masih memakai email ternormalisasi selama
 *   cutover Fase 1; keduanya memakai perbandingan waktu-konstan agar tidak
 *   membocorkan lewat timing.
 * - **`sesiStafLegacy` sengaja terpisah.** Ia hanya membaca claim role dan
 *   dipakai oleh call site yang belum dimigrasikan. Nama "legacy" ada di
 *   identifier supaya berkas ini gagal di-review bila ia dipakai untuk
 *   keputusan otorisasi baru.
 */

import { getSession } from "@/lib/auth/session";
import type { SessionPrincipal } from "@/lib/auth/principal";
import { isStaffRole } from "@/lib/auth/roles";
import { normalizeOwner, type Role, type SessionPayload } from "@/lib/auth/types";

/** Role yang dianggap staff. Satu definisi, dipakai gate dan helper. */
export const ROLE_STAFF: readonly Role[] = ["verifikator", "admin"];

/** Apakah daftar role memuat role staff (`verifikator`/`admin`). */
export function punyaRoleStaff(roles: readonly Role[]): boolean {
  return roles.some(isStaffRole);
}

/** Apakah daftar role memuat `admin`. */
export function punyaRoleAdmin(roles: readonly Role[]): boolean {
  return roles.includes("admin");
}

/** Apakah daftar role memuat role tertentu. */
export function punyaRole(roles: readonly Role[], role: Role): boolean {
  return roles.includes(role);
}

/**
 * Perbandingan string waktu-konstan.
 *
 * Panjang yang berbeda tetap membocorkan panjangnya, tetapi itu pun tetap
 * dibandingkan penuh — bukan `return false` lebih awal, yang membuat waktu
 * eksekusi bergantung pada berapa banyak karakter awal yang sama.
 */
function samaAman(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  let beda = bufA.length ^ bufB.length;
  const panjang = Math.max(bufA.length, bufB.length);
  for (let i = 0; i < panjang; i++) {
    beda |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return beda === 0;
}

/**
 * Principal yang sudah terautentikasi dan memegang role staff.
 *
 * `roles` berasal dari principal database. Sesi tanpa `userId` tidak pernah
 * lolos gate ini, sekalipun cookie-nya mengaku staff — itu yang membuat
 * keputusan otorisasi baru tidak bergantung pada claim role di cookie.
 *
 * @returns principal, atau `null` bila belum masuk / bukan staff.
 */
export async function gateStaff(): Promise<SessionPrincipal | null> {
  const principal = await getSession();
  if (!principal || !principal.userId) return null;
  if (!punyaRoleStaff(principal.roles ?? [])) return null;
  return principal;
}

/**
 * Principal yang memegang role `admin`.
 *
 * Sengaja TERPISAH dari `gateStaff`: tindakan administratif (memberi/mencabut
 * role, mengundang staff) hanya boleh dilakukan admin, bukan verifikator.
 */
export async function gateAdmin(): Promise<SessionPrincipal | null> {
  const principal = await getSession();
  if (!principal || !principal.userId) return null;
  if (!punyaRoleAdmin(principal.roles ?? [])) return null;
  return principal;
}

/**
 * Cek kepemilikan berbasis `user_id`.
 *
 * @param ownerUserId `user_id` pemilik resource (dari database, bukan klien).
 * @returns `true` bila principal adalah pemiliknya.
 */
export function cekPemilik(
  principal: Pick<SessionPrincipal, "userId"> | null,
  ownerUserId: string | null | undefined,
): boolean {
  if (!principal || !principal.userId || !ownerUserId) return false;
  return samaAman(principal.userId, ownerUserId);
}

/**
 * Varian yang melempar bila bukan pemilik.
 *
 * Dipakai action yang memetakan galat ke state-nya sendiri; pesannya tidak
 * menyebut resource-nya supaya tidak mengonfirmasi keberadaannya.
 */
export function wajibPemilik(
  principal: Pick<SessionPrincipal, "userId"> | null,
  ownerUserId: string | null | undefined,
): void {
  if (!cekPemilik(principal, ownerUserId)) {
    throw new Error("Akses ditolak: resource ini bukan milik Anda.");
  }
}

/**
 * Adapter kepemilikan berbasis email ternormalisasi — ranah yang belum
 * memiliki `user_id` (profil publik, berkas resume lama) selama cutover.
 *
 * Keduanya dinormalisasi lebih dulu (`normalizeOwner`), sehingga
 * `Budi@Contoh.test` dan `budi@contoh.test` tidak dianggap berbeda.
 */
export function cekPemilikEmail(
  principal: Pick<SessionPrincipal, "email"> | null,
  ownerEmailNormalized: string | null | undefined,
): boolean {
  if (!principal || !principal.email || !ownerEmailNormalized) return false;
  return samaAman(normalizeOwner(principal.email), normalizeOwner(ownerEmailNormalized));
}

/** Varian melempar dari `cekPemilikEmail`. */
export function wajibPemilikEmail(
  principal: Pick<SessionPrincipal, "email"> | null,
  ownerEmailNormalized: string | null | undefined,
): void {
  if (!cekPemilikEmail(principal, ownerEmailNormalized)) {
    throw new Error("Akses ditolak: resource ini bukan milik Anda.");
  }
}

/**
 * Staf dari claim cookie legacy — **hanya** untuk call site yang belum
 * dimigrasikan ke principal database.
 *
 * Ia tetap berguna agar route/layout lama tidak pecah saat `getSession()`
 * berganti bentuk, tetapi ia tidak bisa melihat pencabutan role. Jangan pakai
 * untuk action baru; pakai `gateStaff()`/`gateAdmin()`.
 */
export function sesiStafLegacy(session: SessionPayload | null): SessionPayload | null {
  if (!session) return null;
  return punyaRoleStaff([session.role]) ? session : null;
}
