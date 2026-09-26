/**
 * Validasi `Origin` untuk route handler mutasi — **server-only**.
 *
 * Ini SATU lapisan di antara beberapa, **bukan** satu-satunya pertahanan CSRF
 * endpoint unggah. Yang menjaga endpoint itu saat ini:
 *
 * - Cookie sesi `ls_session` ber-`SameSite=Lax`, sehingga POST lintas situs
 *   tidak membawa cookie.
 * - Gerbang sesi + peran staff (`punyaRoleStaff` atas `roles` principal
 *   database) di dalam handler menolak permintaan tanpa sesi staff.
 * - Pemeriksaan `Origin` di modul ini menolak permintaan lintas origin sebelum
 *   body disentuh sama sekali.
 *
 * Karena itu ia lapisan tersendiri di transport — bukan pengganti gerbang sesi
 * maupun `SameSite`. (Server Action punya pemeriksaan Origin→Host bawaan Next;
 * route handler tidak. Lihat
 * `node_modules/next/dist/docs/01-app/02-guides/data-security.md` bagian
 * "Allowed origins" dan
 * `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`
 * bagian "allowedOrigins".)
 *
 * ## Asumsi kepercayaan (trust assumption)
 *
 * `X-Forwarded-Host` adalah header yang datang bersama permintaan dan bisa
 * dikirim klien mana pun. Ia **TIDAK** dipercaya secara default: host yang
 * diharapkan diambil dari `Host`, lalu dari host URL permintaan. Di belakang
 * reverse proxy yang menormalkan header ini, `CAREEVO_TRUST_PROXY_HEADERS=1`
 * dapat diisi secara sadar — server-only, positif eksplisit — dan baru setelah
 * itu `X-Forwarded-Host` dipakai. Aktifkan hanya bila origin tidak dapat
 * dijangkau langsung; jika klien bisa mencapai origin tanpa melewati proxy, ia
 * juga bisa memalsukan header ini dan kepercayaan itu buyar.
 *
 * Vercel mengisi `Host` dengan host publik yang diminta browser, jadi mode
 * default (tanpa env) sudah benar di sana tanpa perlu mempercayai
 * `X-Forwarded-Host`; env itu disediakan untuk proxy yang mengganti `Host`
 * dengan alamat internal.
 *
 * ## Kebijakan
 *
 * - `Origin` sama host dengan permintaan → diterima (browser same-origin).
 *   Skema juga harus `http:`/`https:`; origin dengan skema lain (mis. `ftp:`)
 *   tidak pernah datang dari XHR/fetch browser, jadi menolaknya tidak
 *   mengurangi kasus sah.
 * - `Origin: null` (origin opaque, mis. iframe sandbox) → ditolak.
 * - `Origin` ada tetapi host berbeda atau tidak bisa diurai → ditolak.
 * - `Origin` tidak ada → **ditolak** secara default (fail-closed), termasuk di
 *   production. Browser selalu mengirim `Origin` pada POST, jadi absennya
 *   berarti klien non-browser (curl, script, test). Hanya
 *   `CAREEVO_ALLOW_MISSING_ORIGIN=1` — positif eksplisit, untuk dev/test lokal —
 *   yang membukanya. Ini **bukan** disimpulkan dari `NODE_ENV`.
 *
 * Tidak ada header `Access-Control-Allow-Origin` yang dikembalikan: endpoint
 * ini tidak membuka akses lintas situs, hanya menolak yang bukan same-origin.
 */

/** Nama env untuk mengizinkan permintaan tanpa `Origin`. Positif eksplisit. */
export const ENV_IZINKAN_TANPA_ORIGIN = "CAREEVO_ALLOW_MISSING_ORIGIN";

/** Nama env untuk mempercayai `X-Forwarded-Host` dari reverse proxy. */
export const ENV_PERCAYA_X_FORWARDED_HOST = "CAREEVO_TRUST_PROXY_HEADERS";

/** Pesan tunggal saat Origin ditolak. */
export const PESAN_ORIGIN_DITOLAK =
  "Permintaan ditolak: asal permintaan tidak dikenal (Origin tidak sesuai).";

