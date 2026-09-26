/**
 * Test integrasi worker outbox — **butuh PostgreSQL** (`npm run test:db`).
 *
 * Berkas ini membuktikan properti yang tidak bisa dibuktikan test unit: claim
 * atomik, pemulihan lease kedaluwarsa, fencing kepemilikan, idempotensi ledger,
 * backoff non-terminal, dan dead-letter terminal. Semuanya adalah janji plan §6
 * dan milestone M1A.
 *
 * Event ditulis langsung ke `outbox_events` (bukan lewat writer, yang dimiliki
 * subagent schema) supaya test ini menguji **worker**, bukan penulisnya.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import {
  auditEvents,
  outboxDeliveries,
  outboxEvents,
  users,
  type NewOutboxEvent,
} from "@/lib/db/schema";
import { TIPE_EVENT } from "@/lib/outbox/handlers";
import { klaimEvent, prosesEvent, jalankanSatuPutaran } from "@/lib/outbox/worker";

let db: KoneksiDb = getDb();

const OWNER = "worker-uji";

async function kosongkan() {
  await db.execute(
    // `cascade` menghapus outbox_deliveries lewat FK-nya.
    `truncate table audit_events, outbox_deliveries, outbox_events, users cascade`,
  );
}

async function buatUser(suffix: string) {
  const [row] = await db
    .insert(users)
    .values({
      emailNormalized: `outbox${suffix}@contoh.test`,
      usernameNormalized: `outbox${suffix}`,
      displayName: `Outbox ${suffix}`,
    })
    .returning();
  return row;
}

/** Tulis event outbox mentah dan kembalikan barisnya. */
async function seedEvent(over: Partial<NewOutboxEvent> = {}) {
  const [row] = await db
    .insert(outboxEvents)
    .values({
      type: TIPE_EVENT.authRegistered,
      aggregateType: "user",
      aggregateId: "00000000-0000-0000-0000-000000000000",
      payloadRedacted: { userId: "00000000-0000-0000-0000-000000000000" },
      idempotencyKey: `uji:${crypto.randomUUID()}`,
      ...over,
    })
    .returning();
  return row;
}

async function hitungAudit(action: string) {
  const baris = await db.select().from(auditEvents).where(eq(auditEvents.action, action));
  return baris.length;
}

async function deliveryUntuk(eventId: string, sink: string) {
  const [row] = await db
    .select()
    .from(outboxDeliveries)
    .where(and(eq(outboxDeliveries.eventId, eventId), eq(outboxDeliveries.sink, sink)));
  return row ?? null;
}

beforeEach(async () => {
  db = getDb();
  await kosongkan();
});

afterAll(async () => {
  await tutupDb();
});

describe("worker — jalur sukses dan fan-out audit", () => {
  it("memproses auth.registered: audit satu baris, ledger succeeded, processed_at terisi", async () => {
    const user = await buatUser("sukses");
    const event = await seedEvent({ payloadRedacted: { userId: user.id } });

    const stat = await jalankanSatuPutaran({ owner: OWNER });

    expect(stat.diklaim).toBe(1);
    expect(stat.berhasil).toBe(1);
    expect(stat.gagalTerminal).toBe(0);

    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    expect(sesudah?.processedAt).not.toBeNull();
    expect(sesudah?.deadLetteredAt).toBeNull();
    expect(sesudah?.lastErrorCode).toBeNull();
    expect(sesudah?.leaseOwner).toBeNull();
    expect(sesudah?.attempts).toBe(1);

    expect(await hitungAudit("user.registered")).toBe(1);
    const delivery = await deliveryUntuk(event.id, "audit");
    expect(delivery?.status).toBe("succeeded");
    expect(delivery?.deliveredAt).not.toBeNull();
  });

  it("menjalankan ulang event yang sama tidak menggandakan audit (idempotensi ledger)", async () => {
    const user = await buatUser("idem");
    const event = await seedEvent({ payloadRedacted: { userId: user.id } });

    await jalankanSatuPutaran({ owner: OWNER });
    expect(await hitungAudit("user.registered")).toBe(1);

    // Simulasikan reclaim/replay: baris event kembali pending, ledger dibiarkan
    // `succeeded`. Handler harus melewati efek sampingnya.
    await db
      .update(outboxEvents)
      .set({
        processedAt: null,
        deadLetteredAt: null,
        attempts: 0,
        availableAt: new Date(Date.now() - 1_000),
        leaseOwner: null,
        leaseExpiresAt: null,
      })
      .where(eq(outboxEvents.id, event.id));

    const stat = await jalankanSatuPutaran({ owner: OWNER });
    expect(stat.berhasil).toBe(1);
    expect(await hitungAudit("user.registered")).toBe(1);
  });
});

