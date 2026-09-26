/**
 * Operasi dead-letter dan replay — **server-only**.
 *
 * Event yang gagal terminal berhenti dengan `dead_lettered_at` terisi dan
 * `last_error_code` berisi kode kegagalan (lihat tabel turunan status di
 * `./worker.ts`). Ia tidak dihapus dan tidak dicoba lagi sendiri — operator
 * harus melihatnya, memutuskan, dan bila perlu mengembalikannya ke antrean.
 * Modul ini menyediakan ketiga langkah itu.
 *
 * Aturan yang dikunci:
 *
 * - **Replay adalah keputusan ber-audit, bukan tombol.** Setiap replay menulis
 *   satu baris `audit_events` (`outbox.replay`) berisi **siapa** (`actorUserId`)
 *   dan **mengapa** (`reason`) — itu satu-satunya jejak mengapa sebuah event
 *   yang sudah mati tiba-tiba berjalan lagi. Tanpa itu, riwayat antrean tidak
 *   bisa dipertanggungjawabkan.
 * - **Hanya baris dead-letter yang boleh di-replay.** Baris yang masih punya
 *   lease aktif (sedang diproses worker lain) ditolak; mereplay-nya berarti dua
 *   eksekusi bersamaan untuk satu event. Baris pending ditolak karena ia akan
 *   segera diklaim sendiri — replay di situ adalah kesalahpahaman operator,
 *   bukan operasi.
 * - **Aktor harus admin aktif di database.** UUID dari CLI bukan bukti
 *   otorisasi; role yang dicabut tidak boleh dipakai untuk mereplay event.
 *   CLI tetap hanya boleh dijalankan operator yang memiliki akses database.
 * - **Replay memberi anggaran percobaan baru.** `attempts` dikembalikan ke 0,
 *   karena replay yang diikuti kematian langsung pada percobaan berapapun tidak
 *   berguna. Percobaan lama tidak hilang dari sejarah: baris audit replay
 *   mencatat `attempts` dan `last_error_code` saat itu.
 * - **Efek samping yang sudah `succeeded` tetap tidak digandakan.** Replay
 *   menormalkan baris event, tetapi baris `outbox_deliveries` yang `succeeded`
 *   tidak disentuh; `jalankanSekali` melewati sink yang sudah selesai. Itu yang
 *   membuat replay aman untuk event yang mati *setelah* sebagian sinknya
 *   berhasil.
 */

import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { denganTransaksi, getDb } from "@/lib/db/client";
import { auditEvents, outboxEvents, userRoles, users } from "@/lib/db/schema";
import { catatAudit } from "@/lib/auth/audit";

/** Baris dead-letter sebagaimana ditampilkan operator. */
export type BarisDeadLetter = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  attempts: number;
  lastErrorCode: string | null;
  occurredAt: Date;
  deadLetteredAt: Date | null;
};

/** Bentuk UUID yang sah — id event dan `actorUserId` harus benar-benar uuid. */
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nama aksi audit untuk replay dead-letter. Diekspor agar CLI/test memakai satu nilai. */
export const AKSI_AUDIT_REPLAY = "outbox.replay";

/**
 * Daftar event yang gagal terminal, terbaru dahulu.
 *
 * `limit` dibatasi supaya CLI pada antrean besar tidak menarik semuanya ke
 * memori terminal. Pemanggil yang butuh total memakai `jumlahDeadLetter()`,
 * lalu memaginasi daftarnya.
 */
export async function daftarDeadLetter(limit = 50): Promise<BarisDeadLetter[]> {
  const maks = Math.max(1, Math.min(Math.floor(limit), 1_000));

  const baris = await getDb()
    .select({
      id: outboxEvents.id,
      type: outboxEvents.type,
      aggregateType: outboxEvents.aggregateType,
      aggregateId: outboxEvents.aggregateId,
      attempts: outboxEvents.attempts,
      lastErrorCode: outboxEvents.lastErrorCode,
      occurredAt: outboxEvents.occurredAt,
      deadLetteredAt: outboxEvents.deadLetteredAt,
    })
    .from(outboxEvents)
    .where(isNotNull(outboxEvents.deadLetteredAt))
    .orderBy(desc(outboxEvents.deadLetteredAt))
    .limit(maks);

  return baris;
}

/** Hitung event yang gagal terminal. Angka untuk dashboard/alert, bukan daftar. */
export async function jumlahDeadLetter(): Promise<number> {
  const [baris] = await getDb()
    .select({ jumlah: sql<number>`count(*)::int` })
    .from(outboxEvents)
    .where(isNotNull(outboxEvents.deadLetteredAt));
  return baris?.jumlah ?? 0;
}

