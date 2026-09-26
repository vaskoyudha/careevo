/**
 * CLI dead-letter dan replay — `npx tsx scripts/replay-outbox.ts <perintah>`.
 *
 * Operator tool: melihat event yang gagal terminal, menghitungnya untuk alert,
 * dan mengembalikannya ke antrean dengan jejak audit.
 *
 * ## Perintah
 *
 * ```bash
 * npx tsx scripts/replay-outbox.ts list --limit 20
 * npx tsx scripts/replay-outbox.ts count
 * npx tsx scripts/replay-outbox.ts replay <event-id> --actor <user-uuid> --reason "sink diperbaiki di #1234"
 * ```
 *
 * ## Mengapa `--reason` wajib
 *
 * Setiap replay menulis baris `audit_events` (`outbox.replay`) dengan
 * `actor_user_id` dan alasannya. Event yang mati pernah gagal lima kali; ia
 * kembali ke antrean hanya karena **seseorang memutuskan** keadaan sudah
 * berubah. Tanpa alasan tercatat, keputusan itu tidak bisa ditelusuri lagi, dan
 * replay berubah menjadi tombol yang menghapus riwayat kegagalan secara diam.
 *
 * ## Produksi (belum, untuk integrator)
 *
 * Alat ini adalah jalur pemulihan manual, bukan bagian dari runtime. Di
 * produksi ia dijalankan operator dengan `DATABASE_URL` produksi dan `--actor`
 * **id user admin sungguhan** — id itu masuk `audit_events.actor_user_id`, jadi
 * replay oleh sistem harus memakai id akun operator, bukan uuid karangan.
 * Pastikan aksesnya dibatasi (hanya operator/admin) dan hasilnya dicatat di
 * runbook insiden; CLI ini tidak menegakkan otorisasi sendiri.
 */

import { tutupDb } from "../src/lib/db/client";
import { daftarDeadLetter, jumlahDeadLetter, replayDeadLetter } from "../src/lib/outbox/replay";

function ambilNilai(args: string[], nama: string): string | undefined {
  const idx = args.indexOf(nama);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function bantuan(): void {
  console.log(`Pemakaian:
  npx tsx scripts/replay-outbox.ts list [--limit 20]
  npx tsx scripts/replay-outbox.ts count
  npx tsx scripts/replay-outbox.ts replay <event-id> --actor <user-uuid> --reason "<alasan>"

Keterangan:
  list    Tampilkan event dead-letter, terbaru dahulu.
  count   Cetak jumlah event dead-letter (untuk alert/cron).
  replay  Kembalikan satu event dead-letter ke antrean; menulis audit outbox.replay.`);
}

async function main() {
  const args = process.argv.slice(2);
  const perintah = args[0];

  if (!perintah || perintah === "help" || perintah === "--help" || perintah === "-h") {
    bantuan();
    return;
  }

  if (perintah === "count") {
    const jumlah = await jumlahDeadLetter();
    console.log(`dead-letter=${jumlah}`);
    if (jumlah > 0) process.exitCode = 2;
    return;
  }

  if (perintah === "list") {
    const limit = Number.parseInt(ambilNilai(args, "--limit") ?? "20", 10);
    const baris = await daftarDeadLetter(Number.isFinite(limit) ? limit : 20);

    if (baris.length === 0) {
      console.log("(tidak ada event dead-letter)");
      return;
    }

    for (const b of baris) {
      // Satu baris per event, ringkas: id, tipe, kode galat, percobaan, waktu.
      // Payload tidak dicetak — ia ter-redact, tetapi tetap tidak ada alasan
      // menyalin isi antrean ke terminal bersama.
      console.log(
        `${b.id}  ${b.type}  ${b.aggregateType}/${b.aggregateId}  ` +
          `kode=${b.lastErrorCode ?? "-"}  attempts=${b.attempts}  ` +
          `dead=${b.deadLetteredAt?.toISOString() ?? "-"}`,
      );
    }
    return;
  }

  if (perintah === "replay") {
    const eventId = args[1];
    const actorUserId = ambilNilai(args, "--actor");
    const reason = ambilNilai(args, "--reason");

    if (!eventId || !actorUserId || reason === undefined) {
      bantuan();
      console.error("\n[replay] butuh <event-id>, --actor <user-uuid>, dan --reason \"<alasan>\".");
      process.exitCode = 1;
      return;
    }

    const hasil = await replayDeadLetter({ eventId, actorUserId, reason });

    if (!hasil.ok) {
      // Pesan per alasan; exit non-zero supaya script operator berhenti.
      const pesan: Record<typeof hasil.alasan, string> = {
        id_tidak_valid: "id event atau id aktor bukan uuid yang sah.",
        aktor_bukan_admin: "id aktor bukan admin aktif; bootstrap admin pertama sebelum replay.",
        tidak_ditemukan: "event tidak ditemukan.",
        bukan_dead_letter: "event bukan dead-letter (mungkin sudah selesai atau masih pending).",
        sedang_diklaim: "event sedang diproses worker lain (lease masih aktif); coba lagi nanti.",
      };
      console.error(`[replay] GAGAL: ${pesan[hasil.alasan]}`);
      process.exitCode = 1;
      return;
    }

    console.log(`[replay] event ${hasil.id} kembali ke antrean. Audit outbox.replay tertulis.`);
    return;
  }

  bantuan();
  console.error(`\nPerintah tidak dikenal: ${perintah}`);
  process.exitCode = 1;
}

main()
  .catch(() => {
    // Galat SQL dapat menyertakan PII dalam message; log hanya kode umum.
    console.error("[replay] GAGAL: operasi database tidak berhasil.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await tutupDb().catch(() => {});
  });
