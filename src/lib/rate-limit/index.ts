/**
 * index.ts — permukaan Rate Limit untuk seluruh server, **server-only**.
 *
 * ## Kontrak server-only
 * Repo ini tidak memakai paket `server-only`; modul server-only ditandai lewat
 * komentar eksplisit, sama seperti `src/lib/learning/session.ts` dan
 * `src/lib/performa/store.ts`. Jangan impor modul ini dari komponen klien.
 *
 * ## Satu proses VPS
 * Rate limit selalu memakai bucket memori proses. Batas dan kebijakan tetap
 * sama, tetapi bucket hanya dibagi antar-request dalam proses ini: deployment
 * MVP harus menjalankan satu proses server. Restart menghapus semua bucket;
 * mekanisme ini bukan proteksi distributed dan tidak cocok untuk multi-instance.
 * Kegagalan pembatas tetap mengikuti kebijakan `failOpen` masing-masing.
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

export type { HasilBatasi, KonteksPembatasan, Pembatas } from "./contract";
export { AMBANG, NAMA_KEBIJAKAN, identifierUntuk } from "./kebijakan";
export type { NamaKebijakan, SpesifikasiKebijakan } from "./kebijakan";
export { ENV_PERCAYA_X_REAL_IP, ipTercepat } from "./identitas";

/**
 * Hasil satu pemeriksaan penjagaan.
 *
 * `gagal` hanya muncul untuk kebijakan gagal-tertutup saat pembatas tidak
 * dapat digunakan — pemanggil **wajib** membalas 503, bukan 429: penyebabnya bukan
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

/** Cache pembatas per kebijakan untuk proses server ini. */
const cache = new Map<NamaKebijakan, Pembatas>();

/**
 * Ambil pembatas memori untuk sebuah kebijakan, membuatnya sekali bila perlu.
 */
export function resolvePembatas(nama: NamaKebijakan): Pembatas {
  const tersimpan = cache.get(nama);
  if (tersimpan) return tersimpan;
  const baru = buatPembatasMemori(nama);
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
 *   dipanggil **di dalam** `try`, sehingga kegagalan memori tunduk pada
 *   `failOpen` kebijakan yang sama. Kebijakan fail-open meloloskan dengan
 *   catatan log, dan fail-closed membalas 503 lewat `gagal`.
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
    // untuk deployment yang salah konfigurasi — misalnya tanpa reverse proxy
    // yang menyetel header. Karena itu request dilewatkan dengan catatan keras
    // dan eksplisit; pastikan VPS berada di belakang proxy yang menyetel header.
    const pesan =
      `[rate-limit] ${nama}: IP tepercaya tidak dapat ditentukan (tidak ada ` +
      `x-vercel-forwarded-for, dan x-real-ip hanya dibaca bila ` +
      `${ENV_PERCAYA_X_REAL_IP}=1). Kebijakan tidak dapat ditegakkan untuk ` +
      `request ini. Pastikan deployment berada di belakang proxy yang menyetel ` +
      `header tersebut.`;
    // Tidak ada bucket yang dapat diperiksa. Identitas yang hilang selalu
    // berarti "tidak dapat dibatasi", sehingga keputusan ini tidak boleh
    // bergantung pada `failOpen`.
    console.error(pesan);
    return { tipe: "lolos", hasil: [] };
  }

  try {
    // Konstruksi di dalam `try`: lihat docstring. Override test dihormati apa
    // adanya.
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
