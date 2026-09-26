/**
 * Worker outbox — claim atomik, lease, retry backoff, dan dead-letter —
 * **server-only**.
 *
 * Ini sisi "kapan dan oleh siapa" sebuah event diproses. Ia sengaja tidak tahu
 * arti tipe event; pengetahuan itu ada di `./handlers.ts`.
 *
 * ## Bentuk state yang dikunci (kolom dari `outbox_events`)
 *
 * `outbox_events` **tidak** punya kolom `status`; statusnya diturunkan dari tiga
 * kolom, dan turunan itulah kontrak yang dipakai serentak oleh worker, CLI, dan
 * query dead-letter:
 *
 * | kondisi                                                    | arti                          |
 * |------------------------------------------------------------|-------------------------------|
 * | `processed_at IS NULL AND dead_lettered_at IS NULL`        | pending / menunggu retry      |
 * | `processed_at IS NOT NULL`                                  | selesai                       |
 * | `dead_lettered_at IS NOT NULL`                              | gagal terminal (dead-letter)  |
 *
 * Karena itu baris sukses **tidak boleh** mengisi `dead_lettered_at`, dan baris
 * mati **tidak boleh** mengisi `processed_at`. Menggabungkan keduanya akan
 * membuat "gagal permanen" terbaca sebagai "selesai" — persis kekeliruan yang
 * catatan `schema.ts` peringatkan.
 *
 * ## Mengapa claim memakai SQL mentah
 *
 * `SELECT ... FOR UPDATE SKIP LOCKED` + `UPDATE ... RETURNING` dalam satu CTE
 * adalah satu-satunya bentuk yang membuat dua worker tidak bisa mengklaim baris
 * yang sama **tanpa saling menunggu**: `SKIP LOCKED` membuat worker kedua
 * melewati baris yang sedang dikunci dan mengambil baris berikutnya. Query
 * builder Drizzle tidak mengungkapkan `SKIP LOCKED`, jadi SQL-nya eksplisit di
 * sini — bukan karena malas memakai builder.
 *
 * Predikat `OUTBOX_BELUM_SELESAI` dan `OUTBOX_LEASE_BEBAS` diimpor dari
 * `schema.ts` alih-alih ditulis ulang, supaya predikat claim tidak pernah
 * menyimpang dari index parsial yang menopangnya (lihat catatan imutabilitas di
 * sana).
 *
 * ## Pengaman urutan (fencing)
 *
 * Handler berjalan di dalam transaksi yang lebih dulu mengunci baris dan
 * memverifikasi bahwa lease masih milik kita. Di akhir, transisi
 * `processed_at` adalah **compare-and-set**: `WHERE id = $1 AND lease_owner =
 * $owner`. Bila lease sudah diambil alih worker lain, UPDATE itu mengenai nol
 * baris, transaksi rollback — termasuk seluruh efek samping handler — dan baris
 * diproses ulang oleh pemilik baru. Inilah yang membuat "worker crash sesudah
 * claim" aman: efek samping dan penutupan baris tidak bisa ter-commit oleh
 * worker yang sudah kehilangan lease, dan `SKIP LOCKED` mencegah reclaim selama
 * barisnya masih dikunci transaksi yang hidup.
 *
 * Fencing-nya sengaja **tidak** membandingkan waktu di sini. Bila lease
 * kedaluwarsa hanya karena handler lambat, membandingkan `now()` justru
 * menggagalkan pekerjaan yang sudah hampir selesai dan membuang kerja yang
 * benar — sementara klaim pengganti tidak mungkin terjadi selama barisnya masih
 * terkunci. Yang dibandingkan adalah **kepemilikan** (`lease_owner`), dan itu
 * yang menentukan.
 */

import { and, eq, sql } from "drizzle-orm";

import { denganTransaksi, getDb } from "@/lib/db/client";
import { OUTBOX_BELUM_SELESAI, OUTBOX_LEASE_BEBAS, outboxEvents } from "@/lib/db/schema";
import {
  GalatHandlerPermanen,
  catatDeliveryGagal,
  cariHandler,
  kodeGalat,
  sinkUntukTipe,
  type EventOutbox,
} from "./handlers";