/**
 * Lingkungan yang dibaca modul ini, struktural supaya test tidak perlu mengubah
 * `process.env`. Bentuk peta, bukan properti bernama, agar `process.env`
 * (yang bertipe index signature) dapat dioper langsung.
 */
export type OriginEnvironment = Readonly<Record<string, string | undefined>>;

/** Opsi eksplisit; bila tidak diisi, kebijakan berasal dari env (fail-closed). */
export interface OpsiOrigin {
  /**
   * Izinkan permintaan tanpa header `Origin`. Default: baca
   * `CAREEVO_ALLOW_MISSING_ORIGIN` (default `false`). Hanya perlu diisi di test
   * yang ingin memaksa perilakunya tanpa menyentuh env.
   */
  izinkanTanpaOrigin?: boolean;
  /**
   * Percayai `X-Forwarded-Host`. Default: baca `CAREEVO_TRUST_PROXY_HEADERS`
   * (default `false`). Hanya `true` bila ada proxy tepercaya di depan.
   */
  percayaXForwardedHost?: boolean;
}

/** Nilai env yang dianggap "menyala". Selain `1`/`true` (case-insensitive) → mati. */
function envPositif(nilai: string | undefined): boolean {
  const bersih = nilai?.trim().toLowerCase();
  return bersih === "1" || bersih === "true";
}

/** Apakah permintaan tanpa `Origin` diizinkan. Default `false` — fail-closed. */
export function izinkanTanpaOriginDariEnv(env: OriginEnvironment = process.env): boolean {
  return envPositif(env[ENV_IZINKAN_TANPA_ORIGIN]);
}

/** Apakah `X-Forwarded-Host` boleh dipercaya. Default `false` — header klien. */
export function percayaXForwardedHostDariEnv(env: OriginEnvironment = process.env): boolean {
  return envPositif(env[ENV_PERCAYA_X_FORWARDED_HOST]);
}

/**
 * Host permintaan menurut server.
 *
 * `X-Forwarded-Host` **diabaikan** kecuali pemanggil (atau env) secara eksplisit
 * menyatakan ada proxy tepercaya — lihat asumsi kepercayaan di atas. Selama itu,
 * `Host` adalah nilai yang diisi server/edge penerima koneksi, bukan klien
 * lintas jaringan.
 *
 * Nilai `X-Forwarded-Host` bisa berisi daftar (dipisah koma) — ambil yang
 * pertama. Bila tidak ada `Host` (mis. `Request` yang dibangun di test, karena
 * `Host` adalah forbidden header di fetch), jatuh ke host dari URL permintaan.
 */
export function hostPermintaan(request: Request, opsi: OpsiOrigin = {}): string | null {
  const percayaProxy = opsi.percayaXForwardedHost ?? percayaXForwardedHostDariEnv();

  if (percayaProxy) {
    const diteruskan = request.headers.get("x-forwarded-host");
    if (diteruskan) {
      const pertama = diteruskan.split(",")[0]?.trim();
      if (pertama) return pertama.toLowerCase();
    }
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
 * diizinkan secara eksplisit)?
 *
 * Absennya `Origin` dan kepercayaan `X-Forwarded-Host` sama-sama default
 * `false` dan hanya dibuka oleh opsi/env positif eksplisit — bukan oleh
 * `NODE_ENV`. Dengan begitu perilaku gagal-tertutup berlaku seragam di semua
 * lingkungan, dan dapat diuji tanpa mengubah env.
 */
export function originDiizinkan(
  request: Request,
  opsi: OpsiOrigin = {},
): boolean {
  const izinkanTanpaOrigin = opsi.izinkanTanpaOrigin ?? izinkanTanpaOriginDariEnv();
  const origin = request.headers.get("origin");

  // Klien non-browser. Browser selalu mengirim Origin pada POST; kalau tidak
  // ada, berarti bukan browser — dan itu ditolak kecuali ada izin eksplisit.
  if (origin === null) return izinkanTanpaOrigin;

  const bersih = origin.trim().toLowerCase();
  // "null" adalah origin opaque (sandbox/data:), bukan same-origin.
  if (!bersih || bersih === "null") return false;

  const host = hostPermintaan(request, opsi);
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