describe("worker — tipe tak dikenal dan payload rusak adalah terminal", () => {
  it("memindahkan tipe tanpa handler ke dead-letter, bukan sukses diam", async () => {
    // `file.scanned` belum punya handler — fail-closed.
    const event = await seedEvent({ type: "file.scanned" });

    const stat = await jalankanSatuPutaran({ owner: OWNER });

    expect(stat.gagalTerminal).toBe(1);
    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    expect(sesudah?.deadLetteredAt).not.toBeNull();
    expect(sesudah?.processedAt).toBeNull();
    expect(sesudah?.lastErrorCode).toBe("handler_tidak_terdaftar");
    expect(await hitungAudit("user.registered")).toBe(0);
  });

  it("menandai payload tanpa userId sebagai terminal payload_tidak_valid", async () => {
    const event = await seedEvent({ payloadRedacted: { sesuatu: "bukan-user" } });

    const stat = await jalankanSatuPutaran({ owner: OWNER });

    expect(stat.gagalTerminal).toBe(1);
    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    expect(sesudah?.lastErrorCode).toBe("payload_tidak_valid");
    expect(sesudah?.deadLetteredAt).not.toBeNull();
  });
});

describe("worker — retry non-terminal, backoff, dan dead-letter saat anggaran habis", () => {
  it("handler yang melempar menggeser available_at dan melepas lease, tanpa mematikan event", async () => {
    // Payload lolos validasi (uuid sah), tetapi `userId`-nya tidak ada di tabel
    // `users`. `audit_events.actor_user_id` ber-FK, jadi penulisan audit gagal
    // dan handler melempar — kegagalan sementara yang nyata, bukan simulasi.
    const event = await seedEvent({
      payloadRedacted: { userId: "99999999-9999-9999-9999-999999999999" },
    });

    const stat = await jalankanSatuPutaran({ owner: OWNER });

    expect(stat.gagalSementara).toBe(1);
    expect(stat.gagalTerminal).toBe(0);

    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    expect(sesudah?.deadLetteredAt).toBeNull();
    expect(sesudah?.processedAt).toBeNull();
    expect(sesudah?.lastErrorCode).toBe("gagal_sementara");
    expect(sesudah?.leaseOwner).toBeNull();
    expect(sesudah?.availableAt.getTime()).toBeGreaterThan(Date.now());

    // Ledger ditandai `failed` supaya percobaan berikutnya boleh ambil alih.
    expect((await deliveryUntuk(event.id, "audit"))?.status).toBe("failed");
    expect(await hitungAudit("user.registered")).toBe(0);
  });

  it("kegagalan sementara lalu sukses pada percobaan berikutnya, audit tepat sekali", async () => {
    const user = await buatUser("pulih");
    // Percobaan pertama gagal karena userId tidak dikenal (FK), percobaan kedua
    // memakai user yang benar-benar ada lewat payload yang diperbarui.
    const event = await seedEvent({
      payloadRedacted: { userId: "99999999-9999-9999-9999-999999999999" },
    });

    await jalankanSatuPutaran({ owner: OWNER });
    expect((await deliveryUntuk(event.id, "audit"))?.status).toBe("failed");

    // Perbaiki payload dan majukan waktu.
    await db
      .update(outboxEvents)
      .set({
        payloadRedacted: { userId: user.id },
        availableAt: new Date(Date.now() - 1_000),
      })
      .where(eq(outboxEvents.id, event.id));

    const stat = await jalankanSatuPutaran({ owner: OWNER });
    expect(stat.berhasil).toBe(1);
    expect(await hitungAudit("user.registered")).toBe(1);
    expect((await deliveryUntuk(event.id, "audit"))?.status).toBe("succeeded");
  });

  it("menghabiskan maxAttempts lalu memindahkan event ke dead-letter", async () => {
    // attempts = 4, maxAttempts = 5: claim berikutnya menaikkannya ke 5, tepat
    // di batas, sehingga kegagalan sementara menjadi terminal.
    const event = await seedEvent({
      payloadRedacted: { userId: "99999999-9999-9999-9999-999999999999" },
      attempts: 4,
    });

    const stat = await jalankanSatuPutaran({ owner: OWNER, maxAttempts: 5 });

    expect(stat.gagalTerminal).toBe(1);
    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    expect(sesudah?.attempts).toBe(5);
    expect(sesudah?.deadLetteredAt).not.toBeNull();
    expect(sesudah?.processedAt).toBeNull();
    expect(await hitungAudit("user.registered")).toBe(0);
  });
});

