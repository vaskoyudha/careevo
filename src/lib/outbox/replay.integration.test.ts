/**
 * Test integrasi replay/dead-letter — **butuh PostgreSQL** (`npm run test:db`).
 *
 * Membuktikan janji operasional plan §6: event terminal dapat ditemukan, dan
 * replay-nya mencatat aktor + alasan sekaligus membuat event benar-benar bisa
 * diproses lagi — tanpa menggandakan efek samping yang sudah sukses.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { auditEvents, outboxEvents, userRoles, users } from "@/lib/db/schema";
import { TIPE_EVENT } from "@/lib/outbox/handlers";
import { jalankanSatuPutaran } from "@/lib/outbox/worker";
import {
  AKSI_AUDIT_REPLAY,
  daftarDeadLetter,
  jumlahDeadLetter,
  replayDeadLetter,
  riwayatReplay,
} from "@/lib/outbox/replay";

let db: KoneksiDb = getDb();

async function kosongkan() {
  await db.execute(
    `truncate table audit_events, outbox_deliveries, outbox_events, users cascade`,
  );
}

async function buatUser(suffix: string) {
  const [row] = await db
    .insert(users)
    .values({
      emailNormalized: `replay${suffix}@contoh.test`,
      usernameNormalized: `replay${suffix}`,
      displayName: `Replay ${suffix}`,
    })
    .returning();
  return row;
}

async function buatAdmin(suffix: string) {
  const user = await buatUser(suffix);
  await db.insert(userRoles).values({ userId: user.id, role: "admin" });
  return user;
}

async function seedEvent(over: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(outboxEvents)
    .values({
      type: TIPE_EVENT.authRegistered,
      aggregateType: "user",
      aggregateId: "00000000-0000-0000-0000-000000000000",
      payloadRedacted: { userId: "00000000-0000-0000-0000-000000000000" },
      idempotencyKey: `replay:${crypto.randomUUID()}`,
      ...over,
    })
    .returning();
  return row;
}

/** Buat event yang benar-benar sudah dead-letter lewat worker. */
async function seedDeadLetter(): Promise<string> {
  const event = await seedEvent({ type: "file.scanned" });
  await jalankanSatuPutaran({ owner: "worker-uji" });
  return event.id;
}

beforeEach(async () => {
  db = getDb();
  await kosongkan();
});

afterAll(async () => {
  await tutupDb();
});

describe("dead-letter — pencarian", () => {
  it("menampilkan event terminal dengan kode galat dan waktu dead-letter", async () => {
    const id = await seedDeadLetter();

    const daftar = await daftarDeadLetter();
    expect(daftar.map((b) => b.id)).toContain(id);

    const baris = daftar.find((b) => b.id === id);
    expect(baris?.lastErrorCode).toBe("handler_tidak_terdaftar");
    expect(baris?.deadLetteredAt).not.toBeNull();

    expect(await jumlahDeadLetter()).toBe(1);
  });

  it("tidak menghitung event yang belum mati sebagai dead-letter", async () => {
    const user = await buatUser("sehat");
    await seedEvent({ payloadRedacted: { userId: user.id } });
    await jalankanSatuPutaran({ owner: "worker-uji" });

    expect(await jumlahDeadLetter()).toBe(0);
    expect(await daftarDeadLetter()).toHaveLength(0);
  });
});

describe("replay — keputusan ber-audit dan pemulihan", () => {
  it("mengembalikan event terminal ke antrean dan mencatat aktor + alasan", async () => {
    const id = await seedDeadLetter();
    const admin = await buatAdmin("admin");

    const hasil = await replayDeadLetter({
      eventId: id,
      actorUserId: admin.id,
      reason: "handler dipasang di #1234",
    });
    expect(hasil.ok).toBe(true);

    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, id));
    expect(sesudah?.deadLetteredAt).toBeNull();
    expect(sesudah?.lastErrorCode).toBeNull();
    expect(sesudah?.attempts).toBe(0);
    expect(sesudah?.leaseOwner).toBeNull();
    // `available_at` di masa lalu supaya worker berikutnya langsung mengambilnya.
    expect(sesudah?.availableAt.getTime()).toBeLessThanOrEqual(Date.now());

    const riwayat = await riwayatReplay(id);
    expect(riwayat).toHaveLength(1);
    expect(riwayat[0]?.actorUserId).toBe(admin.id);
    expect(riwayat[0]?.payloadRedacted).toMatchObject({
      reason: "handler dipasang di #1234",
      type: "file.scanned",
      error_code: "handler_tidak_terdaftar",
      attempts: 1,
    });
  });

  it("replay event yang sink-nya sudah sukses tidak menggandakan efek samping", async () => {
    // Event auth.registered yang sukses, lalu dibuat dead-letter secara buatan
    // (mis. gagal pada sink kedua di masa depan). Ledger `audit` tetap sukses.
    const user = await buatUser("takganda");
    const event = await seedEvent({ payloadRedacted: { userId: user.id } });
    await jalankanSatuPutaran({ owner: "worker-uji" });

    await db
      .update(outboxEvents)
      .set({ deadLetteredAt: new Date(), lastErrorCode: "sink_lain_gagal" })
      .where(eq(outboxEvents.id, event.id));

    const admin = await buatAdmin("admin2");
    const hasil = await replayDeadLetter({
      eventId: event.id,
      actorUserId: admin.id,
      reason: "sink lain diperbaiki",
    });
    expect(hasil.ok).toBe(true);

    await jalankanSatuPutaran({ owner: "worker-uji" });

    const audit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "user.registered"));
    expect(audit).toHaveLength(1);
  });
});

