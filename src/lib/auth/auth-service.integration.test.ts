/**
 * Test integrasi application service auth — **butuh PostgreSQL** (`npm run test:db`).
 *
 * Berkas ini membuktikan properti yang tidak bisa dibuktikan test unit:
 *
 * 1. **Keunikan email/username ditegakkan database, bukan pengecekan.** Dua
 *    pendaftaran paralel dengan email sama hanya boleh menghasilkan satu akun;
 *    yang lain menerima `email_dipakai`. Pengecekan "sudah ada?" sebelum insert
 *    tidak cukup — keduanya bisa lolos pengecekan itu bersamaan.
 * 2. **Revoke satu sesi tidak menendang perangkat lain.** Token perangkat yang
 *    dicabut berhenti bekerja; token perangkat lain tetap valid. Reset global
 *    (`cabutSemuaSession`) yang mencabut semuanya.
 * 3. **Password hash tidak pernah plaintext** dan benar-benar diverifikasi lewat
 *    Argon2id.
 * 4. **Role default registrasi publik adalah learner** (`["user"]`), dan hanya
 *    itu — tidak ada jalur `daftarPengguna` yang menghasilkan staff.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { auditEvents, outboxEvents, sessions, userCredentials, users } from "@/lib/db/schema";
import {
  cabutSemuaSession,
  daftarPengguna,
  keluarSession,
  masukPengguna,
  principalDariToken,
} from "@/lib/auth/auth-service";
import { buatSession } from "@/lib/auth/session-repository";
import { verifyPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/token";

let db: KoneksiDb = getDb();

async function kosongkan() {
  await db.execute(
    sql`truncate table
      outbox_events,
      audit_events,
      email_verification_tokens,
      password_reset_tokens,
      sessions,
      staff_invitations,
      user_credentials,
      user_profiles,
      user_roles,
      users
      cascade`,
  );
}

beforeEach(async () => {
  db = getDb();
  await kosongkan();
});

afterAll(async () => {
  await tutupDb();
});

describe("daftarPengguna — role default dan constraint", () => {
  it("menciptakan learner dan menulis password sebagai hash, bukan plaintext", async () => {
    const hasil = await daftarPengguna({
      nama: "Rina Wati",
      username: "rinawati",
      email: "rina@contoh.test",
      password: "rahasia-panjang",
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    expect(hasil.principal.roles).toEqual(["user"]);
    expect(hasil.principal.role).toBe("user");
    expect(hasil.principal.email).toBe("rina@contoh.test");
    expect(hasil.principal.username).toBe("rinawati");
    expect(hasil.principal.userId).toBeTruthy();

    const [kredensial] = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, hasil.principal.userId));

    expect(kredensial?.passwordHash).toBeTruthy();
    expect(kredensial?.passwordHash).not.toContain("rahasia-panjang");
    expect(await verifyPassword(kredensial!.passwordHash, "rahasia-panjang")).toBe(true);
    expect(await verifyPassword(kredensial!.passwordHash, "password-salah")).toBe(false);

    const events = await db.select().from(auditEvents);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorUserId: hasil.principal.userId,
      action: "user.registered",
      entityType: "user",
      entityId: hasil.principal.userId,
      payloadRedacted: {},
    });
    expect(events[0]?.requestId).toBeNull();
    expect(JSON.stringify(events[0]?.payloadRedacted)).not.toContain("rina@contoh.test");
    expect(JSON.stringify(events[0]?.payloadRedacted)).not.toContain(kredensial!.passwordHash);
    expect(await db.select().from(outboxEvents)).toHaveLength(0);
  });

  it("menormalkan email/username case-insensitively", async () => {
    const hasil = await daftarPengguna({
      nama: "Budi",
      username: "BudI",
      email: "Budi@Contoh.Test",
      password: "rahasia-panjang",
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.principal.email).toBe("budi@contoh.test");
    expect(hasil.principal.username).toBe("budi");
  });

  it("menolak email duplikat dan username duplikat dengan alasan yang tepat", async () => {
    await daftarPengguna({
      nama: "A",
      username: "pemakai",
      email: "a@contoh.test",
      password: "rahasia-panjang",
    });

    const emailDipakai = await daftarPengguna({
      nama: "B",
      username: "pemakai2",
      email: "A@contoh.test",
      password: "rahasia-panjang",
    });
    expect(emailDipakai).toEqual({ ok: false, alasan: "email_dipakai" });

    const usernameDipakai = await daftarPengguna({
      nama: "C",
      username: "PEMAKAI",
      email: "c@contoh.test",
      password: "rahasia-panjang",
    });
    expect(usernameDipakai).toEqual({ ok: false, alasan: "username_dipakai" });
  });
});

describe("daftarPengguna — concurrent signup", () => {
  it("dua pendaftaran paralel dengan email sama menghasilkan tepat satu akun", async () => {
    const hasil = await Promise.all([
      daftarPengguna({
        nama: "Orang Satu",
        username: "orang_satu",
        email: "duplikat@contoh.test",
        password: "rahasia-panjang",
      }),
      daftarPengguna({
        nama: "Orang Dua",
        username: "orang_dua",
        email: "duplikat@contoh.test",
        password: "rahasia-panjang",
      }),
    ]);

    const sukses = hasil.filter((h) => h.ok);
    const gagal = hasil.filter((h) => !h.ok);

    // Tepat satu yang menang; yang lain menerima alasan unik, bukan galat mentah.
    expect(sukses).toHaveLength(1);
    expect(gagal).toHaveLength(1);
    if (gagal[0] && !gagal[0].ok) {
      expect(gagal[0].alasan).toBe("email_dipakai");
    }

    const [baris] = await db
      .select()
      .from(users)
      .where(eq(users.emailNormalized, "duplikat@contoh.test"));
    expect(baris).toBeTruthy();
    const events = await db.select().from(auditEvents);
    expect(events).toHaveLength(1);
    expect(events[0]?.entityId).toBe(baris.id);
    expect(await db.select().from(outboxEvents)).toHaveLength(0);
  });
});

describe("masukPengguna — login dan sesi", () => {
  async function buatAkun(email: string, username: string) {
    const hasil = await daftarPengguna({
      nama: "Test User",
      username,
      email,
      password: "rahasia-panjang",
    });
    if (!hasil.ok) throw new Error("gagal buat akun");
    return hasil.principal;
  }

  it("login dengan password benar menghasilkan token yang memuat principal dari database", async () => {
    const principal = await buatAkun("login@contoh.test", "login");
    const masuk = await masukPengguna({ email: "login@contoh.test", password: "rahasia-panjang" });

    expect(masuk.hasil.ok).toBe(true);
    expect(masuk.token).toBeTruthy();

    const dariToken = await principalDariToken(masuk.token!);
    expect(dariToken?.userId).toBe(principal.userId);
    expect(dariToken?.email).toBe("login@contoh.test");
    expect(dariToken?.roles).toEqual(["user"]);
  });

  it("login dengan password salah ditolak dan tidak menerbitkan token", async () => {
    await buatAkun("salah@contoh.test", "salah");
    const masuk = await masukPengguna({ email: "salah@contoh.test", password: "password-salah" });

    expect(masuk.hasil.ok).toBe(false);
    expect(masuk.token).toBeUndefined();
  });
});

describe("sessions — revoke per-device dan reset global", () => {
  async function buatAkunDenganDuaSesi() {
    const principal = await (async () => {
      const h = await daftarPengguna({
        nama: "Dua Perangkat",
        username: "dua_perangkat",
        email: "dua@contoh.test",
        password: "rahasia-panjang",
      });
      if (!h.ok) throw new Error("gagal buat akun");
      return h.principal;
    })();

    const batas = new Date(Date.now() + 60_000);
    const sesi1 = await buatSession(db, { userId: principal.userId, expiresAt: batas });
    const sesi2 = await buatSession(db, { userId: principal.userId, expiresAt: batas });
    return { principal, token1: sesi1.token, token2: sesi2.token };
  }

  it("mencabut satu sesi tidak menendang perangkat lain", async () => {
    const { token1, token2 } = await buatAkunDenganDuaSesi();

    expect(await principalDariToken(token1)).not.toBeNull();
    expect(await principalDariToken(token2)).not.toBeNull();

    // Revoke perangkat pertama (logout di perangkat itu).
    await keluarSession(token1);

    expect(await principalDariToken(token1)).toBeNull();
    // Perangkat lain tetap masuk.
    expect(await principalDariToken(token2)).not.toBeNull();
  });

  it("reset global mencabut semua sesi user", async () => {
    const { principal, token1, token2 } = await buatAkunDenganDuaSesi();

    const jumlah = await cabutSemuaSession(db, principal.userId);
    expect(jumlah).toBe(2);

    expect(await principalDariToken(token1)).toBeNull();
    expect(await principalDariToken(token2)).toBeNull();
  });

  it("sesi kedaluwarsa tidak lolos principalDariToken", async () => {
    const h = await daftarPengguna({
      nama: "Kedaluwarsa",
      username: "kedaluwarsa",
      email: "expired@contoh.test",
      password: "rahasia-panjang",
    });
    if (!h.ok) throw new Error("gagal buat akun");

    const sesi = await buatSession(db, {
      userId: h.principal.userId,
      expiresAt: new Date(Date.now() - 1000), // sudah lewat
    });

    expect(await principalDariToken(sesi.token)).toBeNull();
  });

  it("token tidak dikenal menghasilkan null", async () => {
    expect(await principalDariToken("token-yang-tidak-ada")).toBeNull();
    // Hash token tersebut juga tidak boleh ada di tabel.
    const [baris] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken("token-yang-tidak-ada")));
    expect(baris).toBeUndefined();
  });
});
