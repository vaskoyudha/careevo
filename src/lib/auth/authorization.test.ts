/**
 * Test policy otorisasi terpusat.
 *
 * Yang diuji di sini adalah perilaku yang tidak bisa dibuktikan test integrasi
 * dengan mudah: gate membaca `roles` **principal database**, bukan claim role di
 * cookie. Kasus "role dicabut" dimodelkan sebagai principal yang masih memegang
 * claim `role: "admin"` tetapi `roles` (daftar aktif dari database) sudah kosong
 * — dan gate harus menolaknya. Itu properti keamanan inti Fase 1: pencabutan
 * role berlaku pada permintaan berikutnya, bukan menunggu cookie kedaluwarsa.
 *
 * `@/lib/auth/session` di-mock lewat factory, bukan `vi.spyOn`: berkas itu
 * sedang dimigrasikan ke session database, dan unit test policy tidak boleh ikut
 * gagal saat berkas tetangganya setengah jalan. Yang diuji adalah keputusan
 * gate, bukan cara `getSession()` mengambil datanya.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { sesiSekarang } = vi.hoisted(() => ({
  sesiSekarang: { nilai: null as unknown },
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => sesiSekarang.nilai,
}));

import {
  cekPemilik,
  cekPemilikEmail,
  gateAdmin,
  gateStaff,
  punyaRole,
  punyaRoleAdmin,
  punyaRoleStaff,
  sesiStafLegacy,
  wajibPemilik,
  wajibPemilikEmail,
  ROLE_STAFF,
} from "./authorization";
import type { SessionPrincipal } from "./principal";
import type { Role } from "./types";

function principal(ubah: Partial<SessionPrincipal> = {}): SessionPrincipal {
  return {
    userId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    roles: ["user"],
    role: "user",
    nama: "Budi",
    email: "budi@contoh.test",
    username: "budi",
    iat: 1_700_000_000_000,
    ...ubah,
  };
}

beforeEach(() => {
  sesiSekarang.nilai = null;
});

describe("gateStaff", () => {
  it("menolak bila belum ada sesi", async () => {
    sesiSekarang.nilai = null;
    expect(await gateStaff()).toBeNull();
  });

  it("menolak sesi cookie legacy yang tidak punya principal database", async () => {
    // Bentuk ini adalah hasil decode cookie lama: ada `role`, tidak ada
    // `userId`. Gate harus menolaknya — kalau tidak, sesi lama yang mengaku
    // admin tetap bisa menjalankan action baru.
    sesiSekarang.nilai = {
      email: "budi@contoh.test",
      nama: "Budi",
      username: "budi",
      role: "admin",
      iat: 1_700_000_000_000,
    };
    expect(await gateStaff()).toBeNull();
  });

  it("menolak learner yang tidak punya role staff", async () => {
    sesiSekarang.nilai = principal({ roles: ["user"], role: "user" });
    expect(await gateStaff()).toBeNull();
  });

  it("menerima verifikator dan admin", async () => {
    for (const role of ["verifikator", "admin"] as Role[]) {
      sesiSekarang.nilai = principal({ roles: [role], role });
      const hasil = await gateStaff();
      expect(hasil?.userId).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    }
  });

  it("menolak saat role staff SUDAH DICABUT meski claim cookie masih mengaku admin", async () => {
    // Inti perubahan Fase 1: `roles` adalah daftar role aktif dari database
    // (`revoked_at is null`). Setelah pencabutan, daftarnya kosong sementara
    // `role` (compatibility adapter) belum sempat berubah — gate harus menolak.
    sesiSekarang.nilai = principal({ roles: [], role: "admin" });
    expect(await gateStaff()).toBeNull();
  });

  it("menolak principal tanpa roles yang terisi", async () => {
    sesiSekarang.nilai = principal({ roles: undefined as unknown as Role[] });
    expect(await gateStaff()).toBeNull();
  });
});

describe("gateAdmin", () => {
  it("menerima admin", async () => {
    sesiSekarang.nilai = principal({ roles: ["admin"], role: "admin" });
    expect(await gateAdmin()).not.toBeNull();
  });

  it("menolak verifikator — tindakan administratif bukan hak verifikator", async () => {
    sesiSekarang.nilai = principal({ roles: ["verifikator"], role: "verifikator" });
    expect(await gateAdmin()).toBeNull();
  });

  it("menolak admin yang role-nya sudah dicabut", async () => {
    sesiSekarang.nilai = principal({ roles: ["verifikator"], role: "admin" });
    expect(await gateAdmin()).toBeNull();
  });

  it("menolak tanpa sesi dan tanpa principal database", async () => {
    expect(await gateAdmin()).toBeNull();

    sesiSekarang.nilai = {
      email: "budi@contoh.test",
      nama: "Budi",
      username: "budi",
      role: "admin",
      iat: 1_700_000_000_000,
    };
    expect(await gateAdmin()).toBeNull();
  });
});

describe("helper role", () => {
  it("ROLE_STAFF adalah verifikator dan admin", () => {
    expect([...ROLE_STAFF].sort()).toEqual(["admin", "verifikator"]);
  });

  it("punyaRoleStaff/punyaRoleAdmin/punyaRole sesuai isi daftar", () => {
    expect(punyaRoleStaff(["user", "verifikator"])).toBe(true);
    expect(punyaRoleStaff(["user"])).toBe(false);
    expect(punyaRoleAdmin(["verifikator"])).toBe(false);
    expect(punyaRole(["user", "admin"], "admin")).toBe(true);
    expect(punyaRole([], "admin")).toBe(false);
  });
});

describe("kepemilikan berbasis user_id", () => {
  it("menerima pemilik yang sama", () => {
    expect(cekPemilik(principal(), "3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });

  it("menolak id yang berbeda, kosong, dan principal tanpa userId", () => {
    expect(cekPemilik(principal(), "00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(cekPemilik(principal(), null)).toBe(false);
    expect(cekPemilik(principal(), "")).toBe(false);
    expect(cekPemilik(null, "3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(false);
    expect(cekPemilik({ userId: "" }, "3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(false);
  });

  it("wajibPemilik melempar untuk bukan pemilik dan diam untuk pemilik", () => {
    expect(() => wajibPemilik(principal(), "id-lain")).toThrow(/Akses ditolak/);
    expect(() => wajibPemilik(principal(), "3f2504e0-4f89-41d3-9a0c-0305e82c3301")).not.toThrow();
  });
});

describe("kepemilikan berbasis email (adapter cutover)", () => {
  it("membandingkan setelah normalisasi", () => {
    const p = principal({ email: "Budi@Contoh.test" });

    expect(cekPemilikEmail(p, "budi@contoh.test")).toBe(true);
    expect(cekPemilikEmail(p, "  BUDI@contoh.TEST  ")).toBe(true);
  });

  it("menolak email lain dan nilai kosong", () => {
    const p = principal({ email: "budi@contoh.test" });

    expect(cekPemilikEmail(p, "siti@contoh.test")).toBe(false);
    expect(cekPemilikEmail(p, null)).toBe(false);
    expect(cekPemilikEmail(p, "")).toBe(false);
    expect(cekPemilikEmail(null, "budi@contoh.test")).toBe(false);
  });

  it("wajibPemilikEmail melempar untuk bukan pemilik", () => {
    expect(() => wajibPemilikEmail(principal(), "siti@contoh.test")).toThrow(/Akses ditolak/);
    expect(() => wajibPemilikEmail(principal(), "budi@contoh.test")).not.toThrow();
  });
});

describe("sesiStafLegacy", () => {
  it("hanya menerima staf dari claim cookie legacy", () => {
    const sesi = (role: Role) => ({
      email: "x@contoh.test",
      nama: "X",
      username: "x",
      role,
      iat: 1,
    });

    expect(sesiStafLegacy(sesi("verifikator"))?.role).toBe("verifikator");
    expect(sesiStafLegacy(sesi("admin"))?.role).toBe("admin");
    expect(sesiStafLegacy(sesi("user"))).toBeNull();
    expect(sesiStafLegacy(null)).toBeNull();
  });
});
