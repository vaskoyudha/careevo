/**
 * Test integrasi utang review Fase 1 §6 — **butuh PostgreSQL** (`npm run test:db`).
 *
 * Berkas ini membuktikan properti yang tidak bisa dibuktikan test unit:
 *
 * 1. **Rotasi sesi saat login benar-benar mematikan token lama.** Token perangkat
 *    lama harus ditolak `principalDariToken` setelah login berikutnya menandai
 *    `rotated_at`-nya — kalau tidak, rotasi tidak menambah keamanan apa pun.
 * 2. **Rotasi tidak lintas pengguna.** Login yang sah tidak boleh menandai sesi
 *    milik user lain sebagai "diganti", sekalipun id-nya dipalsukan pemanggil.
 * 3. **Rotasi best-effort.** Cookie lama yang sudah mati/tidak ada tidak
 *    menghalangi login yang sah.
 * 4. **Bootstrap admin** memberi role pertama ke user yang sudah ada, ber-audit,
 *    dalam satu transaksi, idempoten, dan menolak target yang tidak memenuhi
 *    syarat.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { auditEvents, sessions, userRoles, users } from "@/lib/db/schema";
import { daftarPengguna, masukPengguna, principalDariToken, sesiAktifDariToken } from "@/lib/auth/auth-service";
import { revokeSession as cabutSesiById } from "@/lib/auth/session-repository";
import { ambilRolesAktif } from "@/lib/auth/identity-repository";
import {
  AKSI_AUDIT_BOOTSTRAP,
  bootstrapRoleStaff,
  ROLE_BOOTSTRAP_DEFAULT,
} from "@/lib/auth/bootstrap";
import { AKSI_AUDIT } from "@/lib/auth/invitation";

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

const PASSWORD = "rahasia-panjang";

async function buatAkun(email: string, username: string) {
  const hasil = await daftarPengguna({ nama: email, username, email, password: PASSWORD });
  if (!hasil.ok) throw new Error(`gagal buat akun ${email}`);
  return hasil.principal;
}

/** Id sesi aktif dari sebuah token, seperti yang dibaca `loginAction`. */
async function idSesiAktif(token: string): Promise<string> {
  const sesi = await sesiAktifDariToken(token);
  if (!sesi) throw new Error("sesi aktif tidak ditemukan untuk token uji");
  return sesi.id;
}

