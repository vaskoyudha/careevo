/**
 * Registry handler outbox dan ledger idempotensi sink — **server-only**.
 *
 * Modul ini adalah sisi "apa yang dilakukan sebuah event". Worker
 * (`./worker.ts`) hanya tahu cara mengklaim, me-lease, dan menutup baris
 * `outbox_events`; ia tidak tahu arti sebuah tipe event. Semua pengetahuan itu
 * ada di sini.
 *
 * Aturan yang dikunci:
 *
 * - **Tipe event tanpa handler adalah kegagalan terminal, bukan no-op.** Worker
 *   menandai event semacam itu `handler_tidak_terdaftar` dan memindahkannya ke
 *   dead-letter. Mengembalikan sukses tanpa efek samping akan membuat event
 *   hilang secara diam-diam — tepat kelas bug yang outbox ini ada untuk
 *   mencegahnya. Karena itu handler `attestation.*` dan `file.scan` sengaja
 *   **belum terdaftar**: tabel sumbernya belum ada di Fase 1A, dan mengklaim
 *   efek samping tanpa sumber kebenaran adalah kebohongan.
 * - **Idempotensi per sink lewat baris ledger, bukan lewat flag di event.**
 *   Satu event bisa menulis ke beberapa sink. Tiap sink mendapat baris
 *   `outbox_deliveries` sendiri — **satu baris per `(event_id, sink)`**, dengan
 *   `status` sebagai keadaan, bukan riwayat. Baris ditulis `in_progress` lalu
 *   di-`succeeded` dalam transaksi yang sama dengan efek sampingnya, sehingga
 *   handler yang dijalankan ulang (lease kedaluwarsa, replay) tidak
 *   menggandakan efek samping. Pemisahan tanggung jawab: **lease pada
 *   `outbox_events`** mencegah dua worker memproses event yang sama, sedangkan
 *   **baris ledger** mencegah efek samping yang sama berjalan dua kali lintas
 *   retry/crash.
 *
 *   Batas klaimnya harus jujur: ini **at-most-once untuk efek samping internal**
 *   (audit, satu database). Untuk sink eksternal, baris ledger `succeeded`
 *   saja **tidak** menyelesaikan crash sesudah provider sukses tetapi sebelum
 *   commit: provider sudah melakukan efeknya, ledger belum. Yang benar-benar
 *   menyelesaikan itu adalah **kunci idempotensi yang dikenali provider**
 *   (id pesan, `Idempotency-Key` HTTP). Handler email/scan karena itu tidak
 *   didaftarkan sampai providernya menerima kunci semacam itu; jangan
 *   mengklaim exactly-once tanpa dukungan downstream. Untuk dedupe lintas
 *   *event* (bukan lintas retry), jangan mengarang tabel baru: tambahkan
 *   kunci yang deterministik di `idempotency_key` event dan biarkan handler
 *   menjadi idempoten terhadapnya.
 * - **Payload sudah ter-redact sebelum sampai ke sini** (`outbox_events.
 *   payload_redacted`). Handler tetap dilarang menyalin payload mentah ke log;
 *   handler audit hanya menulis field yang benar-benar dibutuhkan trail — lihat
 *   betapa `auth.registered` hanya meneruskan `userId`.
 * - **Lookup registry memakai `Object.hasOwn`.** `in` menelusuri rantai
 *   prototipe, sehingga `"toString" in registry` bernilai benar dan tipe event
 *   yang dinamai seperti method bawaan akan menjalankan fungsi bawaan itu.
 *   Pelajaran ini tercatat di skill `careevo-review`.
 */

import { and, eq, ne } from "drizzle-orm";

import type { TransaksiDb } from "@/lib/db/client";
import { outboxDeliveries, type OutboxEvent } from "@/lib/db/schema";
import { catatAudit } from "@/lib/auth/audit";

/**
 * Tipe event yang punya handler nyata.
 *
 * Nilai ini ikut tersimpan di `outbox_events.type`, dan penulis event
 * (application service) mengimpornya dari sini supaya penulis dan pembaca tidak
 * pernah berbeda pendapat soal ejaannya.
 */
