/**
 * Validasi `Origin` untuk route handler mutasi — **server-only**.
 *
 * Route handler berada di luar seluruh route group, jadi ia TIDAK mendapat
 * perlindungan CSRF bawaan Next.js: perbandingan `Origin` terhadap `Host` yang
 * otomatis hanya berlaku untuk Server Action (lihat
 * `node_modules/next/dist/docs/01-app/02-guides/data-security.md`, bagian
 * "Allowed origins"). Handler unggah memvalidasi Origin-nya sendiri di sini.
 *
 * Endpoint unggah saat ini memakai cookie sesi `SameSite=Lax`, sehingga POST
 * lintas situs memang tidak membawa cookie — dan permintaan tanpa sesi sudah
 * ditolak. Tetapi ketergantungan pada satu flag cookie itu rapuh: begitu
 * SameSite dilonggarkan, atau ada proxy yang menormalkan cookie, satu-satunya
 * yang tersisa adalah pemeriksaan di sini. Karena itu ia menjadi lapisan
 * tersendiri di transport, bukan pengganti gerbang sesi.
 *
 * Kebijakan sengaja ketat — bukan CORS permissive:
 *
 * - `Origin` sama dengan host permintaan → diterima (browser same-origin).
 *   Skema juga harus `http:`/`https:`; origin dengan skema lain (mis. `ftp:`)
 *   tidak pernah datang dari XHR/fetch browser, jadi menolaknya tidak
 *   mengurangi kasus sah.
 * - `Origin: null` (origin opaque, mis. iframe sandbox) → ditolak.
 * - `Origin` ada tetapi host berbeda atau tidak bisa diurai → ditolak.
 * - `Origin` tidak ada → diterima **hanya** di luar production. Browser selalu
 *   mengirim `Origin` pada POST, jadi absennya Origin berarti klien non-browser
 *   (curl, script, test). Di production itu ditolak.
 *
 * Tidak ada header `Access-Control-Allow-Origin` yang dikembalikan: endpoint
 * ini tidak membuka akses lintas situs, hanya menolak yang bukan same-origin.
 */

/** Pesan tunggal saat Origin ditolak. */
export const PESAN_ORIGIN_DITOLAK =
  "Permintaan ditolak: asal permintaan tidak dikenal (Origin tidak sesuai).";

/**
 * Host permintaan menurut server, bukan menurut klien.
 *
 * `X-Forwarded-Host` didahulukan karena di belakang reverse proxy `Host` bisa
 * berisi alamat internal, sedangkan Origin publik memakai host yang diteruskan.
 * Nilai `X-Forwarded-Host` bisa berisi daftar (dipisah koma) — ambil yang
 * pertama. Bila kedua header tidak ada (mis. `Request` yang dibangun di test),
 * jatuh ke host dari URL permintaan.
 */
export function hostPermintaan(request: Request): string | null {
  const diteruskan = request.headers.get("x-forwarded-host");
  if (diteruskan) {
    const pertama = diteruskan.split(",")[0]?.trim();
    if (pertama) return pertama.toLowerCase();
  }

  const host = request.headers.get("host")?.trim();
  if (host) return host.toLowerCase();

  try {
    return new URL(request.url).host.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Apakah permintaan berasal dari same-origin (atau klien non-browser yang
 * diizinkan)?
 *
 * `izinkanTanpaOrigin` hanya perlu diisi di test; defaultnya menolak absennya
 * Origin di production. Dibuat sebagai opsi eksplisit, bukan disimpulkan dari
 * `NODE_ENV` saja, supaya perilaku production bisa diuji tanpa mengubah env.
 */
export function originDiizinkan(
  request: Request,
  opsi: { izinkanTanpaOrigin?: boolean } = {},
): boolean {
  const izinkanTanpaOrigin = opsi.izinkanTanpaOrigin ?? process.env.NODE_ENV !== "production";
  const origin = request.headers.get("origin");

  // Klien non-browser. Browser selalu mengirim Origin pada POST; kalau tidak
  // ada, berarti bukan browser.
  if (origin === null) return izinkanTanpaOrigin;

  const bersih = origin.trim().toLowerCase();
  // "null" adalah origin opaque (sandbox/data:), bukan same-origin.
  if (!bersih || bersih === "null") return false;

  const host = hostPermintaan(request);
  if (!host) return false;

  try {
    const url = new URL(bersih);
    // Hanya http/https yang berasal dari permintaan browser; skema lain
    // (mis. `ftp:`) tidak pernah menjadi Origin XHR/fetch yang sah.
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.host.toLowerCase() === host;
  } catch {
    return false;
  }
}
