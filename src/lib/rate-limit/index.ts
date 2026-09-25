/**
 * index.ts — permukaan Rate Limit untuk seluruh server, **server-only**.
 *
 * ## Kontrak server-only
 * Repo ini tidak memakai paket `server-only` (tidak ada di `package.json`), dan
 * konvensi yang berlaku adalah komentar modul eksplisit — sama seperti
 * `src/lib/learning/session.ts` dan `src/lib/performa/store.ts`. Modul ini
 * mengimpor `@upstash/redis`, jadi ia **tidak boleh** diimpor dari komponen
 * klien. Memasang paket `server-only` akan membuat Vitest gagal me-resolve
 * (environment `node` memakai kondisi "node", bukan "react-server"), jadi
 * penjagaan dilakukan dengan konvensi, sama seperti modul server-only lain di
 * repo ini.
 *
 * ## Satu jalur, tanpa fallback produksi
 * `resolvePembatas()` adalah **satu-satunya** tempat yang memilih implementasi:
 *   - `NODE_ENV === "production"` → Upstash Redis. Env yang hilang **melempar**.
 *     Tidak ada `try/catch` yang turun ke memori. Fallback semacam itu akan
 *     terlihat seperti proteksi yang bekerja sementara justru menghapusnya.
 *   - selain itu → pembatas memori, yang hanya hidup di dev/test dan tidak
 *     pernah dipilih di produksi.
 *
 * ## Dua mode kegagalan yang dibedakan dengan sengaja
 *   1. **Redis tidak dikonfigurasi** (`UPSTASH_REDIS_REST_*` kosong atau URL
 *      malformasi) → startup produksi gagal lewat `assertRateLimitSiapProduksi()`
 *      (dipanggil dari `instrumentation.ts`). Panggilan per-request tidak
 *      melempar keluar: `resolvePembatas()` dipanggil di dalam `try` di
 *      `batasiPermintaan()`, sehingga kegagalan konstruksi tunduk pada
 *      `failOpen` kebijakan yang sama seperti kegagalan koneksi — fail-open
 *      diloloskan dengan catatan log, fail-closed menjadi 503. Gerbang startup
 *      tetap menjadi pertahanan utamanya; per-request adalah jaring pengaman
 *      agar satu kebijakan yang salah tidak menjatuhkan seluruh permukaan.
 *   2. **Redis tidak dapat dihubungi saat request** → ditangani per kebijakan
 *      lewat `failOpen`. Kebijakan yang gagal-tertutup mengembalikan `gagal`
 *      (pemanggil membalas 503); yang gagal-terbuka meloloskan request dan
 *      mencatat alasan eksplisit. Tidak ada nilai default implisit.
 */

import {
  AMBANG,
  RESET_ISO,
  identifierUntuk,
  type NamaKebijakan,
} from "./kebijakan";
import { ENV_PERCAYA_X_REAL_IP } from "./identitas";
import type {
  HasilBatasi,
  KonteksPembatasan,
  Pembatas,
} from "./contract";
import { buatPembatasMemori } from "./memori";
import { checkUpstashEnv, createUpstashLimiter, pesanEnvUpstash } from "./upstash";

export type { HasilBatasi, KonteksPembatasan, Pembatas } from "./contract";
export { AMBANG, NAMA_KEBIJAKAN, identifierUntuk } from "./kebijakan";
export type { NamaKebijakan, SpesifikasiKebijakan } from "./kebijakan";
export { ENV_PERCAYA_X_REAL_IP, ipTercepat } from "./identitas";

/**
 * Hasil satu pemeriksaan penjagaan.
 *
 * `gagal` hanya muncul untuk kebijakan gagal-tertutup saat Redis tidak dapat
 * dihubungi — pemanggil **wajib** membalas 503, bukan 429: penyebabnya bukan
 * pemakaian berlebih, dan mencampurnya dengan 429 akan menyesatkan klien yang
 * menghormati `Retry-After`.
 */
