/**
 * Test integrasi staff invitation — **butuh PostgreSQL** (`npm run test:db`).
 *
 * Yang dibuktikan di sini adalah janji yang hanya bisa dipegang database, bukan
 * kode di memori:
 *
 * 1. **Redeem satu kali.** `consumed_at` dikunci (`for update`) dan ditulis di
 *    transaksi yang sama dengan grant, sehingga redeem kedua ditolak.
 * 2. **Token asli tidak tersimpan.** Yang ada di `staff_invitations` hanya
 *    sha256-nya; test ini memastikan token yang dikembalikan cocok dengan hash
 *    itu dan tidak muncul di baris audit mana pun.
 * 3. **Setiap perubahan ber-audit.** create/redeem/revoke/grant/revoke-role
 *    masing-masing meninggalkan satu baris `audit_events`.
 * 4. **Grant ulang = UPDATE**, dan `revoked_at` terisi tanpa menghapus baris.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { auditEvents, staffInvitations, userRoles, users } from "@/lib/db/schema";
import {
  AKSI_AUDIT,
  beriRole,
  buatUndanganStaff,
  cabutRole,
  cabutUndangan,
  evaluasiUndangan,
  hashTokenUndangan,
  redeemUndangan,
} from "@/lib/auth/invitation";

let db: KoneksiDb = getDb();

async function kosongkan() {
  await db.execute(
    sql`truncate table
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

async function buatUser(suffix: string) {
  const [row] = await db
    .insert(users)
    .values({
      emailNormalized: `orang${suffix}@contoh.test`,
      usernameNormalized: `orang${suffix}`,
      displayName: `Orang ${suffix}`,
    })
    .returning();
  return row;
}

async function auditDengan(action: string) {
  return db.select().from(auditEvents).where(eq(auditEvents.action, action));
}

beforeEach(async () => {
  db = getDb();
  await kosongkan();
});

afterAll(async () => {
  await tutupDb();
});

describe("buatUndanganStaff", () => {
  it("mengembalikan token asli sekali dan menyimpan hash-nya saja", async () => {
    const admin = await buatUser("adm");

    const hasil = await buatUndanganStaff({
      emailNormalized: "Calon@Contoh.test",
      role: "verifikator",
      invitedByUserId: admin.id,
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    // Token asli hanya ada di nilai balik.
    expect(hasil.token.length).toBeGreaterThanOrEqual(32);
    expect(hasil.undangan.tokenHash).toBe(hashTokenUndangan(hasil.token));
    expect(JSON.stringify(hasil.undangan)).not.toContain(hasil.token);

    // Email dinormalisasi di service, bukan hanya oleh pemanggil.
    expect(hasil.undangan.emailNormalized).toBe("calon@contoh.test");
    expect(hasil.undangan.role).toBe("verifikator");
    expect(hasil.undangan.consumedAt).toBeNull();
    expect(hasil.undangan.revokedAt).toBeNull();
  });

  it("menulis audit create tanpa token/secret dan dengan email tersamarkan", async () => {
    const admin = await buatUser("adm2");

    const hasil = await buatUndanganStaff({
      emailNormalized: "calon2@contoh.test",
      role: "admin",
      invitedByUserId: admin.id,
    });
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    const audit = await auditDengan(AKSI_AUDIT.undanganDibuat);
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actorUserId).toBe(admin.id);
    expect(audit[0]?.entityType).toBe("staff_invitation");
    expect(audit[0]?.entityId).toBe(hasil.undangan.id);

    const payload = audit[0]?.payloadRedacted as Record<string, unknown>;
    expect(payload.role).toBe("admin");
    expect(payload.email).toBe("c***@contoh.test");

    // Baris audit tidak boleh memuat token — baik nilai asli maupun hash-nya.
    const teks = JSON.stringify(audit);
    expect(teks).not.toContain(hasil.token);
    expect(teks).not.toContain(hasil.undangan.tokenHash);
  });

  it("menolak role di luar ROLE_UNDANGAN_STAFF dan email tak berbentuk", async () => {
    const admin = await buatUser("adm3");

    const roleSalah = await buatUndanganStaff({
      // Sengaja melanggar tipe: nilai ini bisa datang dari body yang dimodifikasi.
      role: "user" as unknown as "verifikator",
      emailNormalized: "calon3@contoh.test",
      invitedByUserId: admin.id,
    });
    expect(roleSalah.ok).toBe(false);
    if (!roleSalah.ok) expect(roleSalah.alasan).toBe("role_tidak_valid");

    const emailSalah = await buatUndanganStaff({
      role: "verifikator",
      emailNormalized: "bukan-email",
      invitedByUserId: admin.id,
    });
    expect(emailSalah.ok).toBe(false);
    if (!emailSalah.ok) expect(emailSalah.alasan).toBe("email_tidak_valid");

    // Tidak ada satu pun undangan yang tersimpan.
    expect(await db.select().from(staffInvitations)).toHaveLength(0);
  });
});

describe("redeemUndangan — sekali pakai", () => {
  it("memberi role, menandai consumed, dan menolak redeem kedua", async () => {
    const admin = await buatUser("adm4");
    const calon = await buatUser("calon4");
    // Email user harus cocok dengan email undangan agar lolos ikatan mailbox.
    await db
      .update(users)
      .set({ emailNormalized: "calon4@contoh.test" })
      .where(eq(users.id, calon.id));

    const dibuat = await buatUndanganStaff({
      emailNormalized: "calon4@contoh.test",
      role: "verifikator",
      invitedByUserId: admin.id,
    });
    expect(dibuat.ok).toBe(true);
    if (!dibuat.ok) return;

    const pertama = await redeemUndangan({ token: dibuat.token, userId: calon.id });
    expect(pertama.ok).toBe(true);
    if (!pertama.ok) return;
    expect(pertama.role).toBe("verifikator");
    expect(pertama.userId).toBe(calon.id);

    // Role aktif.
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, calon.id));
    expect(roles).toHaveLength(1);
    expect(roles[0]?.role).toBe("verifikator");
    expect(roles[0]?.revokedAt).toBeNull();
    expect(roles[0]?.grantedByUserId).toBe(admin.id);

    // consumed_at terisi.
    const undangan = await db
      .select()
      .from(staffInvitations)
      .where(eq(staffInvitations.id, dibuat.undangan.id));
    expect(undangan[0]?.consumedAt).not.toBeNull();

    // Redeem kedua DITOLAK.
    const kedua = await redeemUndangan({ token: dibuat.token, userId: calon.id });
    expect(kedua.ok).toBe(false);
    if (!kedua.ok) expect(kedua.alasan).toBe("sudah_dipakai");
  });

  it("hanya menulis satu audit redeem meski dipanggil dua kali", async () => {
    const admin = await buatUser("adm5");
    const calon = await buatUser("calon5");
    await db
      .update(users)
      .set({ emailNormalized: "calon5@contoh.test" })
      .where(eq(users.id, calon.id));

    const dibuat = await buatUndanganStaff({
      emailNormalized: "calon5@contoh.test",
      role: "admin",
      invitedByUserId: admin.id,
    });
    if (!dibuat.ok) throw new Error("undangan gagal dibuat");

    await redeemUndangan({ token: dibuat.token, userId: calon.id });
    await redeemUndangan({ token: dibuat.token, userId: calon.id });

    expect(await auditDengan(AKSI_AUDIT.undanganDiredeem)).toHaveLength(1);
  });

  it("menolak token yang tidak dikenal", async () => {
    const calon = await buatUser("calon6");

    const hasil = await redeemUndangan({ token: "token-yang-tidak-pernah-dibuat", userId: calon.id });
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("tidak_ditemukan");
  });

  it("menolak user yang emailnya tidak cocok dengan undangan", async () => {
    const admin = await buatUser("adm7");
    const lain = await buatUser("lain7"); // email orang lain7@contoh.test

    const dibuat = await buatUndanganStaff({
      emailNormalized: "target7@contoh.test",
      role: "admin",
      invitedByUserId: admin.id,
    });
    if (!dibuat.ok) throw new Error("undangan gagal dibuat");

    // Pemegang token yang bukan pemilik mailbox tidak bisa memakainya.
    const hasil = await redeemUndangan({ token: dibuat.token, userId: lain.id });
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("email_tidak_cocok");

    // Undangan tetap bisa dipakai oleh pemiliknya; penolakan tidak mengonsumsi.
    const undangan = await db
      .select()
      .from(staffInvitations)
      .where(eq(staffInvitations.id, dibuat.undangan.id));
    expect(undangan[0]?.consumedAt).toBeNull();
    expect(await db.select().from(userRoles)).toHaveLength(0);
  });

  it("menolak undangan kedaluwarsa", async () => {
    const admin = await buatUser("adm8");
    const calon = await buatUser("calon8");

    const dibuat = await buatUndanganStaff({
      emailNormalized: "calon8@contoh.test",
      role: "verifikator",
      invitedByUserId: admin.id,
      // Sudah lewat sejak detik pertama.
      masaBerlakuMs: -1000,
    });
    if (!dibuat.ok) throw new Error("undangan gagal dibuat");

    const hasil = await redeemUndangan({ token: dibuat.token, userId: calon.id });
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("kedaluwarsa");
    expect(await db.select().from(userRoles)).toHaveLength(0);
  });

  it("menolak undangan yang sudah dicabut", async () => {
    const admin = await buatUser("adm9");
    const calon = await buatUser("calon9");

    const dibuat = await buatUndanganStaff({
      emailNormalized: "calon9@contoh.test",
      role: "admin",
      invitedByUserId: admin.id,
    });
    if (!dibuat.ok) throw new Error("undangan gagal dibuat");

    const cabut = await cabutUndangan({
      invitationId: dibuat.undangan.id,
      revokedByUserId: admin.id,
    });
    expect(cabut.ok).toBe(true);

    const hasil = await redeemUndangan({ token: dibuat.token, userId: calon.id });
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toBe("dicabut");

    // Audit revoke tertulis, dan email di dalamnya tersamarkan.
    const audit = await auditDengan(AKSI_AUDIT.undanganDicabut);
    expect(audit).toHaveLength(1);
    expect(audit[0]?.entityId).toBe(dibuat.undangan.id);
    expect((audit[0]?.payloadRedacted as Record<string, unknown>).email).toBe("c***@contoh.test");
  });
});

describe("cabutUndangan — hanya untuk yang belum dipakai", () => {
  it("menolak mencabut undangan yang sudah di-redeem", async () => {
    const admin = await buatUser("adm10");
    const calon = await buatUser("calon10");
    await db
      .update(users)
      .set({ emailNormalized: "calon10@contoh.test" })
      .where(eq(users.id, calon.id));

    const dibuat = await buatUndanganStaff({
      emailNormalized: "calon10@contoh.test",
      role: "verifikator",
      invitedByUserId: admin.id,
    });
    if (!dibuat.ok) throw new Error("undangan gagal dibuat");
    await redeemUndangan({ token: dibuat.token, userId: calon.id });

    const cabut = await cabutUndangan({
      invitationId: dibuat.undangan.id,
      revokedByUserId: admin.id,
    });

    // Role yang sudah diberikan harus dicabut lewat `cabutRole`, bukan dengan
    // mengubah riwayat undangan.
    expect(cabut.ok).toBe(false);
    if (!cabut.ok) expect(cabut.alasan).toBe("sudah_dipakai");
  });

  it("menolak mencabut dua kali dan id yang tidak ada", async () => {
    const admin = await buatUser("adm11");
    const dibuat = await buatUndanganStaff({
      emailNormalized: "calon11@contoh.test",
      role: "admin",
      invitedByUserId: admin.id,
    });
    if (!dibuat.ok) throw new Error("undangan gagal dibuat");

    await cabutUndangan({ invitationId: dibuat.undangan.id, revokedByUserId: admin.id });

    const kedua = await cabutUndangan({
      invitationId: dibuat.undangan.id,
      revokedByUserId: admin.id,
    });
    expect(kedua.ok).toBe(false);
    if (!kedua.ok) expect(kedua.alasan).toBe("sudah_dicabut");

    const asing = await cabutUndangan({
      invitationId: "00000000-0000-0000-0000-000000000000",
      revokedByUserId: admin.id,
    });
    expect(asing.ok).toBe(false);
    if (!asing.ok) expect(asing.alasan).toBe("tidak_ditemukan");
  });
});

describe("redeem ulang role lewat undangan kedua", () => {
  it("mengaktifkan kembali role yang pernah dicabut memakai UPDATE", async () => {
    const admin = await buatUser("adm12");
    const calon = await buatUser("calon12");
    await db
      .update(users)
      .set({ emailNormalized: "calon12@contoh.test" })
      .where(eq(users.id, calon.id));

    const undangan1 = await buatUndanganStaff({
      emailNormalized: "calon12@contoh.test",
      role: "verifikator",
      invitedByUserId: admin.id,
    });
    if (!undangan1.ok) throw new Error("undangan 1 gagal");
    await redeemUndangan({ token: undangan1.token, userId: calon.id });
    await cabutRole({ userId: calon.id, role: "verifikator", revokedByUserId: admin.id });

    const undangan2 = await buatUndanganStaff({
      emailNormalized: "calon12@contoh.test",
      role: "verifikator",
      invitedByUserId: admin.id,
    });
    if (!undangan2.ok) throw new Error("undangan 2 gagal");
    const hasil = await redeemUndangan({ token: undangan2.token, userId: calon.id });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.diaktifkanKembali).toBe(true);

    // Tetap satu baris — PK komposit `(user_id, role)` tidak dilanggar.
    const baris = await db.select().from(userRoles).where(eq(userRoles.userId, calon.id));
    expect(baris).toHaveLength(1);
    expect(baris[0]?.revokedAt).toBeNull();
  });
});

describe("audit grant/revoke role", () => {
  it("menulis satu baris untuk grant dan satu untuk revoke", async () => {
    const admin = await buatUser("adm13");
    const target = await buatUser("target13");

    await beriRole({ userId: target.id, role: "admin", grantedByUserId: admin.id });
    await cabutRole({ userId: target.id, role: "admin", revokedByUserId: admin.id });

    const granted = await auditDengan(AKSI_AUDIT.roleDiberikan);
    const revoked = await auditDengan(AKSI_AUDIT.roleDicabut);

    expect(granted).toHaveLength(1);
    expect(revoked).toHaveLength(1);
    expect(granted[0]?.entityId).toBe(`${target.id}:admin`);
    expect(granted[0]?.actorUserId).toBe(admin.id);
    expect(revoked[0]?.actorUserId).toBe(admin.id);
  });
});

describe("evaluasiUndangan (murni)", () => {
  it("menilai aktif/dipakai/dicabut/kedaluwarsa dengan prioritas yang tetap", () => {
    const sekarang = new Date("2026-09-25T00:00:00Z");
    const besok = new Date("2026-09-26T00:00:00Z");
    const kemarin = new Date("2026-09-24T00:00:00Z");

    expect(
      evaluasiUndangan({ consumedAt: null, revokedAt: null, expiresAt: besok }, sekarang).status,
    ).toBe("aktif");
    expect(
      evaluasiUndangan({ consumedAt: sekarang, revokedAt: null, expiresAt: besok }, sekarang).status,
    ).toBe("dipakai");
    expect(
      evaluasiUndangan({ consumedAt: null, revokedAt: null, expiresAt: kemarin }, sekarang).status,
    ).toBe("kedaluwarsa");
    // Dicabut menang atas dipakai: keputusan administratif terakhir.
    expect(
      evaluasiUndangan({ consumedAt: sekarang, revokedAt: sekarang, expiresAt: besok }, sekarang)
        .status,
    ).toBe("dicabut");
  });
});
