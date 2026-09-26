/**
 * memori.ts — pembatas in-memory untuk **pengembangan dan test saja**.
 *
 * ## Mengapa modul ini ada, dan mengapa ia bukan fallback
 * Modul ini bukan cadangan produksi. Ia ada supaya `npm run dev` dan `npm test`
 * dapat dijalankan tanpa kredensial Upstash, dan supaya test dapat menguji
 * perilaku 429 secara deterministik. Batasnya ditegakkan di satu tempat:
 * `resolvePembatas()` di `./index.ts` **hanya** memilih modul ini ketika
 * `NODE_ENV !== "production"`. Di production ia tidak pernah dipilih, sehingga
 * tidak ada jalur yang membuat rate limiting tampak bekerja padahal hanya
 * menghitung di memori satu proses.
 *
 * Hitungannya juga **per proses**: dua instance dev akan saling tidak melihat.
 * Itu dapat diterima untuk dev dan tidak dapat diterima untuk produksi — itulah
 * batas yang dijaga oleh `resolvePembatas()`, bukan oleh modul ini.
 *
 * Jendela yang dipakai adalah *fixed window*, bukan sliding seperti Upstash.
 * Perbedaan ini disengaja: test butuh determinisme, dan yang diuji adalah
 * **keputusan** (lolos/429 + Retry-After), bukan algoritma Redis-nya.
 */

import { AMBANG, type NamaKebijakan } from "./kebijakan";
import type { HasilBatasi, Pembatas } from "./contract";

interface Catatan {
  hitung: number;
  resetMs: number;
}

/** Penyimpanan bersama satu proses. Direset eksplisit lewat `resetMemori()`. */
const gudang = new Map<string, Catatan>();

/** Jam yang dapat ditimpa test tanpa memalsukan waktu global. */
let jam: () => number = () => Date.now();

/** Buang seluruh catatan. Hanya untuk test. */
export function resetMemori(): void {
  gudang.clear();
}

/** Berapa banyak bucket yang sedang tercatat — dipakai test untuk memastikan key benar. */
export function jumlahBucketMemori(): number {
  return gudang.size;
}

/** Ganti sumber waktu. Mengembalikan fungsi pemulih agar test tidak bocor antar berkas. */
export function setJamMemori(baru: () => number): () => void {
  const sebelumnya = jam;
  jam = baru;
  return () => {
    jam = sebelumnya;
  };
}

export interface OpsiMemori {
  /** Default diambil dari `AMBANG[nama]`. Diisi test untuk menguji batas spesifik. */
  readonly limit?: number;
  readonly windowDetik?: number;
}

/**
 * Buat pembatas memori untuk satu kebijakan.
 *
 * Identifier digabung dengan nama kebijakan supaya bucket `login` untuk sebuah
 * IP tidak pernah bertabrakan dengan bucket `signup` untuk IP yang sama — sama
 * seperti prefiks Redis di adapter produksi.
 */
export function buatPembatasMemori(
  nama: NamaKebijakan,
  opsi: OpsiMemori = {},
): Pembatas {
  const spesifikasi = AMBANG[nama];
  const limit = opsi.limit ?? spesifikasi.limit;
  const windowDetik = opsi.windowDetik ?? spesifikasi.resetDetik;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`Limit memori tidak valid: ${limit}`);
  }

  return {
    async batasi(identifier: string): Promise<HasilBatasi> {
      const kunci = `${nama}|${identifier}`;
      const sekarang = jam();
      const catatan = gudang.get(kunci);
      const aktif =
        catatan && sekarang < catatan.resetMs
          ? catatan
          : { hitung: 0, resetMs: sekarang + windowDetik * 1000 };
      aktif.hitung += 1;
      gudang.set(kunci, aktif);
      return {
        sukses: aktif.hitung <= limit,
        limit,
        sisa: Math.max(0, limit - aktif.hitung),
        resetMs: aktif.resetMs,
      };
    },
  };
}