export type HasilPenjagaan =
  | { readonly tipe: "lolos"; readonly hasil: readonly HasilBatasi[] }
  | { readonly tipe: "dibatasi"; readonly hasil: HasilBatasi }
  | { readonly tipe: "gagal"; readonly pesan: string };

/**
 * Akhir response karena sebuah kebijakan menolak. `undefined` berarti boleh
 * lanjut. Dipakai oleh Server Action lewat `cekBatasiAksi()`.
 *
 * Hanya membawa pesan: Server Action tidak dapat membalas header, jadi
 * `Retry-After` mentah tidak punya tempat tujuan di state action dan tidak
 * dikirim agar state tetap ringkas dan tidak membocorkan nilai internal.
 */
export interface KegagalanBatasi {
  readonly pesan: string;
}

/** Keadaan environment yang relevan untuk gerbang startup. Dapat diisi test. */
export interface KeadaanRateLimit {
  readonly nodeEnv: string | undefined;
  readonly nextPhase: string | undefined;
  readonly upstash: ReturnType<typeof checkUpstashEnv>;
}

function keadaanSekarang(): KeadaanRateLimit {
  return {
    nodeEnv: process.env.NODE_ENV,
    nextPhase: process.env.NEXT_PHASE,
    upstash: checkUpstashEnv(),
  };
}

/**
 * Penjaga startup produksi.
 *
 * Dipanggil dari `instrumentation.ts` `register()` — satu titik, sekali per
 * proses, sebelum server siap menerima request. Kegagalan rate-limit **saja**
 * yang membuat start gagal; ini bukan validasi secret (itu di luar lingkup
 * perubahan ini) dan sengaja tidak menyentuh `SESSION_SECRET`, attestation,
 * signup/demo/review authorization, atau security header.
 *
 * `NEXT_PHASE === "phase-production-build"` dikecualikan: `next build` memang
 * menjalankan modul server dengan `NODE_ENV=production`, dan build tidak boleh
 * menuntut kredensial runtime (build di CI tidak memilikinya). Env ini diisi
 * Next saat build; pada `next start` ia tidak ada, sehingga pemeriksaan tetap
 * berjalan sebelum server menerima request.
 *
 * @throws Error bila produksi (bukan build) dan env Upstash tidak diisi.
 */
export function assertRateLimitSiapProduksi(
  keadaan: KeadaanRateLimit = keadaanSekarang(),
): void {
  if (keadaan.nodeEnv !== "production") return;
  if (keadaan.nextPhase === "phase-production-build") return;
  if (!keadaan.upstash.ok) {
    throw new Error(pesanEnvUpstash(keadaan.upstash.missing));
  }
}

/** Cache per kebijakan: klien Redis HTTP boleh dipakai ulang antar request. */
const cache = new Map<NamaKebijakan, Pembatas>();

/**
 * Ambil pembatas untuk sebuah kebijakan, membuatnya sekali bila belum ada.
 *
 * @throws Error bila `NODE_ENV=production` dan env Upstash tidak diisi.
 */
export function resolvePembatas(nama: NamaKebijakan): Pembatas {
  const tersimpan = cache.get(nama);
  if (tersimpan) return tersimpan;
  const baru =
    process.env.NODE_ENV === "production"
      ? createUpstashLimiter(nama)
      : buatPembatasMemori(nama);
  cache.set(nama, baru);
  return baru;
}

/**
 * Periksa satu request terhadap sebuah kebijakan.
 *
 * @param nama kebijakan dari `AMBANG`.
 * @param konteks IP tepercaya / principal / kunci kebijakan. Turunkan IP dengan
 *   `ipTercepat()` dari header request, bukan dengan membaca cookie atau body.
 * @param pembatas override untuk test. Bila tidak diisi, `resolvePembatas(nama)`
 *   dipanggil **di dalam** `try`: konstruksi pembatas produksi dapat melempar
 *   (env Upstash hilang/malformasi, `new Redis` gagal), dan kegagalan itu harus
 *   tunduk pada `failOpen` kebijakan yang sama — bukan melempar keluar dari
 *   fungsi ini. Kebijakan fail-open lalu meloloskan dengan catatan log, dan
 *   fail-closed membalas 503 lewat `gagal`.
 */
