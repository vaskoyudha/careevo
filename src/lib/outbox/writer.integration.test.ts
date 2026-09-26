/**
 * Test integrasi writer transactional outbox.
 *
 * Berkas ini membuktikan janji yang tidak bisa dibuktikan test unit murni:
 *
 * 1. **Rollback bisnis membatalkan event.** Event yang ditulis di transaksi
 *    yang gagal tidak boleh tertinggal. Kalau ini bocor, worker akan
 *    mengirim email/audit untuk user yang tidak pernah ada — kebalikan dari
 *    "tidak ada efek samping tanpa commit".
 * 2. **Commit bisnis selalu membawa event.** Mutasi yang sukses dan event
 *    yang diwajibkan commit bersama; tidak ada jendela di antaranya.
 * 3. **Penulisan ulang idempoten.** `idempotency_key` yang sama tidak
 *    menghasilkan baris kedua, dan pemanggil dapat membedakan "baru" dari
 *    "sudah ada" lewat nilai kembalian `null`.
 * 4. **Payload disaring sebelum insert.** Bukan sesudah, dan bukan oleh
 *    pemanggil: yang tersimpan di kolom `payload_redacted` sudah bersih.
 *
 * `npm test` mengecualikan pola `.integration.test.ts`; berkas ini hanya
 * dijalankan `npm run test:db` bersama basis data ephemeral.
 */

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getDb, tutupDb, denganTransaksi, type KoneksiDb, type TransaksiDb } from "@/lib/db/client";
import { outboxEvents, users } from "@/lib/db/schema";
import { PeristiwaOutboxError, jalankanDenganOutbox, tulisOutbox } from "./writer";

let db: KoneksiDb = getDb();

/** Handle query: koneksi proses atau transaksi yang sedang berjalan. */
type Eksekutor = KoneksiDb | TransaksiDb;

/** Nilai sentinel yang tidak boleh muncul di database dalam bentuk aslinya. */
const TOKEN_SENTINEL = "rahasia-yang-panjang-dan-opaque-1234567890";

beforeEach(async () => {
  db = getDb();
  await db.execute(
    sql`truncate table outbox_deliveries, outbox_events, audit_events, users cascade`,
  );
});

afterAll(async () => {
  await tutupDb();
});

/** Insert user minimal dan kembalikan id-nya. */
async function buatUser(suffix: string, tx: Eksekutor = db) {
  const [row] = await tx.execute<{ id: string }>(
    sql`insert into users (email_normalized, username_normalized, display_name)
        values (${`outbox${suffix}@contoh.test`}, ${`outbox${suffix}`}, ${`Outbox ${suffix}`})
        returning id`,
  );
  return row!;
}

/** Jumlah baris pada sebuah tabel. */
async function hitung(tabel: "outbox_events" | "users") {
  const rows = await db.execute<{ jumlah: number }>(
    sql`select count(*)::int as jumlah from ${sql.identifier(tabel)}`,
  );
  return rows[0]!.jumlah;
}

describe("tulisOutbox — atomicity", () => {
  it("tidak meninggalkan event ketika transaksi bisnis di-rollback", async () => {
    await expect(
      denganTransaksi(async (tx) => {
        const user = await buatUser("rollback", tx);
        await tulisOutbox(tx, {
          type: "auth.registered",
          aggregateType: "user",
          aggregateId: user.id,
          idempotencyKey: `auth.registered:${user.id}`,
        });
        throw new Error("kegagalan bisnis setelah event ditulis");
      }),
    ).rejects.toThrow("kegagalan bisnis");

    // Keduanya harus hilang. Kalau user-nya hilang tapi event-nya ada, worker
    // akan memproses event untuk agregat yang tidak pernah ada.
    expect(await hitung("outbox_events")).toBe(0);
    expect(await hitung("users")).toBe(0);
  });

  it("menulis bisnis dan event bersama saat transaksi commit", async () => {
    const user = await buatUser("commit");

    await db.transaction(async (tx) => {
      await tulisOutbox(tx, {
        type: "auth.registered",
        aggregateType: "user",
        aggregateId: user.id,
        idempotencyKey: `auth.registered:${user.id}`,
      });
    });

    expect(await hitung("outbox_events")).toBe(1);
    expect(await hitung("users")).toBe(1);
    const [baris] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, user.id));
    expect(baris!.type).toBe("auth.registered");
    expect(baris!.attempts).toBe(0);
    expect(baris!.processedAt).toBeNull();
  });
});

describe("tulisOutbox — idempotensi", () => {
  it("mengembalikan null dan tidak menulis baris kedua untuk kunci yang sama", async () => {
    const user = await buatUser("idempoten");
    const peristiwa = {
      type: "auth.registered",
      aggregateType: "user",
      aggregateId: user.id,
      idempotencyKey: `auth.registered:${user.id}`,
    } as const;

    const pertama = await db.transaction((tx) => tulisOutbox(tx, peristiwa));
    const kedua = await db.transaction((tx) => tulisOutbox(tx, peristiwa));

    expect(pertama).not.toBeNull();
    expect(kedua).toBeNull();
    expect(await hitung("outbox_events")).toBe(1);
  });

  it("memberi id yang sama pada baris yang sudah ada, bukan baris baru", async () => {
    const user = await buatUser("id-sama");
    const peristiwa = {
      type: "auth.registered",
      aggregateType: "user",
      aggregateId: user.id,
      idempotencyKey: `auth.registered:${user.id}`,
    } as const;

    const pertama = await db.transaction((tx) => tulisOutbox(tx, peristiwa));
    const [ulang] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.idempotencyKey, peristiwa.idempotencyKey));
    expect(ulang!.id).toBe(pertama!.id);
  });
});