export const TIPE_EVENT = {
  /**
   * Registrasi akun berhasil. Ditulis dari transaksi `daftarPengguna`
   * (`users` + `user_credentials` + `user_roles` + `outbox_events`), lalu
   * handler di sini memfan-out-nya menjadi baris `audit_events`.
   *
   * Payload kontrak: `{ userId: string }` — hanya id, tanpa email/nama. Id
   * adalah identifier yang dibutuhkan trail; email adalah PII yang tidak
   * diperlukan di sini, jadi ia tidak pernah masuk payload.
   */
  authRegistered: "auth.registered",
  /** Submission dibuat (Fase 3). Payload: `{ submissionId, userId }`. */
  submissionCreated: "submission.created",
  /** Submission dikirim learner (Fase 3). Payload: `{ submissionId, userId }`. */
  submissionSubmitted: "submission.submitted",
  /** Submission di-assign reviewer (Fase 3). Payload: `{ submissionId, reviewerUserId }`. */
  submissionAssigned: "submission.assigned",
  /** Review diputuskan (Fase 3). Payload: `{ reviewId, submissionId, decision }`. */
  reviewDecided: "review.decided",
  /** Attestation diterbitkan (Fase 3). Payload: `{ attestationId, subjectUserId }`. */
  attestationIssued: "attestation.issued",
  /** Attestation dicabut (Fase 3). Payload: `{ attestationId, subjectUserId }`. */
  attestationRevoked: "attestation.revoked",
} as const;

/**
 * Nama sink idempotensi. Satu nilai per tujuan efek samping.
 *
 * `audit` adalah sink internal (satu database, transaksi yang sama), jadi
 * idempotensinya benar-benar at-most-once. Sink eksternal di masa depan
 * (email, scan, webhook) harus menambah nilai di sini **dan** membawa kunci
 * idempotensi yang dihormati provider; tanpa itu, handler-nya hanya boleh
 * dijalankan bila operator menerima kemungkinan duplikat.
 */
export const SINK = {
  audit: "audit",
} as const;

/**
 * Event yang sudah diklaim worker dan siap diberikan ke handler.
 *
 * Diturunkan dari `OutboxEvent` supaya penambahan kolom di schema tidak diam-diam
 * membuat bentuk lokal ini menyimpang dari database.
 */
export type EventOutbox = Pick<
  OutboxEvent,
  "id" | "type" | "aggregateType" | "aggregateId" | "payloadRedacted" | "idempotencyKey" | "attempts"
>;

/**
 * Kegagalan handler yang **tidak akan membaik dengan diulang**.
 *
 * Worker memperlakukannya sebagai terminal langsung (tanpa menghabiskan sisa
 * percobaan): payload yang salah bentuk tidak akan menjadi benar pada percobaan
 * kelima. Galat lain (termasuk galat database tak terduga) diperlakukan sebagai
 * sementara dan di-retry dengan backoff.
 *
 * `kode` masuk ke `last_error_code` dan harus berupa kode pendek yang stabil,
 * bukan pesan galat. Pesan galat bisa memuat potongan payload; kolom itu
 * terbaca operator dan tersimpan permanen, jadi ia tidak boleh menjadi saluran
 * kebocoran.
 */
export class GalatHandlerPermanen extends Error {
  readonly kode: string;

  constructor(kode: string) {
    // Pesan sengaja sama dengan kode: `Error.message` tidak pernah ditulis ke
    // database oleh worker, dan menyamakannya mencegah kode tak sengaja
    // menyalin `error.message` ke `last_error_code`.
    super(kode);
    this.name = "GalatHandlerPermanen";
    this.kode = kode;
  }
}

/**
 * Ubah galat apa pun menjadi kode pendek yang aman disimpan.
 *
 * **Hanya kode, tidak pernah pesan.** `last_error_code` dibaca operator dan
 * tidak pernah dihapus; pesan galat driver PostgreSQL dapat memuat nilai kolom
 * (mis. `Key (email)=(budi@contoh.test) already exists`), dan itu PII.
 */
export function kodeGalat(error: unknown): string {
  if (error instanceof GalatHandlerPermanen) return error.kode;
  return "gagal_sementara";
}

/** Konteks yang diberikan worker ke handler: satu transaksi, satu event. */
export type KonteksHandler = {
  /** Transaksi tempat efek samping dan baris ledger ditulis bersama. */
  tx: TransaksiDb;
  event: EventOutbox;
};

/**
 * Handler event. Wajib idempoten lewat `jalankanSekali`; boleh melempar
 * `GalatHandlerPermanen` untuk kegagalan yang tidak layak diulang.
 */
export type HandlerOutbox = (konteks: KonteksHandler) => Promise<void>;

