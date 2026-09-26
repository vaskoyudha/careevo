/**
 * Migrator programmatic — **server-only**.
 *
 * Dipakai oleh `scripts/migrate.ts` (CLI) dan `scripts/test-db-setup.ts`
 * (setup test integrasi). Keduanya menempuh jalur yang sama persis, sehingga
 * database test tidak bisa diam-diam berbeda dari database dev: kalau SQL-nya
 * gagal, ia gagal di kedua tempat.
 *
 * Migrasi dibaca dari `drizzle/` — SQL hasil `drizzle-kit generate` yang
 * di-commit. SQL yang hanya hidup di memori tidak bisa di-review dan tidak
 * bisa diputar ulang di production.
 *
 * Migrator drizzle mencatat migrasi yang sudah jalan di tabel
 * `drizzle.__drizzle_migrations`, jadi memanggilnya dua kali aman (idempoten).
 */

import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { ambilUrlDatabase, DATABASE_URL_DEV } from "./client";

/**
 * Lokasi SQL migrasi, relatif terhadap root repo.
 *
 * Sengaja memakai `process.cwd()`, sama seperti `src/lib/resume` dan
 * `src/lib/performa` membaca data mereka. Script ini dijalankan lewat npm dari
 * root, jadi perilakunya sama di mesin mana pun.
 */
export const DIREKTORI_MIGRASI = path.join(process.cwd(), "drizzle");

export type HasilMigrasi = {
  /** URL yang dimigrasikan — host-nya disamarkan saat dicetak. */
  url: string;
  durasiMs: number;
};

/**
 * Menjalankan semua migrasi yang belum diterapkan pada `url`.
 *
 * Bila `url` tidak diberikan, URL dibaca dari env dengan aturan yang sama
 * seperti `client.ts` (test menang atas dev, fallback dev di luar produksi).
 *
 * Koneksi dibuka khusus di sini dan selalu ditutup: script CLI dan globalSetup
 * harus keluar dengan bersih, dan pool yang menggantung membuat proses
 * menggantung.
 */
export async function jalankanMigrasi(url?: string): Promise<HasilMigrasi> {
  const target = url ?? ambilUrlDatabase();
  const mulai = Date.now();

  const sql = postgres(target, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });

  try {
    await migrate(drizzle(sql), { migrationsFolder: DIREKTORI_MIGRASI });
  } finally {
    await sql.end({ timeout: 5 });
  }

  return { url: target, durasiMs: Date.now() - mulai };
}

/**
 * Menyamarkan password pada URL sebelum dicetak. URL database adalah
 * kredensial; ia tidak boleh muncul utuh di log CI atau terminal bersama.
 *
 * Bila URL tidak bisa di-parse, seluruhnya diganti — lebih baik kehilangan
 * informasi host daripada membocorkan password.
 */
export function samarkanUrlDatabase(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "<url-tidak-valid>";
  }
}

/** URL dev yang dipakai bila env kosong — diekspor ulang untuk pesan bantuan script. */
export { DATABASE_URL_DEV };
