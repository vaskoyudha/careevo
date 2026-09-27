/**
 * Backfill the enrichment cache for every inbox row, once.
 *
 * The post-scan step only touches rows a scan just added. This script exists for
 * the rows already in `pipeline.md` when the multi-board enrichment shipped —
 * measured 257 rows, of which 77 had no cache entry and so rendered "Belum
 * diperiksa" forever.
 *
 * Run with `npm run enrich:inbox`. Idempotent: a row already in the cache is
 * skipped, so re-running costs no requests.
 */

import { ADAPTER, adapterUntuk } from "../src/lib/career-ops/boards";
import { bacaInboxDenganTanggal } from "../src/lib/career-ops/inbox";
import { bacaCache, perkayaSemua } from "../src/lib/career-ops/job-cache";
import { ioDefault } from "../src/lib/career-ops/io";
import { normalisasiKunciUrl } from "../src/lib/career-ops/url-key";

function papanDari(url: string): string {
  return adapterUntuk(url)?.nama ?? "(papan tidak dikenal)";
}

/** Whether this row's material is in the cache — keyed the way `perkayaSemua` writes it. */
function adaDiCache(cache: Record<string, unknown>, url: string): boolean {
  const kunci = normalisasiKunciUrl(url);
  return kunci !== "" && Object.prototype.hasOwnProperty.call(cache, kunci);
}

async function main() {
  const rows = bacaInboxDenganTanggal();
  if (rows.length === 0) {
    console.log("Inbox kosong — tidak ada yang perlu diperkaya.");
    return;
  }

  const sebelum = await bacaCache();
  const belum = rows.filter((r) => !adaDiCache(sebelum, r.url)).length;

  console.log(`${rows.length} baris di inbox; ${belum} belum ada di cache.`);
  console.log(`Papan yang dikenali: ${ADAPTER.map((a) => a.nama).join(", ")}`);
  console.log("Mengambil deskripsi…");

  const mulai = Date.now();
  const cache = await perkayaSemua(rows, ioDefault);
  const detik = ((Date.now() - mulai) / 1000).toFixed(1);

  // Per-board tally, so a board that silently stopped working is visible here
  // rather than only as "Belum diperiksa" badges on the page.
  const terisi = new Map<string, number>();
  const kosong = new Map<string, number>();
  for (const row of rows) {
    const papan = papanDari(row.url);
    const peta = adaDiCache(cache, row.url) ? terisi : kosong;
    peta.set(papan, (peta.get(papan) ?? 0) + 1);
  }

  console.log(`\nSelesai dalam ${detik}s.`);
  for (const [papan, n] of [...terisi].sort((a, b) => b[1] - a[1])) {
    console.log(`  ✓ ${papan}: ${n} baris ter-enrich`);
  }
  for (const [papan, n] of [...kosong].sort((a, b) => b[1] - a[1])) {
    console.log(`  · ${papan}: ${n} baris belum bisa diambil`);
  }
  console.log(
    `\n${rows.length - rows.filter((r) => !adaDiCache(cache, r.url)).length}/${rows.length} baris inbox ter-enrich.`,
  );
}

main().catch((err) => {
  console.error("Gagal:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