/** Opsi worker. Semua punya default aman untuk pemakaian CLI satu kali. */
export type OpsiWorker = {
  /** Identitas pemilik lease — unik per proses. Wajib, tidak boleh kosong. */
  owner: string;
  /** Jumlah maksimum event yang diklaim per putaran. */
  batchSize?: number;
  /** Durasi lease dalam milidetik; harus lebih panjang dari durasi handler normal. */
  leaseMs?: number;
  /** Percobaan maksimum sebelum baris dipindah ke dead-letter. */
  maxAttempts?: number;
  /** Basis backoff eksponensial (ms) untuk percobaan pertama. */
  backoffBaseMs?: number;
  /** Plafon backoff (ms). */
  backoffMaxMs?: number;
  /**
   * Sumber keacakan 0..1 untuk jitter. Disuntik test supaya backoff
   * deterministik — backoff tanpa jitter membuat semua worker yang gagal
   * bersamaan bangun bersamaan (thundering herd).
   */
  acak?: () => number;
};

/** Statistik satu putaran pemrosesan. */
export type StatistikWorker = {
  diklaim: number;
  berhasil: number;
  gagalSementara: number;
  gagalTerminal: number;
  /** Event yang lease-nya diambil alih worker lain sebelum sempat ditutup. */
  kehilanganLease: number;
};

const DEFAULT_BATCH = 10;
const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BACKOFF_BASE_MS = 1_000;
const DEFAULT_BACKOFF_MAX_MS = 5 * 60_000;

/** Baris mentah hasil claim; nama kolom di-alias ke bentuk camelCase. */
type BarisKlaim = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payloadRedacted: unknown;
  idempotencyKey: string;
  attempts: number;
};

/** Galat internal penanda bahwa lease sudah bukan milik kita. */
class GalatKehilanganLease extends Error {
  constructor() {
    super("lease_hilang");
    this.name = "GalatKehilanganLease";
  }
}

/**
 * Hitung jeda backoff eksponensial berjitter untuk `attempts` (1 = percobaan
 * pertama sudah gagal).
 *
 * Eksponensial dibatasi plafon supaya percobaan ke-30 tidak menjadwalkan event
 * setahun ke depan. Jitter 0..25% ditambahkan, bukan dikurangkan, sehingga jeda
 * tidak pernah lebih pendek dari basis yang diharapkan operator.
 *
 * Fungsi murni — diuji unit tanpa database.
 */
export function hitungBackoffMs(
  attempts: number,
  opsi: { baseMs: number; maxMs: number; acak?: () => number },
): number {
  const aman = Math.max(1, Math.floor(attempts));
  const eksponen = Math.min(aman - 1, 30); // 2^30 ms ≈ 12 hari; plafon menahan sisanya
  const dasar = Math.min(opsi.baseMs * 2 ** eksponen, opsi.maxMs);
  const jitter = Math.floor(dasar * 0.25 * (opsi.acak?.() ?? 0));
  return Math.min(dasar + jitter, opsi.maxMs + Math.floor(opsi.maxMs * 0.25));
}

/**
 * Klaim sampai `batchSize` event yang siap diproses, secara atomik.
 *
 * Kandidat: belum selesai/belum mati (`OUTBOX_BELUM_SELESAI`),
 * `available_at <= now()`, dan lease-nya bebas atau kedaluwarsa
 * (`OUTBOX_LEASE_BEBAS`) — sehingga baris yang ditinggalkan worker mati dapat
 * dipulihkan worker lain. `FOR UPDATE SKIP LOCKED` + `UPDATE ... RETURNING`
 * membuat satu baris hanya diberikan ke satu worker.
 *
 * `attempts` dinaikkan **saat claim**: angka yang dikembalikan adalah nomor
 * percobaan yang sedang berjalan, dan itulah yang dipakai menghitung backoff.
 */
export async function klaimEvent(opsi: OpsiWorker): Promise<EventOutbox[]> {
  const batchSize = Math.max(1, Math.floor(opsi.batchSize ?? DEFAULT_BATCH));
  const leaseMs = Math.max(1, Math.floor(opsi.leaseMs ?? DEFAULT_LEASE_MS));

  const baris = await getDb().execute<BarisKlaim>(sql`
    with kandidat as (
      select id
      from outbox_events
      where available_at <= now()
        and ${OUTBOX_BELUM_SELESAI}
        and ${OUTBOX_LEASE_BEBAS}
      order by available_at asc, occurred_at asc
      for update skip locked
      limit ${batchSize}
    )
    update outbox_events e
    set lease_owner = ${opsi.owner},
        lease_expires_at = now() + (${leaseMs}::double precision * interval '1 millisecond'),
        attempts = e.attempts + 1
    from kandidat
    where e.id = kandidat.id
    returning
      e.id as "id",
      e.type as "type",
      e.aggregate_type as "aggregateType",
      e.aggregate_id as "aggregateId",
      e.payload_redacted as "payloadRedacted",
      e.idempotency_key as "idempotencyKey",
      e.attempts as "attempts"
  `);

  return baris.map((r) => ({
    id: r.id,
    type: r.type,
    aggregateType: r.aggregateType,
    aggregateId: r.aggregateId,
    payloadRedacted: r.payloadRedacted,
    idempotencyKey: r.idempotencyKey,
    attempts: r.attempts,
  }));
}