describe("rotasi sesi saat login", () => {
  it("memindahkan sesi aktif lama ke rotated_at dan menerima token baru", async () => {
    await buatAkun("rotasi@contoh.test", "rotasi");

    const pertama = await masukPengguna({ email: "rotasi@contoh.test", password: PASSWORD });
    expect(pertama.hasil.ok).toBe(true);
    const tokenLama = pertama.token!;
    const idLama = await idSesiAktif(tokenLama);

    // Login berikutnya membawa id sesi lama yang sudah diverifikasi.
    const kedua = await masukPengguna({
      email: "rotasi@contoh.test",
      password: PASSWORD,
      sessionLamaId: idLama,
    });
    expect(kedua.hasil.ok).toBe(true);
    const tokenBaru = kedua.token!;

    // Inti utang #1: token lama tidak boleh lagi sah.
    expect(await principalDariToken(tokenLama)).toBeNull();
    expect(await principalDariToken(tokenBaru)).not.toBeNull();

    const [barisLama] = await db.select().from(sessions).where(eq(sessions.id, idLama));
    expect(barisLama?.rotatedAt).not.toBeNull();
    // Rotasi bukan pencabutan: `revoked_at` tetap kosong supaya audit membedakan
    // "diganti login" dari "sesi dihentikan".
    expect(barisLama?.revokedAt).toBeNull();
  });

  it("token baru selalu berbeda dari token lama", async () => {
    await buatAkun("bedatoken@contoh.test", "bedatoken");

    const pertama = await masukPengguna({ email: "bedatoken@contoh.test", password: PASSWORD });
    const idLama = await idSesiAktif(pertama.token!);
    const kedua = await masukPengguna({
      email: "bedatoken@contoh.test",
      password: PASSWORD,
      sessionLamaId: idLama,
    });

    expect(kedua.token).toBeTruthy();
    expect(kedua.token).not.toBe(pertama.token);
  });

  it("tidak menandai sesi milik user lain (rotasi tidak lintas pengguna)", async () => {
    const korban = await buatAkun("korban@contoh.test", "korban");
    const penyerang = await buatAkun("penyerang@contoh.test", "penyerang");

    const sesiKorban = await masukPengguna({ email: "korban@contoh.test", password: PASSWORD });
    const idKorban = await idSesiAktif(sesiKorban.token!);

    // Penyerang login dengan kredensialnya sendiri, tetapi mengirim id sesi
    // korban. Syarat `user_id` di `rotasiSession` harus menolaknya.
    const loginPenyerang = await masukPengguna({
      email: "penyerang@contoh.test",
      password: PASSWORD,
      sessionLamaId: idKorban,
    });
    expect(loginPenyerang.hasil.ok).toBe(true);

    // Sesi korban tidak tersentuh.
    expect(await principalDariToken(sesiKorban.token!)).not.toBeNull();
    const [barisKorban] = await db.select().from(sessions).where(eq(sessions.id, idKorban));
    expect(barisKorban?.rotatedAt).toBeNull();
    expect(barisKorban?.userId).toBe(korban.userId);

    // Dan login penyerang tetap menghasilkan sesi yang sah miliknya sendiri.
    const principalPenyerang = await principalDariToken(loginPenyerang.token!);
    expect(principalPenyerang?.userId).toBe(penyerang.userId);
  });

  it("login tetap berhasil saat id sesi lama tidak ada / sudah tidak aktif", async () => {
    await buatAkun("bestefort@contoh.test", "bestefort");

    // Id yang tidak pernah ada: rotasi best-effort, login tetap sah.
    const hasil = await masukPengguna({
      email: "bestefort@contoh.test",
      password: PASSWORD,
      sessionLamaId: "00000000-0000-0000-0000-000000000000",
    });

    expect(hasil.hasil.ok).toBe(true);
    expect(await principalDariToken(hasil.token!)).not.toBeNull();
  });

  it("menandai sesi lama sekali saja (rotasi idempoten)", async () => {
    await buatAkun("idemrotasi@contoh.test", "idemrotasi");

    const pertama = await masukPengguna({ email: "idemrotasi@contoh.test", password: PASSWORD });
    const idLama = await idSesiAktif(pertama.token!);

    const kedua = await masukPengguna({
      email: "idemrotasi@contoh.test",
      password: PASSWORD,
      sessionLamaId: idLama,
    });
    const waktuRotasiPertama = (
      await db.select().from(sessions).where(eq(sessions.id, idLama))
    )[0]?.rotatedAt;

    // Login lagi membawa id yang sudah dirotasi. `rotated_at is null` membuat
    // waktu rotasi asli tidak tertimpa.
    await masukPengguna({
      email: "idemrotasi@contoh.test",
      password: PASSWORD,
      sessionLamaId: idLama,
    });
    const waktuRotasiKedua = (
      await db.select().from(sessions).where(eq(sessions.id, idLama))
    )[0]?.rotatedAt;

    expect(waktuRotasiPertama?.getTime()).toBe(waktuRotasiKedua?.getTime());
    expect(kedua.hasil.ok).toBe(true);
  });

  it("sesi yang dicabut tidak ikut dirotasi dan tetap mati", async () => {
    await buatAkun("cabutrotasi@contoh.test", "cabutrotasi");

    const sesi = await masukPengguna({ email: "cabutrotasi@contoh.test", password: PASSWORD });
    const idLama = await idSesiAktif(sesi.token!);

    await cabutSesiById(db, idLama);

    const login = await masukPengguna({
      email: "cabutrotasi@contoh.test",
      password: PASSWORD,
      sessionLamaId: idLama,
    });
    expect(login.hasil.ok).toBe(true);

    const [baris] = await db.select().from(sessions).where(eq(sessions.id, idLama));
    // `revoked_at` tetap terisi; rotasi tidak "menghidupkan" kembali sesi yang
    // sudah dicabut (dan `rotated_at`-nya tidak diisi karena tokennya bukan
    // lagi sesi aktif).
    expect(baris?.revokedAt).not.toBeNull();
    expect(await principalDariToken(sesi.token!)).toBeNull();
  });

  it("sesi tanpa login sebelumnya (dua perangkat) tidak saling mematikan", async () => {
    await buatAkun("dua@contoh.test", "dua");

    // Dua login tanpa `sessionLamaId` — dua perangkat, dua sesi sah.
    const a = await masukPengguna({ email: "dua@contoh.test", password: PASSWORD });
    const b = await masukPengguna({ email: "dua@contoh.test", password: PASSWORD });

    expect(await principalDariToken(a.token!)).not.toBeNull();
    expect(await principalDariToken(b.token!)).not.toBeNull();
  });
});