describe("replay — penolakan yang benar", () => {
  it("menolak id yang bukan uuid", async () => {
    const hasil = await replayDeadLetter({
      eventId: "bukan-uuid",
      actorUserId: "00000000-0000-0000-0000-000000000000",
      reason: "x",
    });
    expect(hasil).toEqual({ ok: false, alasan: "id_tidak_valid" });
  });

  it("menolak event yang tidak ada", async () => {
    const admin = await buatAdmin("tidakada");
    const hasil = await replayDeadLetter({
      eventId: "00000000-0000-0000-0000-000000000001",
      actorUserId: admin.id,
      reason: "x",
    });
    expect(hasil).toEqual({ ok: false, alasan: "tidak_ditemukan" });
  });

  it("menolak replay atas nama pengguna yang bukan admin aktif", async () => {
    const id = await seedDeadLetter();
    const user = await buatUser("bukanadmin");
    const hasil = await replayDeadLetter({ eventId: id, actorUserId: user.id, reason: "coba" });
    expect(hasil).toEqual({ ok: false, alasan: "aktor_bukan_admin" });
    expect(await riwayatReplay(id)).toHaveLength(0);

    const admin = await buatAdmin("dicabut");
    await db.update(userRoles).set({ revokedAt: new Date() }).where(eq(userRoles.userId, admin.id));
    const setelahRevoke = await replayDeadLetter({ eventId: id, actorUserId: admin.id, reason: "coba" });
    expect(setelahRevoke).toEqual({ ok: false, alasan: "aktor_bukan_admin" });
    expect(await riwayatReplay(id)).toHaveLength(0);
  });

  it("menolak event pending — ia akan diklaim sendiri oleh worker", async () => {
    const user = await buatUser("pending");
    const event = await seedEvent({ payloadRedacted: { userId: user.id } });
    const admin = await buatAdmin("admin3");

    const hasil = await replayDeadLetter({
      eventId: event.id,
      actorUserId: admin.id,
      reason: "coba replay",
    });
    expect(hasil).toEqual({ ok: false, alasan: "bukan_dead_letter" });
    // Penolakan tidak menulis audit.
    expect(await riwayatReplay(event.id)).toHaveLength(0);
  });

  it("menolak event yang lease-nya masih aktif (sedang diproses worker lain)", async () => {
    const user = await buatUser("diklaim");
    const event = await seedEvent({
      payloadRedacted: { userId: user.id },
      deadLetteredAt: new Date(),
      lastErrorCode: "kode_lama",
      leaseOwner: "worker-hidup",
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    const admin = await buatAdmin("admin4");

    const hasil = await replayDeadLetter({
      eventId: event.id,
      actorUserId: admin.id,
      reason: "coba replay",
    });
    expect(hasil).toEqual({ ok: false, alasan: "sedang_diklaim" });
    expect(await riwayatReplay(event.id)).toHaveLength(0);
  });

  it("menolak alasan kosong tanpa menyentuh database", async () => {
    const id = await seedDeadLetter();
    const admin = await buatAdmin("admin5");

    await expect(
      replayDeadLetter({ eventId: id, actorUserId: admin.id, reason: "   " }),
    ).rejects.toThrow(/Alasan replay wajib/);

    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, id));
    expect(sesudah?.deadLetteredAt).not.toBeNull();
    expect(await riwayatReplay(id)).toHaveLength(0);
  });
});

describe("replay — aksi audit terpisah dari aksi bisnis", () => {
  it("memakai aksi outbox.replay, bukan menimpa audit bisnis", async () => {
    const id = await seedDeadLetter();
    const admin = await buatAdmin("admin6");
    await replayDeadLetter({ eventId: id, actorUserId: admin.id, reason: "perbaikan" });

    const aksiReplay = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, AKSI_AUDIT_REPLAY));
    expect(aksiReplay).toHaveLength(1);
    expect(aksiReplay[0]?.entityType).toBe("outbox_event");
    expect(aksiReplay[0]?.entityId).toBe(id);
  });
});