/** Baca string non-kosong dari payload ter-redact. */
function bacaString(payload: unknown, kunci: string): string | null {
  if (payload === null || typeof payload !== "object") return null;
  const nilai = (payload as Record<string, unknown>)[kunci];
  return typeof nilai === "string" && nilai.length > 0 ? nilai : null;
}

/** Bentuk UUID yang sah — dipakai memvalidasi `userId` payload. */
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Predikat baris ledger untuk satu (event, sink). */
function whereDelivery(eventId: string, sink: string) {
  return and(eq(outboxDeliveries.eventId, eventId), eq(outboxDeliveries.sink, sink));
}

/**
 * Jalankan `fn` sekali saja per (event, sink).
 *
 * Ledger per sink adalah **satu baris per `(event_id, sink)`** (PK komposit), dan
 * `status` adalah keadaan, bukan riwayat. Karena itu baris kedua untuk pasangan
 * yang sama ditolak PK; pola aman di sini:
 *
 * 1. `INSERT ... ON CONFLICT DO NOTHING` berstatus `in_progress`;
 * 2. bila nol baris terpengaruh, baca baris yang ada: `succeeded` → lewati `fn`;
 *    selain itu → naikkan ke `in_progress` dan jalankan;
 * 3. jalankan `fn`, lalu naikkan baris ke `succeeded` — masih di transaksi yang
 *    sama dengan `fn`.
 *
 * Pembagian tanggung jawabnya harus dipahami sebelum mengubah fungsi ini:
 *
 * - **Lease di `outbox_events`** mencegah dua worker memproses event yang sama.
 * - **Baris ledger ini** mencegah efek samping yang sama berjalan dua kali
 *   lintas retry/lease-recovery — termasuk setelah crash.
 *
 * Karena exclusive in-flight tidak lagi dijamin index parsial (index itu memang
 * dihapus: PK sudah membuat pasangan unik apa pun statusnya), mutual exclusion
 * saat handler berjalan sepenuhnya bergantung pada lease event. Untuk efek
 * samping internal (audit) itu cukup: baris ledger dan audit commit di transaksi
 * yang sama, jadi `succeeded` hanya terlihat bila efeknya benar-benar terjadi.
 * Untuk sink eksternal, ini belum cukup — lihat catatan exactly-once di header
 * modul.
 */
export async function jalankanSekali(input: {
  tx: TransaksiDb;
  event: EventOutbox;
  sink: string;
  resultCode?: string | null;
  fn: () => Promise<void>;
}): Promise<{ dilewati: boolean }> {
  const { tx, event, sink } = input;

  const disisipkan = await tx
    .insert(outboxDeliveries)
    .values({ eventId: event.id, sink, status: "in_progress" })
    .onConflictDoNothing({ target: [outboxDeliveries.eventId, outboxDeliveries.sink] })
    .returning({ status: outboxDeliveries.status });

  if (disisipkan.length === 0) {
    const [baris] = await tx
      .select({ status: outboxDeliveries.status })
      .from(outboxDeliveries)
      .where(whereDelivery(event.id, sink))
      .for("update");

    // Baris `succeeded` adalah bukti efek samping sudah terjadi; jangan ulangi.
    if (baris?.status === "succeeded") return { dilewati: true };

    // `in_progress` yang tersisa atau `failed`: ambil alih. `WHERE status <>
    // 'succeeded'` membuat UPDATE ini no-op bila baris sudah sukses — pertahanan
    // berlapis, bukan pengganti pemeriksaan di atas.
    const diambil = await tx
      .update(outboxDeliveries)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(and(whereDelivery(event.id, sink), ne(outboxDeliveries.status, "succeeded")))
      .returning({ status: outboxDeliveries.status });

    if (diambil.length === 0) return { dilewati: true };
  }

  await input.fn();

  await tx
    .update(outboxDeliveries)
    .set({
      status: "succeeded",
      deliveredAt: new Date(),
      updatedAt: new Date(),
      resultCode: input.resultCode ?? null,
    })
    .where(whereDelivery(event.id, sink));

  return { dilewati: false };
}

/**
 * Catat kegagalan sink pada ledger, bila barisnya belum `succeeded`.
 *
 * Dipanggil worker di transaksi kegagalan (setelah transaksi handler rollback),
 * sehingga riwayat "pernah gagal dengan kode X" tetap ada tanpa membuat retry
 * berikutnya melewati sink.
 *
 * `setWhere` hanya mengecualikan `succeeded`. Baris `in_progress` **ikut**
 * diperbarui: baris itu, bila masih ada, adalah sisa transaksi handler yang
 * sudah mati — menandainya `failed` justru membersihkannya sehingga percobaan
 * berikutnya boleh mengambil alih. Baris `succeeded` tidak pernah diturunkan:
 * ia bukti efek samping sudah terjadi.
 */
