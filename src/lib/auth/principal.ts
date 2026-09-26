/**
 * Kontrak principal — **frozen**, dipakai lintas subagent Fase 1.
 *
 * Berkas ini adalah perwujudan tipe dari kesepakatan yang sudah ditetapkan:
 * `getSession()` (di `src/lib/auth/session.ts`) bermigrasi menjadi adapter yang
 * mengembalikan `SessionPrincipal | null` dari database, dan konsumen RBAC
 * (`src/lib/auth/authorization.ts`, `src/actions/staff.ts`) membaca `roles` dari
 * sini — **bukan** dari claim role di cookie.
 *
 * Aturan yang dikunci:
 *
 * - `userId` adalah id database (`users.id`, uuid). Cookie legacy tidak
 *   memilikinya; sesi yang belum punya principal database **bukan** principal
 *   yang sah untuk keputusan otorisasi baru.
 * - `roles` adalah daftar role yang **aktif** (`user_roles.revoked_at is null`).
 *   Role yang dicabut harus hilang dari daftar ini, sehingga permintaan
 *   berikutnya otomatis gagal di gate — tanpa cache, tanpa daftar cabutan.
 * - `role` (dari `SessionPayload`) tetap ada sebagai compatibility adapter
 *   selama call site legacy (layout onboarding, `/p/[username]`, demo) belum
 *   ikut bermigrasi; rencana §5.4 melarang refactor serentak. Ia boleh berbeda
 *   dari `roles` hanya pada masa transisi itu.
 *
 * Modul ini murni tipe + konstanta: tidak membuka koneksi, tidak membaca env,
 * dan tidak boleh memuat `node:fs`. Aman diimpor dari server action, layout,
 * maupun kode server lain.
 */

import { ROLES, type Role } from "./types";

export interface SessionPrincipal {
  /** `users.id` — kunci kepemilikan (`user_id`) untuk domain learner/file. */
  userId: string;
  /** Role aktif dari database. Role yang dicabut tidak muncul di sini. */
  roles: Role[];
  /** Compatibility adapter untuk call site legacy — lihat catatan di atas. */
  role: Role;
  /** `users.display_name`. */
  nama: string;
  /** `users.email_normalized`. */
  email: string;
  /** `users.username_normalized`. */
  username: string;
  /** Kapan sesi ini dibuat (ms epoch). */
  iat: number;
}

/**
 * Urutan prioritas role, dari yang paling kuat ke paling lemah.
 *
 * Satu daftar, bukan angka tersebar: menambah role baru hanya mengubah satu
 * baris. Dipakai `roleTertinggi` untuk mengisi field kompatibilitas `role`.
 */
export const URUTAN_ROLE: readonly Role[] = ["admin", "verifikator", "user"];

/**
 * Role tertinggi dari sebuah daftar role aktif.
 *
 * Field `role` pada `SessionPrincipal` adalah compatibility adapter untuk call
 * site legacy yang masih membaca `session.role`; nilai itu adalah role
 * tertinggi yang aktif (`admin` > `verifikator` > `user`). Fungsi ini yang
 * menentukannya, supaya aturan prioritasnya tinggal di satu tempat.
 *
 * Daftar kosong mengembalikan `"user"`: learner adalah default yang paling
 * lemah, sehingga principal tanpa role tidak pernah gagal-terbuka menjadi staf.
 * Nilai yang tidak dikenal diabaikan dengan alasan yang sama.
 */
export function roleTertinggi(roles: readonly Role[]): Role {
  return URUTAN_ROLE.find((role) => roles.includes(role)) ?? "user";
}

/**
 * Saring nilai role dari database menjadi `Role[]` yang sah dan unik.
 *
 * Database menyimpan `user_roles.role` sebagai `text` + CHECK, jadi tipe
 * TypeScript-nya `string`. Fungsi ini adalah satu-satunya tempat nilai mentah
 * itu berubah menjadi `Role`; menyaring (bukan melempar) berarti data role yang
 * rusak menurunkan hak akses, tidak menaikkannya.
 *
 * Bergantung pada `ROLES` di `./types`, yang **merupakan nilai** (array), bukan
 * hanya tipe — lihat catatan di sana.
 */
export function hanyaRoleSah(values: readonly string[]): Role[] {
  const sah: Role[] = [];
  for (const value of values) {
    if ((ROLES as readonly string[]).includes(value) && !sah.includes(value as Role)) {
      sah.push(value as Role);
    }
  }
  return sah;
}