/**
 * Proses satu event yang sudah diklaim.
 *
 * Efek samping handler, baris ledger sink, dan penutupan baris commit dalam
 * **satu transaksi**, dengan kunci baris + verifikasi kepemilikan lease di
 * depan dan di belakang. Hasil `"kehilangan_lease"` berarti transaksi sudah
 * rollback seluruhnya dan barisnya utuh untuk pemilik baru.
 */
export async function prosesEvent(
  event: EventOutbox,
  opsi: OpsiWorker,
): Promise<"berhasil" | "gagal_sementara" | "gagal_terminal" | "kehilangan_lease"> {
  const handler = cariHandler(event.type);
  if (!handler) {
    // Fail-closed: tipe tanpa handler adalah kegagalan terminal, bukan sukses.
    // Lihat `handlers.ts` untuk alasan `attestation.*`/`file.scan` belum
    // terdaftar.
    return tandaiGagal(event, opsi, "handler_tidak_terdaftar", true);
  }

  try {
    await denganTransaksi(async (tx) => {
      // Fencing depan: kunci baris dan pastikan lease masih milik kita sebelum
      // efek samping apa pun ditulis.
      const [milik] = await tx
        .select({ leaseOwner: outboxEvents.leaseOwner, attempts: outboxEvents.attempts })
        .from(outboxEvents)
        .where(eq(outboxEvents.id, event.id))
        .for("update");
      if (!milik || milik.leaseOwner !== opsi.owner || milik.attempts !== event.attempts) {
        throw new GalatKehilanganLease();
      }

      await handler({ tx, event });

      // Fencing belakang: compare-and-set kepemilikan. Nol baris berarti lease
      // sudah diambil alih; throw di sini me-rollback efek samping handler.
      const selesai = await tx
        .update(outboxEvents)
        .set({
          processedAt: new Date(),
          deadLetteredAt: null,
          lastErrorCode: null,
          leaseOwner: null,
          leaseExpiresAt: null,
        })
        .where(and(
          eq(outboxEvents.id, event.id),
          eq(outboxEvents.leaseOwner, opsi.owner),
          eq(outboxEvents.attempts, event.attempts),
        ))
        .returning({ id: outboxEvents.id });
      if (selesai.length === 0) throw new GalatKehilanganLease();
    });
    return "berhasil";
  } catch (error) {
    if (error instanceof GalatKehilanganLease) {
      // Efek samping sudah di-rollback bersama transaksi. Barisnya bukan milik
      // kita lagi; jangan sentuh — jangan tandai gagal, jangan hitung attempt.
      return "kehilangan_lease";
    }

    const permanen = error instanceof GalatHandlerPermanen;
    // Klasifikasi hasil mengikuti keadaan baris yang sebenarnya, bukan sekadar
    // jenis galat: galat sementara pada percobaan terakhir juga menjadi
    // terminal. Mengembalikan "gagal_sementara" di situ akan membuat statistik
    // worker melaporkan event yang sudah dead-letter sebagai masih hidup.
    return tandaiGagal(event, opsi, kodeGalat(error), permanen);
  }
}

/**
 * Catat kegagalan event dan putuskan apakah ia masih boleh dicoba lagi.
 *
 * Terminal bila galatnya permanen (`GalatHandlerPermanen`, mis. payload rusak)
 * atau `attempts` sudah menyentuh `maxAttempts`. Baris terminal diberi
 * `dead_lettered_at` + `last_error_code` (dead-letter) dan lease-nya dilepas.
 * Baris non-terminal hanya menggeser `available_at` (backoff) dan melepas
 * lease, sehingga worker mana pun boleh mencobanya lagi setelah jeda.
 *
 * Yang ditulis ke `last_error_code` hanya **kode**, tidak pernah pesan galat —
 * barisnya permanen dan pesan driver PostgreSQL dapat memuat nilai kolom yang
 * berupa PII.
 *
 * Sink yang dideklarasikan tipe event ikut ditandai `failed` pada ledger, dalam
 * transaksi yang sama, sehingga riwayat "pernah gagal dengan kode X" tetap ada
 * tanpa membuat retry berikutnya melewati sink.
 *
 * Mengembalikan status yang benar-benar tersimpan. Bila lease telah berganti
 * pemilik, jangan ubah ledger atau mengklaim event milik worker lain sebagai gagal.
 */