export async function catatDeliveryGagal(
  tx: TransaksiDb,
  input: { eventId: string; sink: string; kode: string },
): Promise<void> {
  await tx
    .insert(outboxDeliveries)
    .values({
      eventId: input.eventId,
      sink: input.sink,
      status: "failed",
      resultCode: input.kode,
    })
    .onConflictDoUpdate({
      target: [outboxDeliveries.eventId, outboxDeliveries.sink],
      set: { status: "failed", resultCode: input.kode, updatedAt: new Date() },
      setWhere: ne(outboxDeliveries.status, "succeeded"),
    });
}

/**
 * Handler `auth.registered` → sink `audit`.
 *
 * Menulis **satu** baris `audit_events` (`user.registered`) untuk user yang baru
 * mendaftar.
 *
 * Mengapa lewat outbox, bukan langsung di `daftarPengguna`: audit dan baris
 * bisnis harus lahir atau gagal bersama. Outbox memberi jaminan yang tidak bisa
 * diberikan penulisan audit inline: bila proses mati setelah commit bisnis
 * tetapi sebelum audit tercatat, audit itu hilang tanpa jejak. Di sini event
 * sudah commit bersama user, jadi audit dijamin menyusul.
 *
 * Jangan menambahkan `catatAudit` untuk `user.registered` di dalam transaksi
 * `daftarPengguna`: itu menggandakan baris audit ini, dan audit append-only
 * tidak bisa dibersihkan. Pemisahan yang disengaja: alur yang menulis audit
 * inline hari ini (`beriRole`, `cabutRole`, undangan) **tidak** menerbitkan
 * event outbox, sehingga tidak ada satu peristiwa yang tercatat dua kali.
 */
export const handlerAuthRegistered: HandlerOutbox = async ({ tx, event }) => {
  const userId = bacaString(event.payloadRedacted, "userId");
  if (!userId || !POLA_UUID.test(userId)) {
    // Payload rusak tidak akan membaik dengan retry.
    throw new GalatHandlerPermanen("payload_tidak_valid");
  }

  await jalankanSekali({
    tx,
    event,
    sink: SINK.audit,
    fn: async () => {
      await catatAudit(tx, {
        actorUserId: userId,
        action: "user.registered",
        entityType: "user",
        entityId: userId,
        // Kosong dengan sengaja: `userId` sudah menjadi `entity_id`, dan
        // menyalin payload apa pun berarti menyalin PII ke tabel permanen.
        payloadRedacted: {},
      });
    },
  });
};

/**
 * Peta `type` event → `{ action, entityType, kolomId }` untuk audit fan-out.
 *
 * Event Fase 3 (submission/review/attestation) semuanya punya bentuk yang sama:
 * baris bisnis sudah commit bersama event; yang tersisa hanyalah menulis satu
 * baris `audit_events` yang menunjuk entitas itu. `kolomId` adalah nama field
 * payload yang memuat uuid entitas (`submissionId`, `reviewId`, `attestationId`).
 * `actor` dibiarkan `null` bila payload tidak membawanya — actor staff tercatat
 * di `reviews.reviewer_user_id`/`attestation_events`, bukan di sini.
 */
const AUDIT_FANOUT: Readonly<
  Record<string, { action: string; entityType: string; kolomId: string }>
> = {
  [TIPE_EVENT.submissionCreated]: {
    action: "submission.created",
    entityType: "submission",
    kolomId: "submissionId",
  },
  [TIPE_EVENT.submissionSubmitted]: {
    action: "submission.submitted",
    entityType: "submission",
    kolomId: "submissionId",
  },
  [TIPE_EVENT.submissionAssigned]: {
    action: "submission.assigned",
    entityType: "submission",
    kolomId: "submissionId",
  },
  [TIPE_EVENT.reviewDecided]: {
    action: "review.decided",
    entityType: "review",
    kolomId: "reviewId",
  },
  [TIPE_EVENT.attestationIssued]: {
    action: "attestation.issued",
    entityType: "attestation",
    kolomId: "attestationId",
  },
  [TIPE_EVENT.attestationRevoked]: {
    action: "attestation.revoked",
    entityType: "attestation",
    kolomId: "attestationId",
  },
};

