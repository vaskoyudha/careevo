/**
 * Backfill sekali jalan: tambang sesi yang **sudah** ditutup sebelum deteksi
 * otomatis dipasang di jalur kedaluwarsa.
 *
 * ## Kenapa skrip ini ada
 *
 * Stage 1 awalnya dipicu hanya dari `akhiriRunDb` (peserta menutup sesinya).
 * Jalur kedaluwarsa — sesi yang ditinggalkan sampai lewat batas — tidak memicu
 * apa pun, sehingga kejadian di dalamnya tidak pernah diperiksa. Perbaikannya
 * (`tandaiKedaluwarsaDb` memanggil deteksi) **hanya berlaku ke depan**: sesi yang
 * sudah telanjur ditutup tidak akan pernah ditambang olehnya.
 *
 * Skrip ini menutup celah historis itu untuk basis data yang sudah ada. Ia
 * **tidak** mengubah perilaku runtime, dan setelah dijalankan sekali ia tidak
 * punya pekerjaan lagi — deteksi berjalan sendiri di kedua jalur.
 *
 * Pakai: `npx tsx scripts/backfill-deteksi-otomatis.mts [--kering]`
 *
 * `--kering` mencetak apa yang akan diperiksa tanpa menulis apa pun.
 *
 * ## Yang dijaga
 *
 * - **Idempoten, dua lapis.** Lapis pertama ada di sini: run yang sudah punya
 *   baris pelanggaran — status apa pun — dilewati, dikenali dari
 *   `evidence_redacted.run_id`. Itu menutup celah yang tidak terlihat: penjaga di
 *   `usulkanPelanggaranDb` hanya melihat baris `proposed`, jadi usulan yang sudah
 *   **ditolak** manusia akan lahir kembali kalau skrip dijalankan ulang. Lapis
 *   kedua ada di `usulkanPelanggaranDb`: (user, course, jenis) yang masih
 *   `proposed` tidak ditulis dua kali. Lapis kedua sengaja tidak diduplikasi di
 *   sini — supaya jalur normal dan jalur backfill memakai aturan yang sama.
 * - **Tidak menyentuh skor.** Semua yang ditulis berstatus `proposed`; skor hanya
 *   bergerak kalau manusia memutuskan.
 * - **Run `active` dilewati.** Run yang masih berjalan belum berakhir. Menambang
 *   kejadian di tengah sesi memproses sesuatu yang masih bisa berubah, dan sesi
 *   itu akan ditambang sendiri saat ditutup.
 */

import { readFileSync } from "node:fs";
import { inArray, sql } from "drizzle-orm";

