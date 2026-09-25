/**
 * Repository identity — akses database untuk `users`, `user_credentials`, dan
 * `user_roles`. **Server-only.**
 *
 * Aturan yang dikunci:
 *
 * - **Setiap fungsi menerima koneksi/transaksi sebagai argumen pertama.** Tidak
 *   ada `getDb()` di dalam modul ini. Itu yang membuat `daftarPengguna` dapat
 *   menulis users + credentials + roles dalam **satu** transaksi: semua query
 *   memakai handle transaksi yang sama, bukan tiga koneksi berbeda yang bisa
 *   saling tidak melihat.
 * - **Tidak ada kebijakan bisnis di sini.** Repository hanya bentuk query.
 *   Normalisasi, cek unik, dan keputusan "role default apa" ada di
 *   `auth-service.ts`; di sini hanya insert/select.
 * - **Password hash tidak pernah di-`select` bersama user.** `ambilKredensial`
 *   adalah satu-satunya pintu ke `user_credentials`, dan tabelnya terpisah
 *   supaya query profil biasa tidak "kebetulan" membawanya.
 * - **Grant role yang sudah pernah dicabut memakai `onConflictDoUpdate`.**
 *   Primary key `(user_id, role)` membuat `INSERT` kedua bentrok; grant ulang
 *   harus mengosongkan `revoked_at` pada baris yang ada agar jejak `granted_at`
 *   tetap satu baris, bukan gagal.
 *
 * Akses `user_profiles` sengaja belum ada di sini: profil publik masih memakai
 * store berbasis cookie, dan menambah fungsi yang belum dipakai hanya menambah
 * permukaan yang harus dijaga. Ia ditambahkan saat migrasi profil dimulai.
 */

import { and, eq, isNull } from "drizzle-orm";

import type { KoneksiDb, TransaksiDb } from "@/lib/db/client";
import {
  userCredentials,
  userRoles,
  users,
  type User,
  type UserCredential,
} from "@/lib/db/schema";
import type { Role } from "./types";

/**
 * Koneksi atau transaksi. Repository menerima keduanya sehingga satu operasi
 * bisnis dapat dijalankan seluruhnya di dalam satu transaksi.
 */
export type EksekutorDb = KoneksiDb | TransaksiDb;

/**
 * Normalisasi email: trim + lowercase.
 *
 * Ditaruh di sini (bukan di service) supaya penulis dan pencari kunci memakai
 * fungsi yang sama. Kolom `email_normalized` unik di database, jadi normalisasi
 * yang berbeda antara insert dan lookup akan menghasilkan "email belum
 * terdaftar" untuk akun yang jelas ada.
 */
export function normalisasiEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Normalisasi username. Sama alasannya dengan `normalisasiEmail`. */
export function normalisasiUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Cari user berdasarkan email yang **sudah** dinormalisasi. */
export async function cariUserByEmail(
  db: EksekutorDb,
  emailNormalized: string,
): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.emailNormalized, emailNormalized))
    .limit(1);
  return row;
}

/** Cari user berdasarkan username yang **sudah** dinormalisasi. */
export async function cariUserByUsername(
  db: EksekutorDb,
  usernameNormalized: string,
): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.usernameNormalized, usernameNormalized))
    .limit(1);
  return row;
}

/** Cari user berdasarkan id (uuid). */
export async function cariUserById(
  db: EksekutorDb,
  userId: string,
): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row;
}

/**
 * Insert user baru. `id` dibiarkan kosong supaya `defaultRandom()`
 * (`gen_random_uuid()`) yang membangkitkannya.
 *
 * Pelanggaran unique email/username dilempar ke pemanggil sebagai galat
 * PostgreSQL — service menangkapnya dan menerjemahkan menjadi pesan yang bisa
 * dibaca. Pengecekan "sudah dipakai?" sebelumnya hanya untuk pesan yang ramah;
 * constraint di database yang benar-benar menjaminnya (dua pendaftaran paralel
 * sama-sama lolos pengecekan, dan hanya satu yang boleh menang).
 */
export async function buatUser(
  db: EksekutorDb,
  input: { emailNormalized: string; usernameNormalized: string; displayName: string },
): Promise<User> {
  const [row] = await db
    .insert(users)
    .values({
      emailNormalized: input.emailNormalized,
      usernameNormalized: input.usernameNormalized,
      displayName: input.displayName,
    })
    .returning();
  return row;
}

/** Ambil kredensial (hash password) milik user. `undefined` bila belum ada. */
export async function ambilKredensial(
  db: EksekutorDb,
  userId: string,
): Promise<UserCredential | undefined> {
  const [row] = await db
    .select()
    .from(userCredentials)
    .where(eq(userCredentials.userId, userId))
    .limit(1);
  return row;
}

/**
 * Simpan/ganti kredensial user.
 *
 * `password_changed_at` selalu diperbarui: kolom itu dipakai untuk mencabut
 * session yang terbit sebelum pergantian password, jadi membiarkannya basi akan
 * membuat session lama tetap dianggap sah.
 */
export async function simpanKredensial(
  db: EksekutorDb,
  input: { userId: string; passwordHash: string },
): Promise<void> {
  await db
    .insert(userCredentials)
    .values({ userId: input.userId, passwordHash: input.passwordHash })
    .onConflictDoUpdate({
      target: userCredentials.userId,
      set: { passwordHash: input.passwordHash, passwordChangedAt: new Date() },
    });
}

/**
 * Role **aktif** milik user, urutannya tidak dijamin.
 *
 * Hanya baris `revoked_at is null` yang dihitung: role yang dicabut harus
 * langsung hilang dari principal pada request berikutnya, tanpa menunggu
 * session-nya diperbarui.
 */
export async function ambilRolesAktif(
  db: EksekutorDb,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), isNull(userRoles.revokedAt)));
  return rows.map((row) => row.role);
}

/**
 * Beri role awal pada user.
 *
 * Idempoten dan *revive*-safe: konflik pada `(user_id, role)` meng-update baris
 * yang ada dan mengosongkan `revoked_at`, bukan menggagalkan operasi. Kolom
 * `granted_by_user_id` sengaja tidak diisi di sini — grant awal saat registrasi
 * tidak punya aktor; grant oleh staff adalah jalur RBAC terpisah yang mencatat
 * pemberinya.
 */
export async function grantRoleAwal(
  db: EksekutorDb,
  input: { userId: string; role: Role },
): Promise<void> {
  await db
    .insert(userRoles)
    .values({ userId: input.userId, role: input.role })
    .onConflictDoUpdate({
      target: [userRoles.userId, userRoles.role],
      set: { revokedAt: null, grantedAt: new Date() },
    });
}
