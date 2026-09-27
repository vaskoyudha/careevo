/**
 * Seed seluruh konten kursus Careevo — satu perintah untuk seluruh katalog.
 *
 * Pakai: `npx tsx scripts/seed/konten/index.ts`
 *
 * Menjalankan berulang aman (idempoten). Lihat `engine.ts` untuk sifat yang
 * dikunci. Daftar kursusnya ada di `daftar.ts` (murni, bisa diimpor test).
 */

import { jalankanSeed } from "./engine";
import { SEMUA_KURSUS_SEED } from "./daftar";

async function main() {
  console.log(`Seed konten: ${SEMUA_KURSUS_SEED.length} kursus\n`);
  await jalankanSeed(SEMUA_KURSUS_SEED);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
