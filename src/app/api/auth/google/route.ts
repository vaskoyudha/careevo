import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ambilKonfigurasiGoogle, buatUrlOauthGoogle, originPublik, tentukanRedirectUri } from "@/lib/auth/google";
import { cekBatasiAksi } from "@/lib/rate-limit/next";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google — memulai alur Google OAuth.
 *
 * Route handler, bukan Server Action, karena yang dibutuhkan adalah **redirect
 * keluar**: browser harus pindah ke `accounts.google.com` lalu kembali ke
 * `/api/auth/callback/google`. Form action diproses sebagai POST server dan tidak
 * pernah mengirim pengguna ke situs lain.
 *
 * Yang dikunci:
 *
 * - **Kredensial tidak ada → fitur mati, bukan `500`.** Pengguna kembali ke
 *   `/masuk` atau `/daftar` dengan `oauth_not_configured`.
 * - **`state` dibangkitkan di sini dan disimpan sebagai cookie**; callback
 *   membandingkannya. Tanpa itu, callback yangdipancing pihak lain akan
 *   melewati login.
 * - **Redirect URI ikut disimpan** di cookie, karena nilai yang dipakai menukar
 *   kode harus persis sama dengan yang dikirim ke Google pada langkah otorisasi.
 *   Menurunkannya lagi dari host bisa berbeda di belakang proxy — dan Google
 *   menolak kode yang callback-nya tidak cocok.
 * - **Rate limit memakai kunci `login`** — IP tepercaya yang sama dengan
 *   `loginAction`, bukan email (yang tidak ada di langkah ini).
 */
export async function GET(request: Request) {
  const { aktif } = ambilKonfigurasiGoogle();
  const url = new URL(request.url);
  const kembali = url.searchParams.get("mode") === "daftar" ? "/daftar" : "/masuk";

  // Redirect dibangun dari `Host`/`X-Forwarded-Proto`, bukan `request.url`:
  // di belakang reverse proxy `request.url` menunjuk ke alamat internal server
  // (`http://localhost:3000`), sehingga redirect kemana pun akan mengirim
  // pengguna ke localhost komputer mereka sendiri, bukan ke situs.
  const asal = originPublik(request);

  if (!aktif) {
    return NextResponse.redirect(new URL(`${kembali}?error=oauth_not_configured`, asal));
  }

  // Sudah punya sesi? Login kedua hanya memusingkan orang.
  const jar = await cookies();
  if (jar.get("ls_session")?.value) {
    return NextResponse.redirect(new URL(kembali, asal));
  }

  const batas = await cekBatasiAksi("login");
  if (batas) {
    return NextResponse.redirect(new URL(`${kembali}?error=oauth_exchange_failed`, asal));
  }

  const state = randomBytes(32).toString("hex");
  const redirectUri = tentukanRedirectUri(request);
  const opsiCookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };

  jar.set("ls_oauth_state", state, opsiCookie);
  jar.set("ls_oauth_redirect_uri", redirectUri, opsiCookie);

  return NextResponse.redirect(buatUrlOauthGoogle({ redirectUri, state }));
}
