/**
 * Baseline security headers, dipakai `next.config.ts` lewat opsi `headers()`.
 *
 * Modul ini murni dan tanpa dependensi Node supaya bisa diuji langsung, dan
 * supaya `next.config.ts` (yang ditranspilasi terpisah dari bundel app) bisa
 * mengimpornya tanpa menarik apa pun dari `node:fs`.
 *
 * Keputusan yang sengaja diambil:
 *
 * - **Tanpa CSP.** Docs Next 16 menyarankan CSP dengan nonce lewat `proxy.ts`,
 *   tetapi itu menuntut rendering dinamis untuk *setiap* halaman dan
 *   `'unsafe-eval'` di development. Menambahkannya diam-diam di sini akan
 *   memecah banyak halaman tanpa peringatan, jadi CSP ditunda sampai ada
 *   compatibility test — persis urutan yang diminta rencana Fase 0. Selama CSP
 *   belum ada, `X-Frame-Options` tetap dipakai sebagai frame policy: docs
 *   menyebut header itu digantikan `frame-ancestors`, bukan dihapus.
 * - **HSTS hanya di production.** Browser mengabaikan HSTS yang datang lewat
 *   HTTP, tetapi mengirimkannya dari `next dev` tetap salah: sekali tersimpan,
 *   `localhost` dipaksa HTTPS dan dev server http biasa berhenti bisa dibuka.
 *   Gerbang `NODE_ENV === "production"` mengikuti pola `secure` cookie di
 *   `src/lib/{auth,profile,onboarding}` yang memakai gerbang yang sama.
 * - **`preload` sengaja tidak dipakai.** `includeSubDomains; preload` dari
 *   contoh docs adalah keputusan yang praktis tidak bisa dibatalkan dan
 *   mensyaratkan *setiap* subdomain sudah HTTPS. Repo ini belum punya
 *   inventaris domain, jadi `preload` ditunda sampai itu pasti.
 */

/** Satu aturan `headers()` di `next.config.ts`. */
export interface AturanHeader {
  source: string;
  headers: { key: string; value: string }[];
}

/**
 * Nilai header baseline, tanpa HSTS karena header itu bergantung environment.
 *
 * `Referrer-Policy` memakai `strict-origin-when-cross-origin`, bukan
 * `origin-when-cross-origin` dari contoh docs: yang terakhir masih mengirim
 * origin penuh saat menurunkan HTTPS→HTTP, sedangkan nilai `strict-*` menahan
 * seluruh referrer pada downgrade.
 *
 * `Permissions-Policy` membatasi `camera` ke `(self)` alih-alih `()` seperti
 * contoh docs. Sesi terverifikasi di course memang direncanakan memakai kamera
 * (lihat `course-session.tsx`: "setelah tersedia, sesi terverifikasi juga
 * memerlukan persetujuan kameramu"), jadi `camera=()` akan mematikan fitur itu
 * sebelum sempat dibangun. `(self)` tetap menutup akses kamera dari iframe
 * pihak ketiga.
 */
export const HEADER_KEAMANAN: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
  "X-Frame-Options": "SAMEORIGIN",
};

/** Hanya dikirim pada deployment HTTPS/production. */
export const HSTS_PRODUCTION = "max-age=63072000; includeSubDomains";

/**
 * Aturan `headers()` Next: satu aturan untuk seluruh path, ditambah HSTS saat
 * production.
 *
 * `isProduction` bisa dioper eksplisit agar test tidak perlu menyentuh
 * `process.env`; default-nya mengikuti env seperti kode lain di repo ini.
 */
export function aturanKeamanan(
  isProduction: boolean = process.env.NODE_ENV === "production",
): AturanHeader[] {
  const headers = Object.entries(HEADER_KEAMANAN).map(([key, value]) => ({
    key,
    value,
  }));

  if (isProduction) {
    headers.push({ key: "Strict-Transport-Security", value: HSTS_PRODUCTION });
  }

  // `/:path*` (modifier `*` = nol atau lebih) cocok untuk `/` maupun path
  // bersarang. Headers config dicek sebelum filesystem — termasuk `/public`
  // dan route handler — jadi satu aturan ini menutup halaman, API, dan berkas
  // unggahan sekaligus.
  return [{ source: "/:path*", headers }];
}