describe("tulisOutbox — redaksi payload", () => {
  it("membuang kunci terlarang dan menyamarkan email sebelum insert", async () => {
    const user = await buatUser("redaksi");

    await db.transaction((tx) =>
      tulisOutbox(tx, {
        type: "auth.registered",
        aggregateType: "user",
        aggregateId: user.id,
        idempotencyKey: `auth.registered:${user.id}`,
        payloadRedacted: {
          userId: user.id,
          email: "budi.santoso@contoh.test",
          token: TOKEN_SENTINEL,
          password_hash: "sha256:mati",
        },
      }),
    );

    const [baris] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, user.id));
    const payload = baris!.payloadRedacted as Record<string, unknown>;

    // Kunci terlarang dibuang seluruhnya, bukan dikosongkan.
    expect(payload).not.toHaveProperty("token");
    expect(payload).not.toHaveProperty("password_hash");
    // Email tetap terbaca untuk audit, tetapi tersamarkan.
    expect(payload.email).toBe("b***@contoh.test");
    // Id entitas uuid dipertahankan utuh.
    expect(payload.userId).toBe(user.id);

    // Nilai mentah tidak boleh ada di mana pun pada baris yang tersimpan.
    const [mentah] = await db.execute<{ bocor: number }>(
      sql`select count(*)::int as bocor from outbox_events where payload_redacted::text like ${`%${TOKEN_SENTINEL}%`}`,
    );
    expect(mentah!.bocor).toBe(0);
  });

  it("menyimpan objek kosong, bukan null, bila payload tidak diberikan", async () => {
    const user = await buatUser("tanpa-payload");
    await db.transaction((tx) =>
      tulisOutbox(tx, {
        type: "auth.registered",
        aggregateType: "user",
        aggregateId: user.id,
        idempotencyKey: `auth.registered:${user.id}`,
      }),
    );
    const [baris] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, user.id));
    expect(baris!.payloadRedacted).toEqual({});
  });
});

describe("tulisOutbox — validasi pemanggil", () => {
  it("menolak type/idempotencyKey kosong sebelum menyentuh database", async () => {
    await expect(
      db.transaction((tx) =>
        tulisOutbox(tx, {
          type: "   ",
          aggregateType: "user",
          aggregateId: "x",
          idempotencyKey: "kunci",
        }),
      ),
    ).rejects.toBeInstanceOf(PeristiwaOutboxError);

    await expect(
      db.transaction((tx) =>
        tulisOutbox(tx, {
          type: "auth.registered",
          aggregateType: "user",
          aggregateId: "x",
          idempotencyKey: "",
        }),
      ),
    ).rejects.toBeInstanceOf(PeristiwaOutboxError);

    expect(await hitung("outbox_events")).toBe(0);
  });
});

describe("jalankanDenganOutbox", () => {
  it("menurunkan aggregateId dari hasil mutasi lewat sumber berbentuk fungsi", async () => {
    const userId = await jalankanDenganOutbox(
      async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            emailNormalized: "jalankan@contoh.test",
            usernameNormalized: "jalankan",
            displayName: "Jalankan",
          })
          .returning({ id: users.id });
        return user!.id;
      },
      (id) => ({
        type: "auth.registered",
        aggregateType: "user",
        aggregateId: id,
        idempotencyKey: `auth.registered:${id}`,
      }),
    );

    expect(await hitung("outbox_events")).toBe(1);
    expect(await hitung("users")).toBe(1);
    const [baris] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.idempotencyKey, `auth.registered:${userId}`));
    expect(baris!.aggregateId).toBe(userId);
    expect(baris!.type).toBe("auth.registered");
  });

  it("membatalkan event bila mutasi bisnis melempar", async () => {
    await expect(
      jalankanDenganOutbox(
        async (tx) => {
          await tx.insert(users).values({
            emailNormalized: "gagal@contoh.test",
            usernameNormalized: "gagal",
            displayName: "Gagal",
          });
          throw new Error("gagal di tengah");
        },
        {
          type: "auth.registered",
          aggregateType: "user",
          aggregateId: "x",
          idempotencyKey: "auth.registered:gagal",
        },
      ),
    ).rejects.toThrow("gagal di tengah");

    expect(await hitung("outbox_events")).toBe(0);
    expect(await hitung("users")).toBe(0);
  });

  it("menerima beberapa event sekaligus", async () => {
    await jalankanDenganOutbox(
      async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            emailNormalized: "banyak@contoh.test",
            usernameNormalized: "banyak",
            displayName: "Banyak",
          })
          .returning({ id: users.id });
        return user!.id;
      },
      (id) => [
        {
          type: "auth.registered",
          aggregateType: "user",
          aggregateId: id,
          idempotencyKey: `auth.registered:${id}`,
        },
        {
          type: "user.profile_created",
          aggregateType: "user",
          aggregateId: id,
          idempotencyKey: `user.profile_created:${id}`,
        },
      ],
    );

    const rows = await db.select().from(outboxEvents);
    expect(rows).toHaveLength(2);
  });
});