export async function batasiPermintaan(
  nama: NamaKebijakan,
  konteks: KonteksPembatasan,
  pembatas?: Pembatas,
): Promise<HasilPenjagaan> {
  const spesifikasi = AMBANG[nama];
  const identifiers = identifierUntuk(nama, konteks);

  if (identifiers.length === 0) {
    // Tidak ada satu pun identitas yang dapat dipakai (tidak ada header IP
    // tepercaya dan tidak ada principal). Rate limiting per pemanggil tidak
    // mungkin dijalankan, jadi memblokir hanya akan menjadi pemadaman total
    // untuk deployment yang salah konfigurasi — mis. VPS yang dipakai langsung
    // tanpa reverse proxy yang menyetel header. Karena itu request dilewatkan
    // dengan catatan yang keras dan eksplisit; pada topologi yang ditetapkan
    // (Vercel di depan) kasus ini tidak terjadi karena Vercel selalu menyetel
    // `x-vercel-forwarded-for`.
    const pesan =
      `[rate-limit] ${nama}: IP tepercaya tidak dapat ditentukan (tidak ada ` +
      `x-vercel-forwarded-for, dan x-real-ip hanya dibaca bila ` +
      `${ENV_PERCAYA_X_REAL_IP}=1). Kebijakan tidak dapat ditegakkan untuk ` +
      `request ini. Pastikan deployment berada di belakang proxy yang menyetel ` +
      `header tersebut.`;
    // Tidak ada bucket sama sekali, jadi tidak ada Redis yang perlu dihubungi —
    // identitas yang hilang selalu berarti "tidak dapat dibatasi", bukan "Redis
    // mati", sehingga keputusan ini tidak boleh bergantung pada `failOpen`.
    console.error(pesan);
    return { tipe: "lolos", hasil: [] };
  }

  try {
    // Konstruksi di dalam `try`: lihat docstring. Override test dihormati apa
    // adanya, sehingga test tidak perlu menyentuh env Upstash.
    const dipakai = pembatas ?? resolvePembatas(nama);
    const hasil: HasilBatasi[] = [];
    for (const identifier of identifiers) {
      const keputusan = await dipakai.batasi(identifier);
      hasil.push(keputusan);
      if (!keputusan.sukses) return { tipe: "dibatasi", hasil: keputusan };
    }
    return { tipe: "lolos", hasil };
  } catch (error) {
    const pesan = `[rate-limit] ${nama}: ${pesanRingkas(error)}`;
    if (spesifikasi.failOpen) {
      // Kegagalan senyap adalah akar masalah yang dicegah modul ini; setiap
      // fail-open harus terlihat di log dengan kebijakan dan alasannya.
      console.error(`${pesan} — kebijakan fail-open, request diloloskan.`);
      return { tipe: "lolos", hasil: [] };
    }
    console.error(`${pesan} — kebijakan fail-closed, request ditolak (503).`);
    return { tipe: "gagal", pesan };
  }
}

/** Detail error yang aman dicatat: tanpa respons mentah provider. */
function pesanRingkas(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return "kesalahan tidak diketahui";
}

/** Detik `Retry-After`, dibulatkan ke atas dan minimal 1 detik. */
export function retryAfterDetik(resetMs: number, sekarang = Date.now()): number {
  const selisih = Math.ceil((resetMs - sekarang) / 1000);
  return selisih > 0 ? selisih : 1;
}

/**
 * Header rate limit untuk response 429.
 *
 * `Retry-After` wajib; tiga header `RateLimit-*` mengikuti draft IETF dan tidak
 * merugikan. Saat diblokir `RateLimit-Remaining` selalu 0.
 */
export function headerRateLimit(
  nama: NamaKebijakan,
  hasil: HasilBatasi,
): Record<string, string> {
  return {
    "Retry-After": String(retryAfterDetik(hasil.resetMs)),
    "RateLimit-Limit": String(hasil.limit),
    "RateLimit-Remaining": String(hasil.sisa),
    "RateLimit-Reset": RESET_ISO[nama],
  };
}