describe("bootstrapRoleStaff — admin pertama lewat CLI", () => {
  it("memberi role kepada user existing dan menulis audit dalam transaksi yang sama", async () => {
    const principal = await buatAkun("calonadmin@contoh.test", "calonadmin");

    const hasil = await bootstrapRoleStaff({ email: "CalonAdmin@Contoh.Test" });
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    expect(hasil.granted).toBe(true);
    expect(hasil.userId).toBe(principal.userId);
    expect(hasil.role).toBe(ROLE_BOOTSTRAP_DEFAULT);
    // Email dinormalisasi lewat repository yang sama dengan login.
    expect(hasil.email).toBe("calonadmin@contoh.test");

    const baris = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, principal.userId), eq(userRoles.role, "admin")));
    expect(baris).toHaveLength(1);
    expect(baris[0]?.role).toBe("admin");
    expect(baris[0]?.revokedAt).toBeNull();
    // Tanpa aktor: belum ada admin yang bisa memberi.
    expect(baris[0]?.grantedByUserId).toBeNull();

    const audit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, AKSI_AUDIT_BOOTSTRAP));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actorUserId).toBeNull();
    expect(audit[0]?.entityId).toBe(`${principal.userId}:admin`);
    // Email disamarkan sebelum insert, bukan sesudah.
    const payload = audit[0]?.payloadRedacted as Record<string, unknown>;
    expect(payload.role).toBe("admin");
    expect(String(payload.email)).not.toBe("calonadmin@contoh.test");
    expect(String(payload.email)).toContain("***@contoh.test");
  });

  it("role yang diberikan langsung terbaca gate dari database", async () => {
    const principal = await buatAkun("gateadmin@contoh.test", "gateadmin");
    const hasil = await bootstrapRoleStaff({ email: "gateadmin@contoh.test" });
    expect(hasil.ok).toBe(true);

    const roles = await ambilRolesAktif(db, principal.userId);
    expect(roles).toContain("admin");
  });

  it("menolak user yang tidak ada tanpa menulis apa pun", async () => {
    const hasil = await bootstrapRoleStaff({ email: "tidak-ada@contoh.test" });

    expect(hasil).toEqual({
      ok: false,
      alasan: "user_tidak_ditemukan",
      pesan: expect.any(String),
    });
    expect(await db.select().from(auditEvents)).toHaveLength(0);
  });

  it("menolak user non-active", async () => {
    const principal = await buatAkun("suspended@contoh.test", "suspended");
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, principal.userId));

    const hasil = await bootstrapRoleStaff({ email: "suspended@contoh.test" });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.alasan).toBe("user_tidak_aktif");
    // Tidak ada role staff yang diberikan; baris `user` dari registrasi tetap ada.
    const staff = await db
      .select()
      .from(userRoles)
      .where(inArray(userRoles.role, ["admin", "verifikator"]));
    expect(staff).toHaveLength(0);
  });

  it("menolak role di luar daftar tertutup", async () => {
    await buatAkun("roleaneh@contoh.test", "roleaneh");

    // Panggilan tak bertipe (mis. skrip yang salah) tetap ditolak di runtime.
    const hasil = await bootstrapRoleStaff(
      { email: "roleaneh@contoh.test" },
      "superadmin" as unknown as typeof ROLE_BOOTSTRAP_DEFAULT,
    );

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.alasan).toBe("role_tidak_valid");
    const staff = await db
      .select()
      .from(userRoles)
      .where(inArray(userRoles.role, ["admin", "verifikator"]));
    expect(staff).toHaveLength(0);
  });

  it("idempoten: menjalankan ulang tidak menulis audit kedua", async () => {
    const principal = await buatAkun("idempoten@contoh.test", "idempoten");

    const pertama = await bootstrapRoleStaff({ email: "idempoten@contoh.test" });
    const kedua = await bootstrapRoleStaff({ email: "idempoten@contoh.test" });

    expect(pertama.ok && pertama.granted).toBe(true);
    expect(kedua.ok && kedua.granted).toBe(false);

    const audit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, AKSI_AUDIT_BOOTSTRAP));
    expect(audit).toHaveLength(1);
    expect(
      await db
        .select()
        .from(userRoles)
        .where(and(eq(userRoles.userId, principal.userId), eq(userRoles.role, "admin"))),
    ).toHaveLength(1);
  });

  it("menghidupkan kembali role yang pernah dicabut lewat UPDATE, bukan INSERT kedua", async () => {
    const principal = await buatAkun("hidupkan@contoh.test", "hidupkan");
    await bootstrapRoleStaff({ email: "hidupkan@contoh.test" });

    // Cabut langsung di database: yang diuji di sini adalah perilaku bootstrap
    // saat menemukan baris yang sudah dicabut, bukan jalur pencabutan admin.
    await db
      .update(userRoles)
      .set({ revokedAt: new Date() })
      .where(and(eq(userRoles.userId, principal.userId), eq(userRoles.role, "admin")));

    const ulang = await bootstrapRoleStaff({ email: "hidupkan@contoh.test" });
    expect(ulang.ok && ulang.granted).toBe(true);

    const baris = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, principal.userId), eq(userRoles.role, "admin")));
    // PK komposit `(user_id, role)`: satu baris, bukan dua.
    expect(baris).toHaveLength(1);
    expect(baris[0]?.revokedAt).toBeNull();
  });

  it("memakai aksi audit yang berbeda dari grant admin biasa", async () => {
    await buatAkun("bedaaudit@contoh.test", "bedaaudit");
    await bootstrapRoleStaff({ email: "bedaaudit@contoh.test" });

    expect(AKSI_AUDIT_BOOTSTRAP).not.toBe(AKSI_AUDIT.roleDiberikan);
    const bootstrap = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, AKSI_AUDIT_BOOTSTRAP));
    const biasa = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, AKSI_AUDIT.roleDiberikan));
    expect(bootstrap).toHaveLength(1);
    expect(biasa).toHaveLength(0);
  });

  it("menerima target --user-id tanpa email", async () => {
    const principal = await buatAkun("byid@contoh.test", "byid");

    const hasil = await bootstrapRoleStaff({ userId: principal.userId }, "verifikator");
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.role).toBe("verifikator");

    const baris = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, principal.userId), eq(userRoles.role, "verifikator")));
    expect(baris[0]?.role).toBe("verifikator");
  });

  it("gateAdmin bisa lulus setelah bootstrap (rantai utang #4)", async () => {
    // Rantai lengkap: user existing → bootstrap → principal dibangun dari
    // database → gate admin lulus. Inilah yang membuat `beriRoleAction` dan
    // `buatUndanganAction` reachable, yang sebelumnya tidak mungkin.
    const principal = await buatAkun("rantai@contoh.test", "rantai");
    await bootstrapRoleStaff({ email: "rantai@contoh.test" });

    const { hanyaRoleSah, roleTertinggi } = await import("@/lib/auth/principal");
    const { punyaRoleAdmin } = await import("@/lib/auth/authorization");
    const roles = hanyaRoleSah(await ambilRolesAktif(db, principal.userId));

    expect(punyaRoleAdmin(roles)).toBe(true);
    expect(roleTertinggi(roles)).toBe("admin");
  });
});
