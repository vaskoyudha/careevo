/**
 * CLI migrasi — `npm run db:migrate`.
 *
 * Dijalankan lewat `tsx` (lihat `package.json`). TypeScript dipakai di sini,
 * bukan `.mjs`, dengan alasan yang tidak kelihatan sampai dicoba: Node tidak
 * bisa me-resolve import TS tanpa ekstensi (`./client`) **maupun** dengan
 * spesifier `.js`, sementara menulis `.ts` di dalam spesifier ditolak
 * `tsc` repo ini (`allowImportingTsExtensions` tidak aktif). `tsx`
 * menyelesaikan ketiganya sekaligus, sehingga berkas ini tetap type-checked
 * oleh `npm run typecheck` **dan** bisa dijalankan apa adanya.
 *
 * Skrip ini tidak butuh env khusus untuk sekadar paham schema — tapi
 * menjalankan migrasi tentu butuh PostgreSQL hidup. Itu sebabnya pesan
 * kegagalannya menyebut cara menyalakannya.
 */

import { jalankanMigrasi, samarkanUrlDatabase } from "../src/lib/db/migrate";

async function main() {
  const mulai = Date.now();
  const { url, durasiMs } = await jalankanMigrasi();
  console.log(`[db:migrate] migrasi selesai dalam ${durasiMs}ms (total ${Date.now() - mulai}ms)`);
  console.log(`[db:migrate] database: ${samarkanUrlDatabase(url)}`);
}

main().catch((err: unknown) => {
  const sebab = err instanceof Error ? err.message : String(err);
  console.error("[db:migrate] GAGAL:", sebab);
  console.error(
    "[db:migrate] Pastikan PostgreSQL hidup (`docker compose up -d postgres`) " +
      "dan DATABASE_URL benar. Lihat docs/local-db.md.",
  );
  // `exitCode`, bukan `process.exit()`: proses diberi kesempatan menutup
  // koneksi yang mungkin masih terbuka sebelum keluar.
  process.exitCode = 1;
});
