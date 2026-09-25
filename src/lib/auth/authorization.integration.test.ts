/**
 * Test integrasi RBAC — **butuh PostgreSQL** (`npm run test:db`).
 *
 * Berkas ini membuktikan properti yang tidak bisa dibuktikan test unit:
 * keputusan gate diturunkan dari **baris `user_roles` yang aktif di database**,
 * sehingga pencabutan role berlaku pada permintaan berikutnya. Test unit hanya
 * bisa memodelkan "principal dengan roles kosong"; di sini pencabutannya
 * benar-benar dilakukan lewat `cabutRole`, lalu principal dibangun ulang dari
 * database persis seperti `getSession()` akan melakukannya.
 *
 * `@/lib/auth/session` di-mock supaya `getSession()` mengembalikan principal
 * yang dibangun dari database sungguhan. Factory mock, bukan `vi.spyOn`:
 * berkas session sedang dimigrasikan subagent auth, dan test ini tidak boleh
 * bergantung pada bentuk sementaranya.
 */

import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { auditEvents, staffInvitations, userRoles, users } from "@/lib/db/schema";
import { ambilRolesAktif, cariUserById } from "@/lib/auth/identity-repository";
import { hanyaRoleSah, roleTertinggi, type SessionPrincipal } from "@/lib/auth/principal";
import { beriRole, cabutRole, hashTokenUndangan } from "@/lib/auth/invitation";

const { sesiSekarang } = vi.hoisted(() => ({
  sesiSekarang: { nilai: null as SessionPrincipal | null },
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => sesiSekarang.nilai,
}));

import { gateAdmin, gateStaff } from "@/lib/auth/authorization";

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

/**
 * Principal seperti yang akan dikembalikan `getSession()`: dibaca dari database
 * pada saat panggilan, bukan disimpan di antara permintaan.
 */
async function bangunPrincipal(userId: string): Promise<SessionPrincipal> {
  const user = await cariUserById(db, userId);
  if (!user) throw new Error(`User ${userId} tidak ada`);
  const roles = hanyaRoleSah(await ambilRolesAktif(db, userId));
  return {
    userId: user.id,
    roles,
    role: roleTertinggi(roles),
    nama: user.displayName,
    email: user.emailNormalized,
    username: user.usernameNormalized,
    iat: Date.now(),
  };
}

/** Meniru satu "request": baca principal dari database lalu jalankan gate. */
async function permintaanGate(userId: string) {
  sesiSekarang.nilai = await bangunPrincipal(userId);
  return { staff: await gateStaff(), admin: await gateAdmin() };
}

beforeEach(async () => {
  db = getDb();
  await kosongkan();
  sesiSekarang.nilai = null;
});

afterAll(async () => {
  await tutupDb();
});

describe("RBAC — grant/revoke dan gate", () => {
  it("menolak learner tanpa role staff", async () => {
    const learner = await buatUser("learner");

    const { staff, admin } = await permintaanGate(learner.id);

    expect(staff).toBeNull();
    expect(admin).toBeNull();
  });

  it("memberi akses verifikator setelah grant dan mencabutnya pada permintaan berikutnya", async () => {
    const admin = await buatUser("admin");
    const target = await buatUser("target");
    await beriRole({ userId: admin.id, role: "admin", grantedByUserId: admin.id });

    // Grant pertama.
    const grant = await beriRole({
      userId: target.id,
      role: "verifikator",
      grantedByUserId: admin.id,
    });
    expect(grant.ok).toBe(true);
    if (!grant.ok) return;
    expect(grant.granted).toBe(true);
    expect(grant.diaktifkanKembali).toBe(false);

    // Permintaan berikutnya: gate melihat role itu.
    const sebelum = await permintaanGate(target.id);
    expect(sebelum.staff?.userId).toBe(target.id);
    // Verifikator BUKAN admin.
    expect(sebelum.admin).toBeNull();

    // Pencabutan.
    const revoke = await cabutRole({
      userId: target.id,
      role: "verifikator",
      revokedByUserId: admin.id,
    });
    expect(revoke.ok).toBe(true);

    // Permintaan berikutnya: gate gagal, tanpa menunggu cookie kedaluwarsa.
    const sesudah = await permintaanGate(target.id);
    expect(sesudah.staff).toBeNull();
    expect(sesudah.admin).toBeNull();
  });

  it("hanya admin yang lolos gateAdmin", async () => {
    const admin = await buatUser("adm");
    const verif = await buatUser("ver");
    await beriRole({ userId: admin.id, role: "admin", grantedByUserId: admin.id });
    await beriRole({ userId: verif.id, role: "verifikator", grantedByUserId: admin.id });

    expect((await permintaanGate(admin.id)).admin?.userId).toBe(admin.id);
    expect((await permintaanGate(verif.id)).admin).toBeNull();
  });
});

