/**
 * next.ts — helper Rate Limit yang mengetahui Next.js, **server-only**.
 *
 * Modul ini sengaja dipisah dari `./index.ts`: `./index.ts` tidak menyentuh
 * `next/headers` sehingga dapat diuji murni, sedangkan berkas ini adalah tempat
 * satu-satunya pemanggilan `headers()` dan pembuatan `NextResponse` 429/503.
 *
 * ## Di mana pengecekan boleh tinggal
 * Dokumentasi Next 16 (`proxy.md`) menyatakan Proxy "tidak boleh dijadikan
 * solusi manajemen sesi atau otorisasi penuh", dan peringatan yang lebih keras
 * lagi: matcher yang tidak sengaja mengecualikan sebuah path **juga melewati
 * Server Action** pada path itu, jadi cakupan Proxy dapat hilang tanpa terlihat.
 * Karena itu pembagian di sini:
 *   - `proxy.ts` **hanya** membatasi rute anonim yang tidak punya gerbang server
 *     lain (verifikasi publik dan PDF publik) — tepat use case Proxy menurut
 *     dokumen: menolak request sebelum route mahal berjalan.
 *   - Login, signup, upload, unggah resume, evaluasi AI, dan chat belajar
 *     dibatasi **di dalam** Server Action / Route Handler masing-masing, dengan
 *     proxy `matcher` yang sengaja mengecualikan `/api/*` dan path action. Server
 *     Action adalah endpoint publik dan tidak boleh bergantung pada Proxy.
 */

import { headers } from "next/headers";
import {
  batasiPermintaan,
  headerRateLimit,
  type HasilBatasi,
  type HasilPenjagaan,
  type KegagalanBatasi,
} from "./index";
import type { NamaKebijakan } from "./kebijakan";
import { ipTercepat, type PembacaHeader } from "./identitas";

/** Pesan 429. Sama untuk semua kebijakan: menyebut limit tidak membantu siapa pun. */
const PESAN_DIBATASI =
  "Terlalu banyak permintaan. Coba lagi sebentar lagi.";

/**
 * Balasan 429, lengkap dengan `Retry-After` dan tiga header `RateLimit-*`
 * (mengikuti draft IETF). Saat diblokir `RateLimit-Remaining` selalu 0.
 *
 * Sengaja memakai `Response` murni, bukan `NextResponse.json`, karena fungsi ini
 * juga dipanggil dari Route Handler yang menyajikan berkas biner: menarik
 * `next/server` ke dalam bundel itu menambah satu dependensi statis pada jalur
 * unduhan. `Response` murni berperilaku sama di Proxy maupun Route Handler.
 */
export function responsDibatasi(
  nama: NamaKebijakan,
  hasil: HasilBatasi,
): Response {
  return new Response(JSON.stringify({ ok: false, error: PESAN_DIBATASI }), {
    status: 429,
    headers: { ...headerRateLimit(nama, hasil), "Content-Type": "application/json" },
  });
}

/** Respons 503 untuk kebijakan gagal-tertutup saat Redis tidak dapat dihubungi. */
export function responsPembatasGagal(): Response {
  return new Response(
    "Layanan pembatas permintaan sedang tidak tersedia. Coba lagi beberapa saat lagi.",
    {
      status: 503,
      headers: { "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}

/** Terjemahkan hasil penjagaan menjadi respons, atau `null` bila boleh lanjut. */
function responsDari(
  nama: NamaKebijakan,
  keputusan: HasilPenjagaan,
): Response | null {
  if (keputusan.tipe === "lolos") return null;
  if (keputusan.tipe === "dibatasi") return responsDibatasi(nama, keputusan.hasil);
  return responsPembatasGagal();
}

/**
 * Periksa request yang masuk dari Proxy atau Route Handler.
 *
 * Menerima apa pun yang punya `headers` — `NextRequest` (Proxy) maupun `Request`
 * (Route Handler) — sehingga satu jalur pengecekan dipakai di keduanya. IP diambil
 * dari header request oleh `ipTercepat()`: pada Vercel
 * `x-vercel-forwarded-for` disetel di edge dan tidak dapat ditimpa klien,
 * sedangkan `x-real-ip` (bukan header Vercel) hanya dibaca bila
 * `CAREEVO_TRUST_REAL_IP_HEADER=1` diisi eksplisit — lihat `./identitas.ts`.
 *
 * @returns `null` bila boleh lanjut, atau `Response` siap-kirim.
 */
export async function batasiRequestMasuk(
  request: { readonly headers: PembacaHeader },
  nama: NamaKebijakan,
  konteks: { readonly tambahan?: string } = {},
): Promise<Response | null> {
  const keputusan = await batasiPermintaan(nama, {
    ip: ipTercepat(request.headers) ?? undefined,
    tambahan: konteks.tambahan,
  });
  return responsDari(nama, keputusan);
}

/**
 * Cek rate limit dari dalam Server Action (yang tidak dapat membalas header).
 *
 * `principal` harus berasal dari data server (mis. `session.email`), bukan dari
 * `FormData`. `tambahan` untuk kunci kebijakan spesifik (mis. username pada
 * route PDF publik).
 *
 * @returns `null` bila boleh lanjut, atau `{ gagal }` berisi pesan dan
 *   `retryAfterDetik` untuk dimasukkan ke state action.
 */
export async function cekBatasiAksi(
  nama: NamaKebijakan,
  opsi: { readonly principal?: string; readonly tambahan?: string } = {},
): Promise<{ gagal: KegagalanBatasi } | null> {
  const h = await headers();
  const keputusan = await batasiPermintaan(nama, {
    ip: ipTercepat(h) ?? undefined,
    principal: opsi.principal,
    tambahan: opsi.tambahan,
  });
  if (keputusan.tipe === "lolos") return null;
  const gagal: KegagalanBatasi =
    keputusan.tipe === "dibatasi"
      ? { pesan: "Terlalu banyak percobaan dari koneksi ini. Coba lagi sebentar lagi." }
      : {
          pesan:
            "Layanan pembatas permintaan sedang tidak tersedia. Coba lagi beberapa saat lagi.",
        };
  return { gagal };
}
