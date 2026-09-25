import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Direktori toko performa dialihkan ke temp **sekali per run test** di sini,
// bukan di dalam tiap berkas test: `src/actions/enrollment.test.ts` memakai
// import statis sehingga env tidak bisa disetel sebelum modul toko dimuat.
//
// Env ini juga jaring pengaman, bukan cuma konfigurasi: berkas test yang butuh
// isolasi sendiri menimpanya per test (lihat `beforeEach` di `store.test.ts`),
// tapi tanpa nilai di sini, satu test yang lupa akan menulis ke `.data/` repo.
const PERFORMA_DIR = mkdtempSync(path.join(tmpdir(), "careevo-performa-"));

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { CAREEVO_PERFORMA_DIR: PERFORMA_DIR },
  },
});
