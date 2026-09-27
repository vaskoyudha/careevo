import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { ambilProfilGoogle, tukarCodeGoogle } from "@/lib/auth/google";
import { masukAtauDaftarGoogle, terbitkanSesi } from "@/lib/auth/auth-service";
import { pasangCookieSesi } from "@/lib/auth/session";
import { landingFor } from "@/lib/auth/landing";

export const dynamic = "force-dynamic";

/** Nama cookie sementara, harus sama persis dengan yang ditulis di `/api/auth/google`. */
const COOKIE_STATE = "ls_oauth_state";
const COOKIE_REDIRECT_URI = "ls_oauth_redirect_uri";

/**
 * GET /api/auth/callback/google — menukar kode otorisasi dan menerbitkan sesi.
 *
 * Urutan pemeriksaan itu sendiri adalah pertahanan:
 *
 * 1. `error` dari Google → kembali ke `/masuk` (pengguna menekan batal).
 * 2. **`state` harus sama dengan cookie.** Ini yang menolak callback yang
 *    dipancing: tanpanya, siapa pun yang punya tautan callback akan masuk
 *    dengan identitas Google miliknya sendiri ke sesi orang lain.
 * 3. Cookie dibersihkan **sebelum** pertukaran token, jadi satu kode tidak bisa
 *    dipakai ulang walau penukarannya gagal dan pengguna menekan back.
 * 4. `email_verified` wajib true. Tanpa itu akun Google yang dibuat untuk
 *    membajak nama email orang lain akan mendapat akun di sini.
 * 5. Keputusan email/sesi tetap milik `auth-service`; handler ini tidak
 *    menentukan role apa pun.
 *
 * Kegagalan apa pun berakhir sebagai redirect ke `/masuk` atau `/daftar` dengan
 * **kode** galat, bukan pesan — supaya halaman bisa memetakannya dan tidak ada
 * detail internal yang bocor lewat URL.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const jar = await cookies();

  const kembali = "/masuk";
  const gagal = (kode: string) => NextResponse.redirect(new URL(`${kembali}?error=${kode}`, request.url));

  // 1. Pengguna membatalkan atau Google menolak.
  if (params.get("error")) {
    jar.delete(COOKIE_STATE);
    jar.delete(COOKIE_REDIRECT_URI);
    return gagal("oauth_cancelled");
  }

  // 2. state wajib cocok dengan cookie yang kita terbitkan.
  const state = params.get("state");
  const savedState = jar.get(COOKIE_STATE)?.value;
  if (!state || !savedState || state !== savedState) {
    jar.delete(COOKIE_STATE);
    jar.delete(COOKIE_REDIRECT_URI);
    return gagal("invalid_state");
  }

  // 3. Bersihkan cookie lebih dulu, sebelum ada kerja jaringan yang bisa gagal.
  const redirectUri = jar.get(COOKIE_REDIRECT_URI)?.value;
  jar.delete(COOKIE_STATE);
  jar.delete(COOKIE_REDIRECT_URI);

  const code = params.get("code");
  if (!code) return gagal("missing_code");

  if (!redirectUri) {
    // Cookie hilang (kedaluwarsa, dibersihkan browser, atau development yang
    // mengganti host). Menebak ulang berisiko tidak cocok dengan yang
    // didaftarkan, jadi lebih baik ditolak dengan pesan jelas.
    return gagal("invalid_state");
  }

  // 4. Tukar kode dan baca profil.
  let email: string;
  let nama: string | undefined;
  try {
    const tokens = await tukarCodeGoogle({ code, redirectUri });
    const profil = await ambilProfilGoogle(tokens.access_token);
    if (!profil.email || !profil.email_verified) {
      return gagal("unverified_email");
    }
    email = profil.email;
    nama = profil.name;
  } catch (error) {
    // Log di server, kode di URL. Jangan pernah menulis token atau kode ke log.
    console.error("[oauth/google] pertukaran kode atau pengambilan profil gagal:", error);
    return gagal("oauth_exchange_failed");
  }

  // 5. Keputusan bisnis tetap di service (status akun, role, keunikan).
  let hasil;
  try {
    hasil = await masukAtauDaftarGoogle({ email, nama });
  } catch (error) {
    console.error("[oauth/google] provisioning akun gagal:", error);
    return gagal("db_error");
  }

  if (!hasil.ok) {
    return gagal(hasil.alasan === "nonaktif" ? "account_inactive" : "db_error");
  }

  // Metadata sesi: sama seperti `konteksRequest` di `src/actions/auth.ts`,
  // hanya prefix IP (bukan alamat penuh) dan kegagalan dibaca diabaikan.
  let konteks: { userAgent?: string; ipPrefix?: string } = {};
  try {
    const h = await headers();
    const ip = h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for");
    konteks = {
      userAgent: h.get("user-agent")?.slice(0, 300) ?? undefined,
      ipPrefix: ip?.split(",")[0]?.trim().slice(0, 64) || undefined,
    };
  } catch {
    // Metadata bukan alasan menolak login.
  }

  const token = await terbitkanSesi(hasil.principal, konteks);
  await pasangCookieSesi(token);

  return NextResponse.redirect(
    new URL(await landingFor(hasil.principal.role, hasil.principal.userId, hasil.principal.email), request.url),
  );
}