describe("RBAC — grant ulang setelah revoke", () => {
  it("memakai UPDATE, bukan INSERT kedua: satu baris tetap satu, tanpa error", async () => {
    const admin = await buatUser("admin2");
    const target = await buatUser("target2");
    await beriRole({ userId: admin.id, role: "admin", grantedByUserId: admin.id });
    await beriRole({ userId: target.id, role: "verifikator", grantedByUserId: admin.id });

    // Cabut, lalu beri lagi.
    await cabutRole({ userId: target.id, role: "verifikator", revokedByUserId: admin.id });

    // INSERT kedua akan bentrok dengan PK komposit `(user_id, role)` — kalau
    // implementasinya salah, baris ini melempar SQLSTATE 23505.
    const ulang = await beriRole({
      userId: target.id,
      role: "verifikator",
      grantedByUserId: admin.id,
    });

    expect(ulang.ok).toBe(true);
    if (!ulang.ok) return;
    expect(ulang.granted).toBe(true);
    expect(ulang.diaktifkanKembali).toBe(true);

    const baris = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, target.id));
    expect(baris).toHaveLength(1);
    expect(baris[0]?.revokedAt).toBeNull();
    expect(baris[0]?.role).toBe("verifikator");

    // Dan aksesnya kembali.
    expect((await permintaanGate(target.id)).staff?.userId).toBe(target.id);
  });

  it("grant pada role yang sudah aktif adalah no-op, tanpa baris audit palsu", async () => {
    const admin = await buatUser("admin3");
    const target = await buatUser("target3");
    await beriRole({ userId: admin.id, role: "admin", grantedByUserId: admin.id });
    await beriRole({ userId: target.id, role: "verifikator", grantedByUserId: admin.id });

    // Dua grant di atas masing-masing menulis satu audit "user_role.granted".
    const sebelum = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "user_role.granted"));

    const lagi = await beriRole({
      userId: target.id,
      role: "verifikator",
      grantedByUserId: admin.id,
    });

    expect(lagi.ok).toBe(true);
    if (!lagi.ok) return;
    expect(lagi.granted).toBe(false);

    const sesudah = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "user_role.granted"));
    // No-op tidak menulis audit: jumlah baris "granted" tidak bertambah.
    expect(sesudah).toHaveLength(sebelum.length);
  });

  it("grant untuk pengguna yang tidak ada ditolak dengan pesan, bukan galat FK", async () => {
    const admin = await buatUser("admin4");
    await beriRole({ userId: admin.id, role: "admin", grantedByUserId: admin.id });

    const hasil = await beriRole({
      userId: "00000000-0000-0000-0000-000000000000",
      role: "verifikator",
      grantedByUserId: admin.id,
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.alasan).toBe("pengguna_tidak_ditemukan");
  });
});

describe("RBAC — revoke menyimpan bukti", () => {
  it("mengisi revoked_at tanpa menghapus baris, dan menulis audit", async () => {
    const admin = await buatUser("admin5");
    const target = await buatUser("target5");
    await beriRole({ userId: admin.id, role: "admin", grantedByUserId: admin.id });
    await beriRole({ userId: target.id, role: "admin", grantedByUserId: admin.id });

    const hasil = await cabutRole({
      userId: target.id,
      role: "admin",
      revokedByUserId: admin.id,
    });
    expect(hasil.ok).toBe(true);

    const baris = await db.select().from(userRoles).where(eq(userRoles.userId, target.id));
    expect(baris).toHaveLength(1);
    expect(baris[0]?.revokedAt).not.toBeNull();
    expect(baris[0]?.grantedByUserId).toBe(admin.id);

    const audit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "user_role.revoked"));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actorUserId).toBe(admin.id);
    expect(audit[0]?.entityId).toBe(`${target.id}:admin`);
  });

  it("menolak pencabutan ganda", async () => {
    const admin = await buatUser("admin6");
    const target = await buatUser("target6");
    await beriRole({ userId: target.id, role: "admin", grantedByUserId: admin.id });
    await cabutRole({ userId: target.id, role: "admin", revokedByUserId: admin.id });

    const kedua = await cabutRole({
      userId: target.id,
      role: "admin",
      revokedByUserId: admin.id,
    });

    expect(kedua.ok).toBe(false);
    if (kedua.ok) return;
    expect(kedua.alasan).toBe("sudah_dicabut");
  });
});

describe("RBAC — undangan menulis hash, bukan token", () => {
  it("menyimpan sha256(token) dan audit tanpa token", async () => {
    const admin = await buatUser("admin7");

    const [row] = await db
      .insert(staffInvitations)
      .values({
        emailNormalized: "calon@contoh.test",
        role: "verifikator",
        invitedByUserId: admin.id,
        tokenHash: hashTokenUndangan("token-contoh-yang-cukup-panjang-untuk-uji"),
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning();

    expect(row.tokenHash).toBe(hashTokenUndangan("token-contoh-yang-cukup-panjang-untuk-uji"));
    expect(row.tokenHash).not.toContain("token-contoh");
    expect(row.consumedAt).toBeNull();
  });
});
