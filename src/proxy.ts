/**
 * proxy.ts — pembatasan request anonim sebelum route dijalankan.
 *
 * ## Mengapa di sini, dan mengapa hanya satu rute
 * Next 16 mengganti nama konvensi `middleware` menjadi `proxy` (dokumentasi
 * resmi: "Middleware is deprecated and renamed to Proxy. Proxy defaults to the
 * Node.js runtime"). Fungsi dan `config.matcher` tidak berubah.
 *
 * Dokumentasi yang sama memberi dua batas yang membentuk berkas ini:
 *   1. Proxy "tidak boleh dijadikan solusi manajemen sesi atau otorisasi penuh",
 *      dan sebaiknya dipakai sebagai upaya terakhir.
 *   2. Matcher yang mengecualikan sebuah path **juga melewati Server Action pada
 *      path itu**, sehingga cakupan Proxy dapat hilang tanpa terlihat.
 *
 * Karena (2), Proxy dipakai **hanya** untuk permukaan yang memang tidak punya
 * handler tempat pengecekan bisa berdiri sendiri: `/verify/[token]` adalah
 * Server Component, dan sebuah page tidak dapat membalas `429` dengan header
 * `Retry-After`. Untuk itu Proxy adalah satu-satunya pola yang benar.
 *
 * Sebaliknya, PDF publik (`/p/[username]/berkas/[slot]`) adalah Route Handler:
 * ia dapat membalas 429 sendiri, jadi pengecekannya ada **di dalam handler**,
 * bukan di sini. Itu lebih kuat terhadap pergeseran matcher dan menghindari
 * penghitungan ganda. Login, signup, unggah course, unggah resume, evaluasi AI,
 * dan chat belajar juga semuanya diperiksa di dalam Server Action / handler-nya.
 *
 * ## IP
 * Vercel menyetel `x-vercel-forwarded-for` di edge dan header itu tidak dapat
 * ditimpa, jadi IP yang dipakai di sini adalah IP tepercaya, bukan nilai yang
 * dikirim klien lewat `x-forwarded-for`. Alternatif `x-real-ip` hanya dibaca bila
 * `CAREEVO_TRUST_REAL_IP_HEADER=1` diisi eksplisit; rinciannya di
 * `src/lib/rate-limit/identitas.ts`.
 */

import type { NextRequest } from "next/server";
import { batasiRequestMasuk } from "@/lib/rate-limit/next";

export async function proxy(
  request: NextRequest,
): Promise<Response | undefined> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/verify/")) {
    // Token tidak dipakai sebagai kunci tambahan: ia datang dari URL dan
    // nilainya berubah setiap kali diacak, sehingga tidak akan menjadi bucket
    // yang stabil. Yang stabil hanya IP tepercaya.
    const ditolak = await batasiRequestMasuk(request, "verifyPublik");
    return ditolak ?? undefined;
  }

  return undefined;
}

export const config = {
  // Daftar ini harus LITERAL dan tidak boleh dibangun dari variabel: matcher
  // dianalisis statis saat build, dan nilai dinamis diabaikan diam-diam —
  // pembatasan akan hilang tanpa error.
  //
  // `/api/*` dan `/p/*` sengaja TIDAK ada di sini: keduanya Route Handler yang
  // memeriksa batasnya sendiri (dan `/api/unggah` memeriksa sesi di dalam).
  // Menambahkannya ke matcher juga akan membuat Proxy melewati Server Action
  // pada path itu (dokumentasi proxy), sehingga cakupan pembatasan di dalam
  // handler justru kabur.
  matcher: ["/verify/:token"],
};
