/**
 * upstash.ts — adapter Rate Limit produksi, **server-only**.
 *
 * Mengapa Upstash Redis (keputusan Fase 0, bukan preferensi): constraint yang
 * mengunci pilihannya adalah backend di VPS sedangkan permukaan yang dibatasi
 * ada di Vercel (RSC + Server Action + Route Handler), dan keduanya harus
 * menghitung bucket yang sama. Itu menuntut counter **shared lintas instance**,
 * bukan memori per-proses: `Map` per-proses akan memberi setiap lambda Vercel
 * dan setiap proses Next kuota sendiri, sehingga batasnya berlipat sebanyak
 * jumlah instance dan tidak dapat diandalkan sebagai kontrol produksi. Upstash
 * adalah HTTP-based (tanpa koneksi TCP yang bocor di serverless) dan itulah
 * alasan satu-satunya ia masuk sebagai dependency.
 *
 * Berkas ini mengimpor `@upstash/redis`, jadi ia **tidak boleh** diimpor dari
 * komponen klien. Lihat komentar modul di `./index.ts` untuk kontrak server-only
 * yang berlaku di repo ini.
 *
 * ## Tanpa fallback in-memory di production — dan mengapa
 * Kegagalan Redis TIDAK boleh diam-diam turun ke penghitung memori. Fallback
 * semacam itu justru menghapus proteksi tepat ketika penyerang membebani
 * backend, dan yang lebih buruk: ia terlihat seperti enforcement yang bekerja.
 * Karena itu `createUpstashLimiter()` **melempar** bila env Upstash tidak ada.
 * Kegagalan Redis saat request berjalan ditangani pemanggil lewat `failOpen`
 * (`./index.ts`, `batasiPermintaan()`), bukan di sini.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  AMBANG,
  penandaLingkungan,
  type NamaKebijakan,
  type SpesifikasiKebijakan,
} from "./kebijakan";
import type { HasilBatasi, Pembatas } from "./contract";

/** Berapa lama awaiter kita menunggu Redis sebelum menyerah dan (default) meloloskan. */
export const TIMEOUT_MS = 1000;

/**
 * Prefiks kunci Redis.
 *
 * Harus memuat versi kebijakan: bila `AMBANG` diubah, bucket harus terpisah,
 * bukan mewarisi penghitungan kebijakan lama dengan limit baru. `penandaLingkungan()`
 * menambahkan label environment supaya staging dan produksi tidak berbagi bucket
 * saat kebetulan memakai satu database Redis.
 */
export const PREFIX = "careevo:rl:v1";

export interface UpstashEnv {
  readonly url: string;
  readonly token: string;
}

/**
 * Bentuk minimal lingkungan yang dibaca berkas ini.
 *
 * Sengaja berupa peta, bukan properti bernama, agar `process.env` (bertipe index
 * signature) dapat dioper langsung — pola yang sama dipakai
 * `@/lib/http/origin`. Parameter ini juga yang membuat validasi URL dapat diuji
 * secara adversarial tanpa mengubah `process.env` global (test berjalan paralel
 * dalam satu proses, jadi menulis env di test adalah sumber kerapuhan).
 */
export type LingkunganUpstash = Readonly<Record<string, string | undefined>>;

export interface UpstashEnvCheck {
  readonly ok: boolean;
  /**
   * Nama variabel yang hilang — pesan galat menyebut ini agar dapat diperbaiki.
   * Variabel yang ada tetapi nilainya tidak sah (mis. URL malformasi) juga
   * dilaporkan di sini: dari sudut pandang pemanggil keduanya sama-sama "tidak
   * dapat dipakai sebagai kredensial".
   */
  readonly missing: string[];
}

/**
 * Nama variabel yang nilainya ada tetapi tidak dapat dipakai.
 *
 * Dipisahkan dari `missing` supaya pesan galat dapat membedakan "belum diisi"
 * dari "diisi tetapi salah" — keduanya menggagalkan start, tetapi hanya yang
 * kedua sering terlewat saat diperiksa manusia (env tampak terisi).
 */
export const VAR_MALFORMASI = {
  url: "UPSTASH_REDIS_REST_URL (bukan URL http/https yang valid)",
} as const;

/**
 * URL Redis REST harus benar-benar HTTP(S) yang dapat di-parse.
 *
 * Mengapa tidak cukup "ada isinya": `new Redis({ url })` dari `@upstash/redis`
 * tidak melempar saat dibangun dengan URL malformasi — konstruksi klien baru
 * gagal saat request pertama. Tanpa validasi di sini, `checkUpstashEnv()` akan
 * melaporkan `ok: true` untuk `UPSTASH_REDIS_REST_URL=redis://x` atau
 * `=not a url`, sehingga `assertRateLimitSiapProduksi()` meloloskan boot dan
 * seluruh kebijakan fail-closed baru ketahuan rusak saat melayani traffic —
 * tepat kegagalan yang seharusnya dicegah gerbang startup ini.
 *
 * Skema dibatasi `http:`/`https:` karena endpoint Redis REST adalah REST API
 * HTTP; `redis://` adalah alamat protokol Redis mentah yang tidak pernah
 * dilayani `@upstash/redis`.
 */
