/**
 * Setup basis data test integrasi — **server-only**.
 *
 * Vitest memanggil berkas ini sebagai `globalSetup` (lihat
 * `vitest.integration.config.mts`). Tugasnya: membuat basis data ephemeral
 * yang unik per run, memigrasikannya, menyerahkan URL-nya ke proses test, lalu
 * menghapusnya di teardown.
 *
 * Mengapa ephemeral, bukan basis data test yang tetap:
 *
 * - Test integrasi Fase 1 membuktikan **fresh install** — bahwa satu set
 *   migrasi dari nol menghasilkan schema yang benar. Basis data tetap yang
 *   sisa run sebelumnya tidak membuktikan itu; ia bahkan bisa menutupi
 *   migrasi yang rusak.
 * - Test yang men-drop tabel atau melanggar constraint tidak bisa merusak
 *   data dev. Itu penting karena `careevo_dev` adalah database kerja orang.
 *
 * Aturan yang dikunci:
 *
 * - **Gagal keras bila PostgreSQL tidak ada — jangan skip.** Test integrasi
 *   yang di-skip saat database tidak tersedia akan tampak "hijau" dan
 *   menyembunyikan schema yang rusak. Pesannya menyebut `docker compose`
 *   supaya jalan keluarnya jelas.
 * - **Nama basis data diturunkan dari satu seed di `process.env`**, bukan
 *   dari nilai acak di dalam fungsi. Config Vitest memanggil
 *   `rencanaBasisDataTest()` lebih dulu untuk mengisi `test.env`, dan
 *   `globalSetup` memanggilnya lagi di proses yang sama untuk membuat basis
 *   datanya — dua panggilan itu harus menghasilkan nama yang **sama**. Seed
 *   adalah saluran bersama yang membuatnya deterministik tanpa saling impor.
 * - **Nama yang diinterpolasi ke DDL selalu divalidasi lebih dulu.** `CREATE
 *   DATABASE` tidak menerima parameter terikat, jadi nama harus masuk sebagai
 *   identifier; pola `[a-z0-9_]` membuat interpolasi itu aman.
 * - `DROP DATABASE ... WITH (FORCE)` dipakai supaya sisa koneksi provaider
 *   (pool aplikasi yang belum ditutup) tidak menggagalkan pembersihan.
 *   PostgreSQL 16 mendukungnya.
 */

import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { DATABASE_URL_DEV, jalankanMigrasi, samarkanUrlDatabase } from "../src/lib/db/migrate";

/** Env yang menyimpan seed run. Di-set oleh `rencanaBasisDataTest()`. */
const ENV_SEED = "CAREEVO_TEST_DB_SEED";

/** Kunci yang di-`provide` ke test, bila test butuh URL-nya langsung. */
export const KUNCI_URL_TEST = "testDatabaseUrl";

/** Pola nama basis data yang aman diinterpolasi ke DDL. */
const POLA_NAMA_DB = /^[a-z0-9_]{1,63}$/;

export type RencanaBasisData = {
  /** Nama basis data ephemeral. Selalu cocok `POLA_NAMA_DB`. */
  namaDb: string;
  /** URL ke basis data ephemeral — inilah `TEST_DATABASE_URL`. */
  url: string;
  /** URL ke basis data admin (`postgres`) yang dipakai untuk CREATE/DROP. */
  urlAdmin: string;
  /** URL dasar yang dipakai sebelum nama diganti — untuk pesan diagnostik. */
  urlDasar: string;
};

/**
 * URL dasar: tempat PostgreSQL-nya, tanpa menentukan basis data mana.
 * `DATABASE_URL` menang supaya test dapat diarahkan ke server lain (mis. CI),
 * lalu fallback dev.
 */
function urlDasar(): string {
  const dariEnv = process.env.DATABASE_URL;
  if (dariEnv && dariEnv.trim().length > 0) return dariEnv;
  return DATABASE_URL_DEV;
}

/**
 * Menukar nama basis data pada sebuah URL.
 *
 * Dikerjakan dengan `URL`, bukan penggantian string: password atau nama host
 * bisa saja memuat garis miring, dan penggantian teks akan merusaknya.
 */
function denganNamaBasisData(url: string, namaDb: string): string {
  const u = new URL(url);
  u.pathname = `/${namaDb}`;
  return u.toString();
}

/**
 * Rencana basis data untuk run ini.
 *
 * Idempoten dalam satu proses: panggilan pertama membuat seed, panggilan
 * berikutnya (config dan `globalSetup`) membaca seed yang sama dari env dan
 * menghasilkan rencana identik.
 */
