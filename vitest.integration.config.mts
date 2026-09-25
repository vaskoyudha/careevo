import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Impor tanpa ekstensi, dan itu disengaja. Menambahkan `.ts` di sini memang
// akan membungkam peringatan `configLoader: 'native'` dari Vite, tetapi
// `tsc` repo ini menolak spesifier berakhiran `.ts` selain
// `allowImportingTsExtensions` diaktifkan — dan opsi itu tidak boleh
// dinyalakan sembarangan karena ia melonggarkan resolusi modul di seluruh
// repositori. Peringatan itu menyangkut perubahan default Vite di rilis major
// berikutnya, bukan kegagalan hari ini: Vitest tetap memuat globalSetup lewat
// pipeline transform-nya sendiri, dan run-nya lulus. Subagent berikutnya:
// jangan "perbaiki" baris ini tanpa memindahkan setup ke `.mjs` sekaligus
// memindahkan logika penamaan basis data keluar dari TypeScript.
import { rencanaBasisDataTest } from "./scripts/test-db-setup";

/**
 * Config Vitest untuk test integrasi database — `npm run test:db`.
 *
 * Terpisah dari `vitest.config.mts` dengan sengaja: test default (`npm test`)
 * harus tetap hijau di mesin tanpa Docker, sedangkan berkas di sini justru
 * **menuntut** PostgreSQL hidup. Karena keduanya tidak bisa benar sekaligus di
 * satu config, pemisahannya dilakukan di dua tempat:
 *
 * 1. `vitest.config.mts` mengecualikan `src/**\/*.integration.test.ts`;
 * 2. berkas ini hanya meng-include berkas itu.
 *
 * Nama berkas test adalah kontraknya. Sebuah test integrasi yang lupa memakai
 * sufiks `.integration.test.ts` akan ikut `npm test` biasa dan gagal di mesin
 * tanpa Docker — jadi sufiks itu bukan konvensi gaya, ia yang menjaga janji
 * "`npm test` tidak butuh database".
 */

// Rencana basis data dibuat **di sini**, di proses Vitest, sebelum worker
// mana pun lahir. `globalSetup` (proses yang sama) lalu membaca seed yang
// sudah tersimpan di env dan membuat basis datanya. Karena `TEST_DATABASE_URL`
// di bawah sudah menunjuk basis data ephemeral itu, modul aplikasi yang
// diimpor test memakai `getDb()` tanpa perlu perlakuan khusus — lihat
// `src/lib/db/client.ts`.
const rencana = rencanaBasisDataTest();

export default defineConfig({
  resolve: {
    alias: {
      // `fileURLToPath`, bukan `.pathname`: pathname meng-encode karakter
      // seperti spasi menjadi `%20` dan direktori yang memuatnya akan gagal
      // di-resolve. Config default memakai bentuk yang sama, dan keduanya
      // harus menunjuk folder yang sama.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // SEMUA berkas test integrasi berbagi SATU basis data ephemeral, dan
    // tiap berkas memakai `TRUNCATE ... CASCADE` di `beforeEach`. Bila berkas
    // dijalankan paralel, TRUNCATE satu berkas menghapus baris yang baru
    // di-insert berkas lain di tengah test — gejalanya FK violation atau
    // "expected length 1 but got 0" yang acak dan menyesatkan. Karena itu
    // integrasi berjalan **sekuensial** (satu berkas selesai, baru berikutnya).
    // Biaya waktunya kecil dibanding data korup yang tidak bisa dipercaya.
    fileParallelism: false,
    // Migrasi dan DDL di PostgreSQL berarti test ini jauh lebih lambat dari
    // test unit; batas default Vitest (5 detik) terlalu ketat pada koneksi
    // pertama (drizzle-kit perlu menyiapkan skema migrasi).
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Fail cepat bila database tidak ada. Sejak Vitest 3, `globalSetup`
    // dijalankan sekali di proses Vitest — kegagalannya menggagalkan run.
    globalSetup: ["./scripts/test-db-setup.ts"],
    env: {
      TEST_DATABASE_URL: rencana.url,
      // Secret/TTL tidak dibutuhkan fondasi DB, tapi sebagian test Fase 1
      // berikutnya akan memakainya; nilai dev yang jelas membuat test tidak
      // bergantung pada `.env` lokal siapa pun.
      NODE_ENV: "test",
    },
  },
});