async function tandaiGagal(
  event: EventOutbox,
  opsi: OpsiWorker,
  kode: string,
  permanen: boolean,
): Promise<"gagal_sementara" | "gagal_terminal" | "kehilangan_lease"> {
  const maxAttempts = Math.max(1, Math.floor(opsi.maxAttempts ?? DEFAULT_MAX_ATTEMPTS));
  const terminal = permanen || event.attempts >= maxAttempts;
  const jeda = hitungBackoffMs(event.attempts, {
    baseMs: opsi.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS,
    maxMs: opsi.backoffMaxMs ?? DEFAULT_BACKOFF_MAX_MS,
    acak: opsi.acak,
  });
  const sink = sinkUntukTipe(event.type);

  return denganTransaksi(async (tx) => {
    const [milik] = await tx
      .select({ leaseOwner: outboxEvents.leaseOwner, attempts: outboxEvents.attempts })
      .from(outboxEvents)
      .where(eq(outboxEvents.id, event.id))
      .for("update");
    if (!milik || milik.leaseOwner !== opsi.owner || milik.attempts !== event.attempts) {
      return "kehilangan_lease";
    }

    const [diperbarui] = await tx
      .update(outboxEvents)
      .set(terminal
        ? {
            lastErrorCode: kode,
            deadLetteredAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
          }
        : {
            lastErrorCode: kode,
            availableAt: new Date(Date.now() + jeda),
            leaseOwner: null,
            leaseExpiresAt: null,
          })
      .where(and(eq(outboxEvents.id, event.id), eq(outboxEvents.leaseOwner, opsi.owner)))
      .returning({ id: outboxEvents.id });
    if (!diperbarui) return "kehilangan_lease";

    for (const s of sink) {
      await catatDeliveryGagal(tx, { eventId: event.id, sink: s, kode });
    }
    return terminal ? "gagal_terminal" : "gagal_sementara";
  });
}

/**
 * Jalankan satu putaran: klaim sekumpulan event lalu proses satu per satu.
 *
 * Pemrosesan sengaja **sekuensial**, bukan paralel: satu event = satu transaksi
 * yang memegang kunci baris, dan menjalankannya bersamaan hanya menambah
 * contention pada sink yang sama (ledger audit) tanpa menambah throughput nyata
 * untuk beban Fase 1A. Bila throughput menuntut, paralelisme dilakukan dengan
 * **beberapa proses worker ber-`owner` berbeda**, bukan dengan menambah
 * konkurensi di dalam satu proses — itu justru cara aman menguji `SKIP LOCKED`.
 */
export async function jalankanSatuPutaran(opsi: OpsiWorker): Promise<StatistikWorker> {
  const stat: StatistikWorker = {
    diklaim: 0,
    berhasil: 0,
    gagalSementara: 0,
    gagalTerminal: 0,
    kehilanganLease: 0,
  };

  const diklaim = await klaimEvent(opsi);
  stat.diklaim = diklaim.length;

  for (const event of diklaim) {
    const hasil = await prosesEvent(event, opsi);
    if (hasil === "berhasil") stat.berhasil += 1;
    else if (hasil === "gagal_sementara") stat.gagalSementara += 1;
    else if (hasil === "gagal_terminal") stat.gagalTerminal += 1;
    else stat.kehilanganLease += 1;
  }

  return stat;
}

/**
 * Jalankan putaran sampai tidak ada event siap proses.
 *
 * Berhenti ketika satu putaran mengklaim nol event, atau setelah `maksPutaran`
 * (pengaman agar CLI tidak pernah menggantung tanpa batas). Mengembalikan
 * akumulasi statistik dan jumlah putaran.
 */
export async function jalankanSampaiKosong(
  opsi: OpsiWorker & { maksPutaran?: number },
): Promise<{ statistik: StatistikWorker; putaran: number }> {
  const maksPutaran = Math.max(1, Math.floor(opsi.maksPutaran ?? 1_000));
  const total: StatistikWorker = {
    diklaim: 0,
    berhasil: 0,
    gagalSementara: 0,
    gagalTerminal: 0,
    kehilanganLease: 0,
  };

  let putaran = 0;
  for (; putaran < maksPutaran; putaran += 1) {
    const stat = await jalankanSatuPutaran(opsi);
    total.diklaim += stat.diklaim;
    total.berhasil += stat.berhasil;
    total.gagalSementara += stat.gagalSementara;
    total.gagalTerminal += stat.gagalTerminal;
    total.kehilanganLease += stat.kehilanganLease;
    if (stat.diklaim === 0) break;
  }

  return { statistik: total, putaran };
}