// `.env.local` dimuat manual, mengikuti skrip seed lain: `dotenv` bukan
// dependency repo ini, jadi `import "dotenv/config"` akan gagal saat dijalankan.
const env = process.env as unknown as Record<string, string | undefined>;
env.NODE_ENV ??= "development";
for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (cocok) env[cocok[1]] ??= cocok[2].replace(/^["']|["']$/g, "");
}

const { getDb, tutupDb } = await import("../src/lib/db/client");
const { learningRuns, integrityViolations } = await import("../src/lib/db/schema");
const { listEventRun } = await import("../src/lib/learning/repository");
const { sessionRunDariDb } = await import("../src/lib/learning/dashboard");
const { usulkanPelanggaranDb, ringkasanPelanggaranCourseDb } = await import(
  "../src/lib/integritas/service"
);

const KERING = process.argv.includes("--kering");

/**
 * Run yang sudah pernah ditambang, dilihat dari `evidence_redacted.run_id`.
 *
 * Ini penjaga idempotensi yang sesungguhnya, dan alasannya halus: penjaga di
 * `usulkanPelanggaranDb` menyaring `status = 'proposed'`. Begitu manusia menolak
 * sebuah usulan, barisnya jadi `dismissed`, keluar dari penyaring itu, dan skrip
 * yang dijalankan ulang akan mengusulkannya **lagi** — persis hal yang tidak
 * boleh terjadi pada keputusan yang sudah diambil. Menandai per-run, bukan
 * per-jenis, menutup celah itu tanpa mengubah jalur runtime.
 *
 * Hanya berlaku untuk backfill: jalur normal sengaja tetap memakai penjaga
 * `proposed`-nya sendiri, karena sesi baru pada course yang sama memang boleh
 * mengusulkan lagi setelah usulan lama diputuskan.
 */
async function runSudahDitambang(db: ReturnType<typeof getDb>): Promise<Set<string>> {
  const baris = await db
    .selectDistinct({ runId: sql<string>`${integrityViolations.evidenceRedacted}->>'run_id'` })
    .from(integrityViolations);
  return new Set(baris.map((b) => b.runId).filter((v): v is string => Boolean(v)));
}

async function main(): Promise<void> {
  const db = getDb();

  const ditutup = await db
    .select()
    .from(learningRuns)
    .where(inArray(learningRuns.state, ["completed", "expired"]))
    .orderBy(learningRuns.startedAt);

  const sudahDitambang = await runSudahDitambang(db);

  console.log(`Backfill deteksi otomatis${KERING ? " (mode kering)" : ""}`);
  console.log(`  run tertutup ditemukan: ${ditutup.length}`);
  console.log(`  run sudah pernah ditambang: ${ditutup.filter((r) => sudahDitambang.has(r.id)).length}`);

  let diperiksa = 0;
  let berkejadian = 0;
  let usulanDibuat = 0;
  let gagal = 0;
  const terpengaruh = new Set<string>();

  for (const run of ditutup) {
    if (sudahDitambang.has(run.id)) continue;

    const events = await listEventRun(run.id);
    if (events.length === 0) continue;

    diperiksa += 1;
    berkejadian += events.length;

    if (KERING) {
      // Mode kering tidak menyentuh penulisan sama sekali, jadi ia hanya
      // melaporkan run mana yang punya kejadian.
      console.log(
        `  [kering] ${run.state} ${run.courseId} — ${events.length} kejadian (run ${run.id.slice(0, 8)})`,
      );
      continue;
    }

    try {
      const usulan = await usulkanPelanggaranDb({
        userId: run.userId,
        courseId: run.courseId,
        kejadian: sessionRunDariDb(run, events).kejadian,
        runId: run.id,
      });
      if (usulan.length > 0) {
        usulanDibuat += usulan.length;
        terpengaruh.add(`${run.userId}\u0000${run.courseId}`);
        for (const u of usulan) {
          console.log(
            `  + usulan ${u.kind} (${u.penalty} poin) — ${run.courseId} run ${run.id.slice(0, 8)}`,
          );
        }
      }
    } catch (err) {
      gagal += 1;
      console.error(`  ! run ${run.id} gagal:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("");
  console.log(`  run dengan kejadian : ${diperiksa}`);
  console.log(`  total kejadian      : ${berkejadian}`);
  console.log(`  usulan baru         : ${usulanDibuat}`);
  console.log(`  gagal               : ${gagal}`);

  if (!KERING && terpengaruh.size > 0) {
    console.log("");
    console.log("  Antrian per peserta (belum diputuskan):");
    for (const kunci of terpengaruh) {
      const [userId, courseId] = kunci.split("\u0000") as [string, string];
      const baris = await ringkasanPelanggaranCourseDb(userId, courseId);
      const belum = baris.filter((b) => b.jumlahBelumPutus > 0);
      if (belum.length === 0) continue;
      console.log(
        `    ${userId.slice(0, 8)}… / ${courseId}: ` +
          belum.map((b) => `${b.jenis} ${b.jumlahBelumPutus}×`).join(", "),
      );
    }
  }

  await tutupDb();
}

main().catch(async (err) => {
  console.error("Backfill gagal:", err);
  await tutupDb().catch(() => {});
  process.exit(1);
});