export function rencanaBasisDataTest(): RencanaBasisData {
  const seedAda = process.env[ENV_SEED];
  const seed =
    seedAda && seedAda.trim().length > 0
      ? seedAda
      : `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
  process.env[ENV_SEED] = seed;

  // `seed` hanya memuat huruf/angka (timestamp base36 + hex), sehingga nama
  // yang dihasilkan selalu lolos POLA_NAMA_DB.
  const namaDb = `careevo_test_${seed.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  if (!POLA_NAMA_DB.test(namaDb)) {
    throw new Error(`Nama basis data test tidak aman: ${namaDb}`);
  }

  const dasar = urlDasar();
  return {
    namaDb,
    url: denganNamaBasisData(dasar, namaDb),
    urlAdmin: denganNamaBasisData(dasar, "postgres"),
    urlDasar: dasar,
  };
}

/** Opsi koneksi admin yang seragam antara setup dan teardown. */
function opsiAdmin() {
  return {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => {},
  } as const;
}

/**
 * Pesan ringkas dari sebuah galat koneksi, sedalam apa pun ia dibungkus.
 *
 * `postgres.js` melempar `AggregateError` ketika beberapa alamat (IPv6 dan
 * IPv4 `localhost`) gagal sekaligus. `AggregateError.message`-nya **kosong** —
 * penyebab sebenarnya ada di `.errors[]`. Tanpa penelusuran ini, baris
 * "penyebab" pada pesan kegagalan akan kosong justru pada kasus yang paling
 * sering terjadi (server mati), dan pesan yang paling dibutuhkan adalah pesan
 * yang hilang.
 *
 * Kedalaman dibatasi supaya galat dengan `.cause` melingkar tidak membuat
 * fungsi ini rekursi tanpa henti.
 */
function ringkasPenyebab(err: unknown, kedalaman = 0): string {
  if (kedalaman > 5) return "<penyebab terlalu dalam>";
  if (err instanceof AggregateError) {
    const bagian = err.errors.map((e) => ringkasPenyebab(e, kedalaman + 1)).filter(Boolean);
    if (bagian.length > 0) return [...new Set(bagian)].join("; ");
  }
  if (err instanceof Error) {
    if (err.message.trim().length > 0) return err.message.trim();
    if (err.cause) return ringkasPenyebab(err.cause, kedalaman + 1);
    return err.name;
  }
  return String(err);
}

/**
 * Pesan kegagalan yang bisa langsung ditindaklanjuti. Sengaja memuat perintah
 * yang harus dijalankan — kegagalan "connection refused" tanpa konteks adalah
 * kegagalan yang membuat orang menebak.
 */
function pesanGagalSambung(rencana: RencanaBasisData, penyebab: unknown): Error {
  const sebab = ringkasPenyebab(penyebab);
  return new Error(
    [
      "Tidak dapat menyambung ke PostgreSQL untuk membuat basis data test.",
      "",
      `  server   : ${samarkanUrlDatabase(rencana.urlAdmin)}`,
      `  penyebab : ${sebab}`,
      "",
      "Jalankan PostgreSQL lokal lalu ulangi:",
      "",
      "  docker compose up -d postgres",
      "  npm run test:db",
      "",
      "Test integrasi sengaja TIDAK di-skip ketika database tidak ada:",
      "test yang di-skip akan tampak hijau dan menyembunyikan schema yang rusak.",
    ].join("\n"),
  );
}

/**
 * Dipanggil Vitest sekali sebelum seluruh suite. Membuat basis data, menjalankan
 * migrasi, lalu menyerahkan URL-nya lewat `provide` (dan lewat env, lihat config).
 */
export async function setup(project: { provide: (key: string, value: unknown) => void }) {
  const rencana = rencanaBasisDataTest();

  const admin = postgres(rencana.urlAdmin, opsiAdmin());
  try {
    await admin`select 1`;
  } catch (err) {
    await admin.end({ timeout: 5 }).catch(() => {});
    throw pesanGagalSambung(rencana, err);
  }

  try {
    // Sisa run yang gagal sebelumnya bisa meninggalkan basis data bernama
    // sama; membersihkannya lebih dulu membuat run ini tidak bergantung pada
    // kebersihan run sebelumnya.
    await admin.unsafe(`drop database if exists "${rencana.namaDb}" with (force)`);
    await admin.unsafe(`create database "${rencana.namaDb}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }

  try {
    await jalankanMigrasi(rencana.url);
  } catch (err) {
    const sebab = err instanceof Error ? err.message : String(err);
    throw new Error(
      [
        `Migrasi gagal pada basis data test ${rencana.namaDb}.`,
        "SQL migrasi ada di `drizzle/` (hasil `npm run db:generate`).",
        "",
        `  penyebab : ${sebab}`,
      ].join("\n"),
    );
  }

  project.provide(KUNCI_URL_TEST, rencana.url);
}

/**
 * Dipanggil Vitest sekali setelah seluruh suite — termasuk ketika suite gagal.
 * `WITH (FORCE)` memutus koneksi yang masih terbuka supaya DROP tidak diblokir
 * oleh pool aplikasi yang belum ditutup.
 */
export async function teardown() {
  const rencana = rencanaBasisDataTest();
  const admin = postgres(rencana.urlAdmin, opsiAdmin());
  try {
    await admin.unsafe(`drop database if exists "${rencana.namaDb}" with (force)`);
  } finally {
    await admin.end({ timeout: 5 }).catch(() => {});
  }
}