/** Hasil percobaan replay — alasan dibedakan supaya CLI bisa memberi pesan tepat. */
export type HasilReplay =
  | { ok: true; id: string }
  | { ok: false; alasan: "id_tidak_valid" | "aktor_bukan_admin" | "tidak_ditemukan" | "bukan_dead_letter" | "sedang_diklaim" };

/**
 * Kembalikan satu event dead-letter ke antrean dan catat keputusannya.
 *
 * Urutan di dalam satu transaksi: baca baris `FOR UPDATE` → tolak bila bukan
 * dead-letter atau lease-nya masih aktif → tulis audit replay → normalkan kolom
 * status. Audit berada di transaksi yang sama sehingga tidak mungkin ada "event
 * kembali ke antrean tanpa jejak keputusan" maupun sebaliknya.
 *
 * `reason` wajib dan tidak boleh kosong: replay tanpa alasan adalah replay yang
 * enam bulan lagi tidak bisa dijelaskan siapa pun.
 */
export async function replayDeadLetter(input: {
  eventId: string;
  actorUserId: string;
  reason: string;
  now?: Date;
}): Promise<HasilReplay> {
  if (!POLA_UUID.test(input.eventId) || !POLA_UUID.test(input.actorUserId)) {
    return { ok: false, alasan: "id_tidak_valid" };
  }

  const alasan = input.reason.trim();
  if (alasan.length === 0) {
    // Bukan galat pemanggil yang bisa diabaikan: tanpa alasan, jejak auditnya
    // tidak menjawab pertanyaan yang ia ada untuk jawab.
    throw new Error("Alasan replay wajib diisi.");
  }

  return denganTransaksi(async (tx) => {
    // Lock users dan user_roles sekaligus: cabutRole mengunci baris role
    // yang sama sebelum mengubah revoked_at, sehingga pencabutan dan replay
    // terserialisasi tanpa celah antara cek otorisasi dan commit audit.
    const [aktor] = await tx
      .select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(and(
        eq(users.id, input.actorUserId),
        eq(users.status, "active"),
        eq(userRoles.role, "admin"),
        isNull(userRoles.revokedAt),
      ))
      .limit(1)
      .for("update");
    if (!aktor) return { ok: false as const, alasan: "aktor_bukan_admin" as const };

    const [baris] = await tx
      .select({
        id: outboxEvents.id,
        type: outboxEvents.type,
        attempts: outboxEvents.attempts,
        lastErrorCode: outboxEvents.lastErrorCode,
        deadLetteredAt: outboxEvents.deadLetteredAt,
        leaseOwner: outboxEvents.leaseOwner,
        leaseExpiresAt: outboxEvents.leaseExpiresAt,
      })
      .from(outboxEvents)
      .where(eq(outboxEvents.id, input.eventId))
      .for("update");

    if (!baris) return { ok: false as const, alasan: "tidak_ditemukan" as const };

    if (baris.deadLetteredAt === null) {
      return { ok: false as const, alasan: "bukan_dead_letter" as const };
    }

    const sekarang = input.now ?? new Date();
    const leaseAktif =
      baris.leaseOwner !== null &&
      baris.leaseExpiresAt !== null &&
      baris.leaseExpiresAt.getTime() > sekarang.getTime();
    if (leaseAktif) {
      return { ok: false as const, alasan: "sedang_diklaim" as const };
    }

    await catatAudit(tx, {
      actorUserId: input.actorUserId,
      action: AKSI_AUDIT_REPLAY,
      entityType: "outbox_event",
      entityId: baris.id,
      payloadRedacted: {
        reason: alasan,
        type: baris.type,
        // Kegagalan sebelumnya disalin sebelum kolomnya dibersihkan, sehingga
        // "kenapa dulu mati" tetap terjawab dari tabel audit.
        error_code: baris.lastErrorCode,
        attempts: baris.attempts,
      },
    });

    await tx
      .update(outboxEvents)
      .set({
        deadLetteredAt: null,
        processedAt: null,
        lastErrorCode: null,
        attempts: 0,
        availableAt: sekarang,
        leaseOwner: null,
        leaseExpiresAt: null,
      })
      .where(eq(outboxEvents.id, baris.id));

    return { ok: true as const, id: baris.id };
  });
}

/** Riwayat replay untuk sebuah event — dipakai test dan operator yang menelusuri. */
export async function riwayatReplay(eventId: string) {
  return getDb()
    .select({
      id: auditEvents.id,
      actorUserId: auditEvents.actorUserId,
      payloadRedacted: auditEvents.payloadRedacted,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.action, AKSI_AUDIT_REPLAY),
        eq(auditEvents.entityType, "outbox_event"),
        eq(auditEvents.entityId, eventId),
      ),
    )
    .orderBy(desc(auditEvents.id));
}
