/**
 * Koneksi PostgreSQL — **server-only**.
 *
 * Modul ini membuka koneksi `postgres.js` dan mengekspos handle Drizzle serta
 * helper transaksi. Ia hanya boleh diimpor dari kode server: repository,
 * application service, server action, route handler, migrator, dan test.
 * **Jangan** mengimpornya dari komponen client, dan jangan mengimpornya ke
 * `src/lib/courses/{kurikulum,blok,halaman,kuis}.ts` — empat berkas itu
 * client-safe dan murni; satu import ke sini akan menyeret `node:net` ke
 * bundle browser.
 *
 * Aturan yang dikunci:
 *
 * - **URL dibaca dari env, tidak pernah di-hardcode untuk produksi.**
 *   `TEST_DATABASE_URL` menang atas `DATABASE_URL` supaya test integrasi dapat
 *   menunjuk basis data ephemeral tanpa menyentuh konfigurasi dev — env-nya
 *   disetel oleh `scripts/test-db-setup.ts` **sebelum** proses test mulai.
 * - **Di produksi, env kosong adalah kegagalan start**, bukan diam-diam jatuh
 *   ke kredensial dev. Fallback dev hanya berlaku di luar produksi,
 *   mengikuti pola `src/lib/config/secrets.ts`. Ini penting: `careevo_dev`
 *   adalah kredensial publik di repositori, jadi fallback yang bocor ke
 *   produksi berarti siapa pun bisa menyambung ke database.
 * - **Koneksi tidak dibuka saat modul dimuat.** `postgres()` baru dipanggil
 *   pada query pertama; `getDb()` hanya membuat objeknya. `next build`
 *   meng-import banyak modul tanpa menjalankan query, dan build yang gagal
 *   karena tidak ada database adalah build yang tidak bisa dipakai.
 * - **Pool di-cache per proses.** Di `next dev` modul dapat dievaluasi ulang
 *   saat hot reload; tanpa cache, tiap reload meninggalkan pool yang tidak
 *   pernah ditutup. `globalThis` adalah satu-satunya tempat yang selamat dari
 *   evaluasi ulang itu.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Kredensial dev yang dipublikasikan — lihat `docker-compose.yml`. */
export const DATABASE_URL_DEV = "postgres://careevo:careevo_dev@localhost:5432/careevo";

/** Ukuran pool. Cukup untuk satu server Next.js; deployment serverless harus menurunkannya. */
const MAKS_KONEKSI = 10;

/**
 * URL database yang dipakai proses ini.
 *
 * Urutan: `TEST_DATABASE_URL` → `DATABASE_URL` → fallback dev (non-produksi).
 * Di produksi, keduanya kosong berarti **setiap** panggilan melempar
 * `DatabaseUrlError` — tidak pernah fallback.
 */
export function ambilUrlDatabase(): string {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (url && url.trim().length > 0) return url;

  if (process.env.NODE_ENV === "production") {
    // Sengaja tidak ada penanda "sudah pernah dilempar". Saya sempat
    // menambahkannya untuk menghindari pesan berulang, dan itu bug: panggilan
    // kedua dan seterusnya akan **melewati** throw ini dan mengembalikan
    // kredensial dev yang publik. Satu request yang menangkap galat lalu
    // mencoba lagi sudah cukup untuk menyambung ke database yang salah.
    // Melempar berulang lebih baik daripada gagal-terbuka sekali saja.
    throw new DatabaseUrlError(
      "DATABASE_URL wajib diisi di produksi. Fallback kredensial dev " +
        "(`careevo:careevo_dev`) tidak dipakai di produksi.",
    );
  }

  return DATABASE_URL_DEV;
}

/** Kegagalan konfigurasi database yang bisa dibedakan dari kegagalan query. */
export class DatabaseUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseUrlError";
  }
}

/**
 * Bentuk koneksi yang dipakai seluruh kode server.
 *
 * Dipakai sebagai parameter tipe supaya repository dapat menerima koneksi
 * (atau transaksi) sebagai argumen — itu yang membuat satu operasi bisnis bisa
 * dijalankan di dalam satu transaksi tanpa setiap fungsi membuka koneksinya
 * sendiri.
 */
export type KoneksiDb = PostgresJsDatabase<typeof schema>;

/**
 * Transaksi Drizzle. Bentuknya sama dengan `KoneksiDb` untuk keperluan query,
 * jadi parameter bertipe ini bisa menerima keduanya.
 */
export type TransaksiDb = Parameters<Parameters<KoneksiDb["transaction"]>[0]>[0];

type CacheKoneksi = {
  sql?: ReturnType<typeof postgres>;
  db?: KoneksiDb;
  url?: string;
};

/**
 * Cache di `globalThis` supaya bertahan terhadap hot reload `next dev`.
 * Kunci `__careevo_pg` sengaja spesifik agar tidak bentrok dengan modul lain.
 */
const cacheGlobal = globalThis as typeof globalThis & { __careevo_pg?: CacheKoneksi };
const cache: CacheKoneksi = (cacheGlobal.__careevo_pg ??= {});

/**
 * Handle Drizzle untuk proses ini. Dibuat sekali, lalu dipakai ulang.
 *
 * Bila `TEST_DATABASE_URL` berubah di tengah proses (beberapa berkas test
 * integrasi memakai basis data berbeda), koneksi lama ditutup dan diganti —
 * tanpa itu, test akan diam-diam menulis ke basis data run sebelumnya.
 */
export function getDb(): KoneksiDb {
  const url = ambilUrlDatabase();

  if (cache.db && cache.url === url) return cache.db;

  if (cache.sql) {
    // Sengaja tidak di-await: `getDb()` sinkron supaya bisa dipanggil dari
    // mana saja. Penutupan koneksi lama berjalan di latar belakang.
    void cache.sql.end({ timeout: 5 }).catch(() => {});
  }

  const sql = postgres(url, {
    max: MAKS_KONEKSI,
    // `idle_timeout` membuat koneksi yang menganggur dilepas, sehingga pool
    // tidak menahan slot di server database selama proses dev menganggur.
    idle_timeout: 20,
    // Jangan menyerahkan query ke prepared statement bernama: migrator dan
    // DDL tidak kompatibel dengan prepared statement, dan prepared statement
    // yang menumpuk di session pool adalah sumber kebocoran memori.
    prepare: false,
    onnotice: () => {},
  });

  cache.sql = sql;
  cache.db = drizzle(sql, { schema });
  cache.url = url;
  return cache.db;
}

/**
 * Menutup pool proses ini. Dipakai teardown test dan script CLI; server yang
 * berjalan normal tidak perlu memanggilnya.
 */
export async function tutupDb(): Promise<void> {
  const sql = cache.sql;
  cache.sql = undefined;
  cache.db = undefined;
  cache.url = undefined;
  if (sql) await sql.end({ timeout: 5 });
}

/**
 * Menjalankan `fn` di dalam satu transaksi PostgreSQL.
 *
 * Ini helper yang dipakai subagent berikutnya: perubahan bisnis dan
 * `audit_events` (Fase 3) harus ditulis dalam transaksi yang sama. Melempar
 * dari `fn` me-rollback semuanya.
 *
 * Koneksi diteruskan ke `fn` supaya query di dalamnya memakai transaksi itu.
 * Memakai `getDb()` di dalam `fn` akan keluar dari transaksi, dan itu bug
 * yang tidak terlihat sampai ada rollback.
 */
export async function denganTransaksi<T>(
  fn: (tx: TransaksiDb) => Promise<T>,
): Promise<T> {
  return getDb().transaction(fn);
}
