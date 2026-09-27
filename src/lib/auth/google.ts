/**
 * Integrasi Google OAuth 2.0 — **server-only**.
 *
 * Mengimplementasikan alur otorisasi kode (Authorization Code Flow) standar
 * untuk autentikasi dan pendaftaran pengguna menggunakan akun Google.
 */

/**
 * Path callback yang didaftarkan di Google Cloud Console.
 *
 * Disimpan sebagai konstanta, bukan ditulis inline di `tentukanRedirectUri`,
 * karena path ini harus **sama persis** dengan yang terdaftar di Google: kalau
 * `redirect_uri` yang dikirim saat meminta kode berbeda dari yang dipakai saat
 * menukar kode, Google menolak pertukaran itu. Satu definisi membuat
 * `.env.example`, route, dan test tidak bisa diam-diam berbeda.
 */
export const PATH_CALLBACK_GOOGLE = "/api/auth/callback/google";

export interface KonfigurasiGoogle {
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  aktif: boolean;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  id_token?: string;
  scope: string;
  token_type: string;
  refresh_token?: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

/**
 * Baca kredensial Google OAuth dari environment.
 */
export function ambilKonfigurasiGoogle(): KonfigurasiGoogle {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || null;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || null;

  return {
    clientId,
    clientSecret,
    redirectUri,
    aktif: Boolean(clientId && clientSecret),
  };
}

/**
 * Bangun URL otorisasi Google OAuth 2.0.
 */
export function buatUrlOauthGoogle(options: {
  redirectUri: string;
  state: string;
}): string {
  const { clientId } = ambilKonfigurasiGoogle();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID belum dikonfigurasi.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: options.state,
    access_type: "online",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Tukar authorization code dengan access token dari Google.
 */
export async function tukarCodeGoogle(options: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = ambilKonfigurasiGoogle();
  if (!clientId || !clientSecret) {
    throw new Error("Kredensial Google OAuth belum dikonfigurasi.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code: options.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: options.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Gagal menukar kode Google: ${response.status} ${errorBody}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

/**
 * Ambil data profil pengguna dari endpoint UserInfo Google.
 */
export async function ambilProfilGoogle(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Gagal mengambil profil Google: ${response.status}`);
  }

  return (await response.json()) as GoogleProfile;
}

/**
 * Origin publik untuk membangun redirect — `host` + skema dari header.
 *
 * `request.url` **tidak boleh** dipakai untuk redirect di belakang reverse
 * proxy. Next menyusun `request.url` dari alamat server yang menerima
 * koneksi, jadi di VPS di belakang nginx hasilnya `http://localhost:3000`,
 * bukan host yang diketik pengguna. Gejalanya redirect setelah login mendarat
 * di localhost milik komputer pengguna, bukan di situs.
 *
 * `Host` menang atas `x-forwarded-host` — alasan yang sama dengan
 * `tentukanRedirectUri`: `X-Forwarded-*` bisa disuplai klien, sedangkan `Host`
 * adalah host yang benar-benar dilayani. `x-forwarded-proto` tetap dipercaya
 * karena skema tidak memilih tujuan, hanya menentukan `http` atau `https`.
 */
export function originPublik(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("host") || request.headers.get("x-forwarded-host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "http";
  return `${proto}://${host}`;
}

/**
 * Tentukan callback redirect URI yang tepat.
 *
 * Prioritas:
 * 1. Nilai eksplisit dari `GOOGLE_REDIRECT_URI` bila diatur.
 * 2. Origin request (`host` + skema) + `PATH_CALLBACK_GOOGLE`.
 *
 * Kalau reverse proxy menulis ulang `Host` ke host internal, tetapkan
 * `GOOGLE_REDIRECT_URI` eksplisit — jebakan yang sama seperti di `.env.example`,
 * dan gejalanya Google menolak kodenya, bukan error yang menyebut host.
 */
export function tentukanRedirectUri(request: Request): string {
  const envRedirect = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (envRedirect) return envRedirect;

  return `${originPublik(request)}${PATH_CALLBACK_GOOGLE}`;
}

/**
 * Pemetaan pesan galat ramah untuk pengguna akhir.
 */
export const GALAT_OAUTH: Readonly<Record<string, string>> = {
  oauth_cancelled: "Masuk dengan Google dibatalkan.",
  invalid_state: "Sesi otentikasi Google kedaluwarsa atau tidak valid. Silakan coba lagi.",
  missing_code: "Kode otorisasi Google tidak ditemukan.",
  oauth_exchange_failed: "Gagal bertukar token dengan Google. Silakan coba lagi.",
  unverified_email: "Akun Google tidak memiliki email yang terverifikasi.",
  account_inactive: "Akun Anda dinonaktifkan. Silakan hubungi admin.",
  oauth_not_configured: "Google OAuth belum dikonfigurasi di server.",
  db_error: "Gagal memproses pembuatan atau pembaruan akun pengguna.",
};

export function terjemahkanGalatOAuth(kode?: string | null): string | undefined {
  if (!kode) return undefined;
  return GALAT_OAUTH[kode] ?? "Terjadi kesalahan saat masuk dengan Google.";
}
