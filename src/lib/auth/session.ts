/**
 * Adapter sesi Next.js — **server-only**.
 *
 * Sebelum Fase 1, berkas ini memegang seluruh arti sesi: payload JSON
 * (email/nama/username/role) ditandatangani HMAC dan **isinya** menjadi
 * identitas. Itu berarti identitas tidak dapat dicabut (cookie berlaku sampai
 * kedaluwarsa), tidak lintas perangkat, dan perubahan role baru berlaku setelah
 * login ulang.
 *
 * Sekarang arahnya dibalik: cookie hanya membawa **token opaque**, dan seluruh
 * arti sesi hidup di database:
 *
 * - `sessions.token_hash` — hash SHA-256 token (token asli tidak pernah disimpan);
 * - `sessions.expires_at` + `revoked_at` — masa berlaku dan pencabutan terpusat;
 * - `users` + `user_roles` — identitas dan role yang **selalu** dibaca ulang.
 *
 * Konsekuensi yang harus diingat pemanggil:
 *
 * - **`getSession()` menyentuh database pada setiap panggilan.** Ia tidak bisa
 *   dipanggil dari komponen client, dan tidak ada cache — cache akan
 *   menghidupkan kembali masalah "pencabutan role belum berlaku".
 * - **`getSession()` mengembalikan `SessionPrincipal`,** superset dari
 *   `SessionPayload` lama. Call site yang membaca `.email/.nama/.username/.role`
 *   tetap bekerja; `.userId`/`.roles` adalah tambahan dari database.
 * - **Cookie legacy (`ls_session` bertanda tangan HMAC) tidak lagi diterima.**
 *   Nilainya bukan token opaque yang ada di database, jadi `getSession()`
 *   mengembalikannya sebagai `null` — perilaku yang diinginkan pada cutover.
 * - **`destroySession()` hanya menghapus cookie.** Pencabutan baris sesi adalah
 *   tugas `auth-service` (`keluarSession`), yang dipanggil `logoutAction` lebih
 *   dulu. Memisahkannya mencegah "logout" yang hanya menghapus cookie di klien
 *   sementara tokennya tetap sah di server.
 * - **`authenticate`/`createSession` dipertahankan namanya** karena dipakai
 *   `src/actions/auth.ts`, tetapi keduanya hanya jembatan tipis ke
 *   `auth-service.ts`.
 */

import { cookies } from "next/headers";
import {
  authenticatePengguna,
  keluarSession,
  principalDariToken,
  terbitkanSesi,
} from "./auth-service";
import { TTL_SESI_MS } from "./session-repository";
import type { SessionPrincipal } from "./principal";

export type { Role, SessionPayload, SessionUser } from "./types";
export type { SessionPrincipal } from "./principal";

/** Nama cookie sesi. Tidak berubah supaya tidak ada dua nama yang hidup bersama. */
export const COOKIE_NAME = "ls_session";

/**
 * Umur cookie dalam detik, diturunkan dari `TTL_SESI_MS`.
 *
 * Sengaja tidak ditulis ulang sebagai angka: cookie dan `sessions.expires_at`
 * harus berakhir bersamaan. Cookie yang lebih panjang akan membuat klien
 * mengirim token yang sudah mati; yang lebih pendek memaksa login ulang padahal
 * sesinya masih sah.
 */
export const SESSION_MAX_AGE = Math.floor(TTL_SESI_MS / 1000);

/** Opsi cookie sesi — satu tempat, supaya `set` dan `clear` tidak menyimpang. */
function opsiCookie(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Token sesi mentah dari cookie, atau `null` bila tidak ada. */
export async function bacaTokenSesi(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return token && token.length > 0 ? token : null;
}

/**
 * Principal dari sesi yang sedang aktif, atau `null`.
 *
 * Satu-satunya jalur baca identitas. Semua kegagalan — token tidak ada, tidak
 * dikenal, sesi dicabut, sesi kedaluwarsa, user dihapus/nonaktif — menyatu
 * menjadi `null`: membedakannya di response hanya memberi penyerang informasi.
 *
 * Galat database selain masalah konfigurasi juga menjadi `null` (lihat
 * `principalDariTokenAman`): sesi yang tidak dapat diverifikasi diperlakukan
 * sebagai "belum masuk", dan gagal-terbuka bukan pilihan.
 */
export async function getSession(): Promise<SessionPrincipal | null> {
  const token = await bacaTokenSesi();
  if (!token) return null;
  return principalDariTokenAman(token);
}

/**
 * `principalDariToken` dengan galat database diubah menjadi `null`.
 *
 * Galat konfigurasi (`DatabaseUrlError`) **tetap dilempar**: itu kegagalan start
 * yang harus terlihat, bukan sesi yang kebetulan tidak valid. Galat lain
 * (koneksi putus, tabel sementara tidak dapat dibaca) menjadi `null`, supaya
 * halaman bergate tidak berubah menjadi 500 di seluruh aplikasi hanya karena
 * satu query gagal.
 */
async function principalDariTokenAman(token: string): Promise<SessionPrincipal | null> {
  const { DatabaseUrlError } = await import("@/lib/db/client");
  try {
    return await principalDariToken(token);
  } catch (error) {
    if (error instanceof DatabaseUrlError) throw error;
    return null;
  }
}

/**
 * Tulis token sesi ke cookie. **Satu-satunya** tempat cookie sesi di-set.
 *
 * Token datang dari `auth-service` (yang sudah menyimpan hash-nya di database);
 * fungsi ini tidak membangkitkan maupun memverifikasi apa pun.
 */
export async function pasangCookieSesi(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, opsiCookie(SESSION_MAX_AGE));
}

/**
 * Hapus cookie sesi. Tidak mencabut baris di database — lihat catatan modul.
 *
 * `maxAge: 0` (bukan hanya nilai kosong) supaya peramban benar-benar
 * menghapusnya; cookie dengan nilai kosong tetapi umur panjang akan tetap
 * dikirim sebagai string kosong.
 */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", opsiCookie(0));
}

/**
 * Verifikasi email/password dan kembalikan principal.
 *
 * `izinkanDemo` disalurkan dari `demoAccountsAllowed()` oleh pemanggil
 * (`loginAction`), bukan dibaca di sini — dengan begitu hanya ada satu tempat
 * yang memutuskan apakah akun demo boleh masuk.
 */
export async function authenticate(
  email: string,
  password: string,
  opsi: { izinkanDemo?: boolean } = {},
): Promise<SessionPrincipal | null> {
  const { hasil } = await authenticatePengguna({
    email,
    password,
    izinkanDemo: opsi.izinkanDemo,
  });
  return hasil.ok ? hasil.principal : null;
}

/**
 * Terbitkan sesi untuk principal yang sudah terverifikasi dan pasang cookie.
 *
 * Mengembalikan token yang tertulis ke cookie, supaya pemanggil dapat
 * mencabutnya nanti (logout) tanpa membacanya kembali dari cookie.
 */
export async function createSession(principal: SessionPrincipal): Promise<string> {
  const token = await terbitkanSesi(principal);
  await pasangCookieSesi(token);
  return token;
}

/**
 * Cabut sesi yang ditunjuk token ini. **Bukan** `destroySession`.
 *
 * Dipakai `logoutAction`: pencabutan baris di database harus terjadi lebih dulu,
 * kalau tidak token yang sudah "logout" masih sah bila disalin dari riwayat
 * peramban.
 */
export async function cabutSesiSekarang(token: string): Promise<void> {
  await keluarSession(token);
}