/**
 * Handler fan-out umum untuk event Fase 3 → sink `audit`.
 *
 * Membaca uuid entitas dari payload (`kolomId`), memvalidasinya, lalu menulis
 * satu baris `audit_events`. Tidak menyalin payload lain ke audit: kolom
 * `payload_redacted` dibiarkan kosong supaya konten submission/rubrik tidak
 * pernah tersalin ke tabel permanen.
 */
function buatHandlerFanout(entri: { action: string; entityType: string; kolomId: string }): HandlerOutbox {
  return async ({ tx, event }) => {
    const entityId = bacaString(event.payloadRedacted, entri.kolomId);
    if (!entityId || !POLA_UUID.test(entityId)) {
      throw new GalatHandlerPermanen("payload_tidak_valid");
    }

    await jalankanSekali({
      tx,
      event,
      sink: SINK.audit,
      fn: async () => {
        await catatAudit(tx, {
          actorUserId: null,
          action: entri.action,
          entityType: entri.entityType,
          entityId,
          payloadRedacted: {},
        });
      },
    });
  };
}

/**
 * Registry tipe event → handler.
 *
 * `auth.registered` dan event Fase 3 (submission/review/attestation) punya
 * handler konkret yang mem-fan-out ke `audit_events`. Tipe lain (mis.
 * `file.scanned`) **tidak** didaftarkan sampai tabel sumbernya ada, sehingga
 * event semacam itu gagal terminal dengan kode `handler_tidak_terdaftar`.
 */
const REGISTRY: Readonly<Record<string, HandlerOutbox>> = {
  [TIPE_EVENT.authRegistered]: handlerAuthRegistered,
  [TIPE_EVENT.submissionCreated]: buatHandlerFanout(AUDIT_FANOUT[TIPE_EVENT.submissionCreated]),
  [TIPE_EVENT.submissionSubmitted]: buatHandlerFanout(AUDIT_FANOUT[TIPE_EVENT.submissionSubmitted]),
  [TIPE_EVENT.submissionAssigned]: buatHandlerFanout(AUDIT_FANOUT[TIPE_EVENT.submissionAssigned]),
  [TIPE_EVENT.reviewDecided]: buatHandlerFanout(AUDIT_FANOUT[TIPE_EVENT.reviewDecided]),
  [TIPE_EVENT.attestationIssued]: buatHandlerFanout(AUDIT_FANOUT[TIPE_EVENT.attestationIssued]),
  [TIPE_EVENT.attestationRevoked]: buatHandlerFanout(AUDIT_FANOUT[TIPE_EVENT.attestationRevoked]),
};

/**
 * Sink yang dipakai tiap tipe event.
 *
 * Dipakai worker untuk menulis riwayat `failed` pada ledger ketika handler
 * melempar. Tipe tanpa entri berarti tidak ada sink yang bisa ditandai — dan
 * karena tipe itu juga tidak punya handler, ia akan mati sebagai
 * `handler_tidak_terdaftar`.
 */
const SINK_PER_TIPE: Readonly<Record<string, readonly string[]>> = {
  [TIPE_EVENT.authRegistered]: [SINK.audit],
  [TIPE_EVENT.submissionCreated]: [SINK.audit],
  [TIPE_EVENT.submissionSubmitted]: [SINK.audit],
  [TIPE_EVENT.submissionAssigned]: [SINK.audit],
  [TIPE_EVENT.reviewDecided]: [SINK.audit],
  [TIPE_EVENT.attestationIssued]: [SINK.audit],
  [TIPE_EVENT.attestationRevoked]: [SINK.audit],
};

/**
 * Cari handler untuk `type`. Mengembalikan `null` bila tidak ada.
 *
 * `Object.hasOwn`, bukan `in` — lihat catatan modul.
 */
export function cariHandler(type: string): HandlerOutbox | null {
  if (!Object.hasOwn(REGISTRY, type)) return null;
  return REGISTRY[type] ?? null;
}

/** Sink yang dideklarasikan sebuah tipe event; kosong bila tidak dikenal. */
export function sinkUntukTipe(type: string): readonly string[] {
  if (!Object.hasOwn(SINK_PER_TIPE, type)) return [];
  return SINK_PER_TIPE[type] ?? [];
}

/** Daftar tipe yang punya handler — dipakai CLI dan test sebagai kontrak. */
export function tipeTerdaftar(): string[] {
  return Object.keys(REGISTRY);
}