describe("worker — lease, reclaim, dan fencing", () => {
  it("memulihkan event yang lease-nya kedaluwarsa (worker mati)", async () => {
    const user = await buatUser("reclaim");
    const event = await seedEvent({
      payloadRedacted: { userId: user.id },
      leaseOwner: "worker-mati",
      leaseExpiresAt: new Date(Date.now() - 60_000),
    });

    // Satu putaran: claim + proses. Event diklaim meski lease lama belum
    // dilepas, karena lease-nya sudah kedaluwarsa.
    const stat = await jalankanSatuPutaran({ owner: OWNER });
    expect(stat.diklaim).toBe(1);
    expect(stat.berhasil).toBe(1);

    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    expect(sesudah?.processedAt).not.toBeNull();
    expect(await hitungAudit("user.registered")).toBe(1);
  });

  it("tidak mencuri event yang lease-nya masih aktif", async () => {
    const user = await buatUser("aktif");
    await seedEvent({
      payloadRedacted: { userId: user.id },
      leaseOwner: "worker-hidup",
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });

    const diklaim = await klaimEvent({ owner: OWNER });

    expect(diklaim).toHaveLength(0);
    expect(await hitungAudit("user.registered")).toBe(0);
  });

  it("menolak menutup event yang lease-nya bukan miliknya (fencing), tanpa efek samping", async () => {
    const user = await buatUser("fencing");
    const event = await seedEvent({
      payloadRedacted: { userId: user.id },
      leaseOwner: "worker-lain",
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });

    const hasil = await prosesEvent(
      {
        id: event.id,
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payloadRedacted: event.payloadRedacted,
        idempotencyKey: event.idempotencyKey,
        attempts: event.attempts,
      },
      { owner: OWNER },
    );

    expect(hasil).toBe("kehilangan_lease");
    // Tidak ada audit dan barisnya tidak tersentuh.
    expect(await hitungAudit("user.registered")).toBe(0);
    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    expect(sesudah?.processedAt).toBeNull();
    expect(sesudah?.leaseOwner).toBe("worker-lain");
  });

  it("worker lama tidak dapat mencatat kegagalan setelah lease diambil alih worker lain", async () => {
    const event = await seedEvent({
      type: "file.scanned",
      leaseOwner: OWNER,
      leaseExpiresAt: new Date(Date.now() - 60_000),
      attempts: 1,
    });
    const [diklaimUlang] = await klaimEvent({ owner: "worker-baru" });
    expect(diklaimUlang?.attempts).toBe(2);

    const hasil = await prosesEvent({
      id: event.id,
      type: event.type,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payloadRedacted: event.payloadRedacted,
      idempotencyKey: event.idempotencyKey,
      attempts: event.attempts,
    }, { owner: OWNER });

    expect(hasil).toBe("kehilangan_lease");
    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    expect(sesudah?.leaseOwner).toBe("worker-baru");
    expect(sesudah?.deadLetteredAt).toBeNull();
    expect(await deliveryUntuk(event.id, "audit")).toBeNull();
  });

  it("owner yang sama tidak dapat mengakui attempt lama setelah klaim ulang", async () => {
    const user = await buatUser("attempt-lama");
    const event = await seedEvent({
      payloadRedacted: { userId: user.id },
      leaseOwner: OWNER,
      leaseExpiresAt: new Date(Date.now() - 60_000),
      attempts: 1,
    });
    const [diklaimUlang] = await klaimEvent({ owner: OWNER });
    expect(diklaimUlang?.attempts).toBe(2);

    const hasil = await prosesEvent({
      id: event.id,
      type: event.type,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payloadRedacted: event.payloadRedacted,
      idempotencyKey: event.idempotencyKey,
      attempts: event.attempts,
    }, { owner: OWNER });

    expect(hasil).toBe("kehilangan_lease");
    expect(await hitungAudit("user.registered")).toBe(0);
    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    expect(sesudah?.attempts).toBe(2);
    expect(sesudah?.processedAt).toBeNull();
  });

  it("tidak mengklaim event yang belum waktunya (available_at di masa depan)", async () => {
    const user = await buatUser("nanti");
    await seedEvent({
      payloadRedacted: { userId: user.id },
      availableAt: new Date(Date.now() + 60_000),
    });

    const stat = await jalankanSatuPutaran({ owner: OWNER });
    expect(stat.diklaim).toBe(0);
  });
});

