/**
 * CLI worker outbox — `npx tsx scripts/worker.ts [opsi]`.
 *
 * Menjalankan satu proses worker di mesin lokal: klaim event yang siap,
 * jalankan handler, catat hasilnya, lalu keluar. Ini alat **manual/operasional
 * lokal**, bukan supervisor produksi.
 *
 * ## Produksi (belum, untuk integrator)
 *
 * Deployment produksi belum ditetapkan (lihat `docs/adr/0001-topologi-deployment-produksi.md`).
 * Yang perlu diputuskan integrator sebelum menjalankan ini di VPS:
 *
 * - **Pemicu.** Opsi di sini menjalankan satu proses lalu keluar. Produksi
 *   butuh pemanggil berulang: systemd timer, cron per menit, container
 *   long-running yang loop, atau platform job. Yang tidak boleh: worker yang
 *   berjalan "saat ada request" — outbox justru ada untuk melepas efek samping
 *   dari siklus request.
 * - **`--owner` unik per proses.** Nilai default memakai host+pid, cukup untuk
 *   satu mesin. Bila nanti ada lebih dari satu worker/mesin, pastikan tiap
 *   proses punya `owner` berbeda; dua proses ber-`owner` sama akan saling
 *   menganggap dirinya pemilik lease (fencing berbasis kepemilikan, bukan
 *   waktu).
 * - **Ukuran lease vs lama handler.** `--lease-ms` harus lebih panjang dari
 *   handler terlama. Handler audit Fase 1A hanya menulis satu baris, jadi
 *   default 30 detik longgar; sink jaringan (email/scan) nanti menuntut angka
 *   yang jauh lebih besar atau handler yang dipecah.
 * - **Alert.** `--json` mengeluarkan statistik yang bisa dibaca cron/alerting.
 *   Yang perlu dipantau: `gagalTerminal` naik (dead-letter menumpuk) dan
 *   `gagalSementara` terus bertambah untuk event yang sama (sink rusak).
 * - **Credential.** Worker memakai `DATABASE_URL` yang sama dengan aplikasi;
 *   di produksi env kosong berarti worker gagal start (lihat `src/lib/db/client.ts`).
 *
 * ## Pemakaian
 *
 * ```bash
 * npx tsx scripts/worker.ts --once                 # satu putaran
 * npx tsx scripts/worker.ts                         # sampai antrean kosong
 * npx tsx scripts/worker.ts --batch 50 --json
 * ```
 */

import { tutupDb } from "../src/lib/db/client";
import { jalankanSatuPutaran, jalankanSampaiKosong, type OpsiWorker } from "../src/lib/outbox/worker";

type Argumen = {
  sekali: boolean;
  json: boolean;
  owner?: string;
  batch?: number;
  leaseMs?: number;
  maxAttempts?: number;
  maksPutaran?: number;
};

function ambilNilai(args: string[], nama: string): string | undefined {
  const idx = args.indexOf(nama);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function ambilAngka(args: string[], nama: string): number | undefined {
  const nilai = ambilNilai(args, nama);
  if (nilai === undefined) return undefined;
  const angka = Number.parseInt(nilai, 10);
  if (!Number.isFinite(angka) || angka <= 0) {
    throw new Error(`${nama} harus bilangan bulat positif, menerima "${nilai}".`);
  }
  return angka;
}

function parseArgs(argv: string[]): Argumen {
  const args = argv.slice(2);
  return {
    sekali: args.includes("--once"),
    json: args.includes("--json"),
    owner: ambilNilai(args, "--owner"),
    batch: ambilAngka(args, "--batch"),
    leaseMs: ambilAngka(args, "--lease-ms"),
    maxAttempts: ambilAngka(args, "--max-attempts"),
    maksPutaran: ambilAngka(args, "--maks-putaran"),
  };
}

async function main() {
  const args = parseArgs(process.argv);

  const opsi: OpsiWorker = {
    // Host + pid membuat owner berbeda antar proses pada satu mesin. Mesin
    // kedua dengan host yang sama dan pid yang kebetulan sama tetap bisa
    // bertabrakan; itu sebabnya produksi multi-mesin wajib memberi `--owner`.
    owner: args.owner ?? `cli-${process.env.HOSTNAME ?? "host"}-${process.pid}`,
    batchSize: args.batch,
    leaseMs: args.leaseMs,
    maxAttempts: args.maxAttempts,
  };

  const mulai = Date.now();

  if (args.sekali) {
    const statistik = await jalankanSatuPutaran(opsi);
    if (args.json) console.log(JSON.stringify({ statistik, durasiMs: Date.now() - mulai }));
    else {
      console.log(
        `[worker] owner=${opsi.owner} diklaim=${statistik.diklaim} berhasil=${statistik.berhasil} ` +
          `gagalSementara=${statistik.gagalSementara} gagalTerminal=${statistik.gagalTerminal} ` +
          `kehilanganLease=${statistik.kehilanganLease}`,
      );
    }
    return;
  }

  const { statistik, putaran } = await jalankanSampaiKosong({
    ...opsi,
    maksPutaran: args.maksPutaran,
  });

  if (args.json) {
    console.log(JSON.stringify({ statistik, putaran, durasiMs: Date.now() - mulai }));
  } else {
    console.log(`[worker] owner=${opsi.owner} putaran=${putaran}`);
    console.log(
      `[worker] diklaim=${statistik.diklaim} berhasil=${statistik.berhasil} ` +
        `gagalSementara=${statistik.gagalSementara} gagalTerminal=${statistik.gagalTerminal} ` +
        `kehilanganLease=${statistik.kehilanganLease}`,
    );
  }

  // Exit non-zero bila ada yang mati: cron/alerting perlu sinyal yang tidak
  // tenggelam di antara baris log.
  if (statistik.gagalTerminal > 0) {
    console.error(
      `[worker] ${statistik.gagalTerminal} event dead-letter. Periksa: ` +
        "npx tsx scripts/replay-outbox.ts list",
    );
    process.exitCode = 2;
  }
}

main()
  .catch(() => {
    // Pesan galat driver dapat memuat data kolom; jangan salin ke log operator.
    console.error("[worker] GAGAL: pemrosesan worker tidak berhasil.");
    console.error(
      "[worker] Pastikan PostgreSQL hidup (`docker compose up -d postgres`) dan " +
        "DATABASE_URL benar. Lihat docs/local-db.md.",
    );
    process.exitCode = 1;
  })
  // Pool ditutup di `finally` supaya proses tidak menggantung karena koneksi
  // yang masih terbuka, baik pada jalur sukses maupun gagal.
  .finally(async () => {
    await tutupDb().catch(() => {});
  });