function urlUpstashValid(nilai: string): boolean {
  let url: URL;
  try {
    url = new URL(nilai);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * Cek env Upstash **tanpa melempar**, supaya pemanggil dapat memilih fail-fast
 * atau fail-open. Nilai di-trim dan hanya string non-kosong yang dihitung ada.
 *
 * URL yang ada tetapi malformasi (tidak dapat di-parse, atau berskema selain
 * http/https) dihitung tidak ada. Tanpa pemeriksaan itu, gerbang startup akan
 * meloloskan boot dengan kredensial yang pasti gagal saat request pertama —
 * lihat `urlUpstashValid()`.
 *
 * `Redis.fromEnv()` juga menerima fallback Vercel KV (`KV_REST_API_URL` /
 * `KV_REST_API_TOKEN`); sengaja **tidak** dipakai di sini karena `fromEnv` akan
 * diam-diam memakai instance Redis lain bila kedua pasangan itu ada, dan
 * penghitung guard lalu tidak lagi satu bucket di semua permukaan.
 *
 * @param env default `process.env`; test dapat memberi peta sendiri.
 */
export function checkUpstashEnv(
  env: LingkunganUpstash = process.env,
): UpstashEnvCheck {
  const url = (env.UPSTASH_REDIS_REST_URL ?? "").trim();
  const token = (env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();
  const missing: string[] = [];
  if (!url) missing.push("UPSTASH_REDIS_REST_URL");
  else if (!urlUpstashValid(url)) missing.push(VAR_MALFORMASI.url);
  if (!token) missing.push("UPSTASH_REDIS_REST_TOKEN");
  return { ok: missing.length === 0, missing };
}

/** Pesan galat yang menyebut tindakan perbaikan, bukan sekadar "tidak valid". */
export function pesanEnvUpstash(missing: readonly string[]): string {
  return [
    `Rate limiting produksi membutuhkan Upstash Redis, tetapi variabel berikut tidak diisi atau tidak valid: ${missing.join(", ")}.`,
    "Renderer Vercel dan backend VPS harus memakai database Redis yang SAMA agar batasnya benar-benar shared.",
    "Isi nilai dari konsol Upstash pada environment yang sesuai (Vercel: Project Settings → Environment Variables).",
    "Rate limiting TIDAK akan turun ke penghitung in-memory: itu akan tampak seperti proteksi yang bekerja sementara justru menghapusnya.",
  ].join(" ");
}

/**
 * Buat pembatas produksi.
 *
 * @throws Error bila `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` kosong.
 *   Melempar — bukan fallback — adalah inti kontrak produksi berkas ini.
 */
export function createUpstashLimiter(
  nama: NamaKebijakan,
  env: UpstashEnvCheck = checkUpstashEnv(),
): Pembatas {
  if (!env.ok) throw new Error(pesanEnvUpstash(env.missing));

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!.trim(),
    token: process.env.UPSTASH_REDIS_REST_TOKEN!.trim(),
  });

  const spesifikasi: SpesifikasiKebijakan = AMBANG[nama];
  const ratelimit = new Ratelimit({
    redis,
    prefix: `${PREFIX}:${penandaLingkungan()}:${nama}`,
    limiter: Ratelimit.slidingWindow(spesifikasi.limit, spesifikasi.window),
    // `ephemeralCache: false` mematikan cache blokir lokal, dan itu pengaman
    // lintas-instance: bila cache dinyalakan, sebuah identifier yang baru saja
    // diblokir tidak akan memanggil Redis sama sekali, sehingga hitungan di
    // server lain (VPS worker, instance Vercel lain) berhenti sinkron dan limit
    // efektif menjadi lebih longgar dari yang dinegosiasikan.
    //
    // Di `dist/index.mjs` (Ratelimit constructor) hanya ada dua cabang:
    // `instanceof Map` (pakai Map yang diberikan) dan `=== void 0` (buat Map
    // baru). Nilai `false` tidak cocok dengan keduanya, sehingga `ctx.cache`
    // tetap `undefined` dan seluruh jalur `ctx.cache.isBlocked` / `blockUntil`
    // dilewati. Artinya cache tidak "setara nonaktif" — ia benar-benar tidak ada,
    // dan setiap `limit()` memanggil Redis.
    ephemeralCache: false,
    analytics: false,
    timeout: TIMEOUT_MS,
  });

  return {
    async batasi(identifier: string): Promise<HasilBatasi> {
      const hasil = await ratelimit.limit(identifier);

      // `@upstash/ratelimit` TIDAK melempar saat Redis tidak menjawab dalam
      // `timeout`. Ia menyelesaikan dengan `{ success: true, reason: "timeout" }`
      // (lihat dist/index.mjs, `applyTimeout`). Meloloskannya apa adanya akan
      // membuat "Redis mati" terbaca sebagai "boleh lewat" — tepat kegagalan
      // yang tampak seperti proteksi padahal menghapusnya, dan khususnya
      // mematikan kebijakan fail-closed (login, signup, verify, PDF publik).
      //
      // Karena itu timeout diterjemahkan menjadi error di sini, supaya
      // `batasiPermintaan()` menerapkan `failOpen` per kebijakan: fail-closed
      // menjadi 503, fail-open diloloskan dengan catatan log eksplisit.
      if (hasil.reason === "timeout") {
        throw new Error(
          `Redis tidak menjawab dalam ${TIMEOUT_MS} ms untuk kebijakan ${nama}.`,
        );
      }

      return {
        sukses: hasil.success,
        limit: hasil.limit,
        sisa: hasil.remaining,
        resetMs: hasil.reset,
      };
    },
  };
}