describe("worker — claim atomik multi-worker (klaim paralel)", () => {
  /**
   * Uji di sini menjalankan dua worker ber-`owner` berbeda secara **paralel**
   * (`Promise.all`) atas basis data yang sama. Itulah satu-satunya cara
   * membuktikan `FOR UPDATE SKIP LOCKED` + lease: klaim yang sekuensial tidak
   * akan pernah memunculkan perebutan baris.
   *
   * Fencing owner-yang-sama sudah diuji di blok sebelumnya dan sengaja tidak
   * diulang di sini.
   */
  it("dua klaim paralel owner berbeda atas satu event: tepat satu menang, satu audit", async () => {
    const user = await buatUser("paralel-satu");
    const event = await seedEvent({ payloadRedacted: { userId: user.id } });

    const [a, b] = await Promise.all([
      jalankanSatuPutaran({ owner: "worker-a" }),
      jalankanSatuPutaran({ owner: "worker-b" }),
    ]);

    // Tidak ada double claim: total klaim tepat satu, dan tidak ada worker yang
    // sempat kehilangan lease (itu justru tanda dua worker memegang baris sama).
    expect(a.diklaim + b.diklaim).toBe(1);
    expect(a.kehilanganLease + b.kehilanganLease).toBe(0);
    expect(a.berhasil + b.berhasil).toBe(1);

    // `attempts` hanya naik sekali — bukti baris tidak pernah diklaim dua kali.
    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    expect(sesudah?.attempts).toBe(1);
    expect(sesudah?.processedAt).not.toBeNull();
    expect(sesudah?.deadLetteredAt).toBeNull();

    // Efek samping tepat sekali, worker mana pun yang menang.
    expect(await hitungAudit("user.registered")).toBe(1);
    const barisDelivery = await db
      .select()
      .from(outboxDeliveries)
      .where(eq(outboxDeliveries.eventId, event.id));
    expect(barisDelivery).toHaveLength(1);
    expect(barisDelivery[0]?.status).toBe("succeeded");
  });

  it("dua klaim paralel owner berbeda atas dua event: tiap event diklaim satu worker, tiap user satu audit", async () => {
    const u1 = await buatUser("paralel-a");
    const u2 = await buatUser("paralel-b");
    const e1 = await seedEvent({ payloadRedacted: { userId: u1.id } });
    const e2 = await seedEvent({ payloadRedacted: { userId: u2.id } });

    // `batchSize: 1` memaksa tiap worker mengambil paling banyak satu event,
    // sehingga dua worker paralel harus berbagi dua event tanpa perebutan.
    const [a, b] = await Promise.all([
      jalankanSatuPutaran({ owner: "worker-a", batchSize: 1 }),
      jalankanSatuPutaran({ owner: "worker-b", batchSize: 1 }),
    ]);

    expect(a.diklaim).toBe(1);
    expect(b.diklaim).toBe(1);
    expect(a.berhasil).toBe(1);
    expect(b.berhasil).toBe(1);
    expect(a.kehilanganLease + b.kehilanganLease).toBe(0);

    for (const id of [e1.id, e2.id]) {
      const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, id));
      expect(sesudah?.attempts).toBe(1);
      expect(sesudah?.processedAt).not.toBeNull();
      expect(sesudah?.deadLetteredAt).toBeNull();
    }

    // Dua user berbeda → dua audit, masing-masing tepat sekali.
    expect(await hitungAudit("user.registered")).toBe(2);
    // Satu baris ledger per event — tidak ada event yang diproses dua kali.
    const barisDelivery = await db
      .select()
      .from(outboxDeliveries)
      .where(eq(outboxDeliveries.sink, "audit"));
    expect(barisDelivery).toHaveLength(2);
    expect(barisDelivery.every((d) => d.status === "succeeded")).toBe(true);
  });

  it("dua worker paralel merebut lease kedaluwarsa (worker mati): satu pemenang, satu audit", async () => {
    const user = await buatUser("reclaim-paralel");
    const event = await seedEvent({
      payloadRedacted: { userId: user.id },
      leaseOwner: "worker-mati",
      leaseExpiresAt: new Date(Date.now() - 60_000),
      attempts: 1,
    });

    // Dua worker hidup berlomba mengambil alih lease yang sudah kedaluwarsa.
    const [a, b] = await Promise.all([
      jalankanSatuPutaran({ owner: "worker-x" }),
      jalankanSatuPutaran({ owner: "worker-y" }),
    ]);

    expect(a.diklaim + b.diklaim).toBe(1);
    expect(a.berhasil + b.berhasil).toBe(1);
    expect(a.kehilanganLease + b.kehilanganLease).toBe(0);

    // `attempts` naik dari 1 → 2 tepat sekali: hanya satu reclaim yang tercatat,
    // dan barisnya ditutup sebagai selesai — bukan sebagai dead-letter.
    const [sesudah] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
    expect(sesudah?.attempts).toBe(2);
    expect(sesudah?.processedAt).not.toBeNull();
    expect(sesudah?.deadLetteredAt).toBeNull();

    // Pemulihan tidak menggandakan efek samping meski dua worker berlomba.
    expect(await hitungAudit("user.registered")).toBe(1);
    const barisDelivery = await db
      .select()
      .from(outboxDeliveries)
      .where(eq(outboxDeliveries.eventId, event.id));
    expect(barisDelivery).toHaveLength(1);
    expect(barisDelivery[0]?.status).toBe("succeeded");
  });
});
