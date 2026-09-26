/**
 * Test penyaringan payload audit.
 *
 * `audit_events` append-only: satu baris yang memuat token tidak bisa dihapus.
 * Karena itu test di sini menyerang dari sisi "apa yang lolos", bukan dari sisi
 * bentuk fungsi: token, secret, password, cookie, dan email mentah harus tidak
 * pernah muncul di hasil.
 */

import { describe, expect, it } from "vitest";

import { KUNCI_TERLARANG, samarkanEmail, saringPayloadAudit } from "./audit";

describe("saringPayloadAudit — kunci terlarang", () => {
  it("membuang kunci yang namanya memuat token/secret/password", () => {
    const hasil = saringPayloadAudit({
      token: "rahasia-sekali",
      token_hash: "abc123",
      accessToken: "xyz",
      client_secret: "s",
      password: "p",
      passwordHash: "$argon2id$...",
      cookie: "ls_session=...",
      authorization: "Bearer abc",
      action: "staff_invitation.created",
    });

    // Kunci terlarang dibuang sepenuhnya — bukan dikosongkan.
    for (const kunci of [
      "token",
      "token_hash",
      "accessToken",
      "client_secret",
      "password",
      "passwordHash",
      "cookie",
      "authorization",
    ]) {
      expect(hasil).not.toHaveProperty(kunci);
    }
    expect(hasil.action).toBe("staff_invitation.created");
  });

  it("daftar kunci terlarang tidak pernah kosong dan memuat token", () => {
    expect(KUNCI_TERLARANG.length).toBeGreaterThan(0);
    expect(KUNCI_TERLARANG).toContain("token");
  });

  it("menyaring kunci bersarang, bukan hanya level atas", () => {
    const hasil = saringPayloadAudit({
      meta: { token_hash: "abc", role: "admin" },
      daftar: [{ secret: "s", role: "verifikator" }],
    });

    expect(hasil).toEqual({
      meta: { role: "admin" },
      daftar: [{ role: "verifikator" }],
    });
  });
});

describe("saringPayloadAudit — PII dan nilai", () => {
  it("menyamarkan email mentah tetapi tetap menyimpan domainnya", () => {
    const hasil = saringPayloadAudit({ email: "budi.santoso@contoh.test" });

    expect(hasil.email).toBe("b***@contoh.test");
    expect(JSON.stringify(hasil)).not.toContain("budi.santoso");
  });

  it("menyamarkan string opaque panjang yang lolos dari penamaan", () => {
    const tokenTanpaNama = "A".repeat(43);
    const hasil = saringPayloadAudit({ nilai: tokenTanpaNama });

    expect(hasil.nilai).toBe("[disamarkan]");
    expect(JSON.stringify(hasil)).not.toContain(tokenTanpaNama);
  });

  it("membiarkan uuid dan angka apa adanya", () => {
    const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const hasil = saringPayloadAudit({ target_user_id: uuid, role: "admin", jumlah: 2 });

    expect(hasil).toEqual({ target_user_id: uuid, role: "admin", jumlah: 2 });
  });

  it("mempertahankan nilai null dan boolean", () => {
    const hasil = saringPayloadAudit({ granted_by_user_id: null, diaktifkan_kembali: false });

    expect(hasil).toEqual({ granted_by_user_id: null, diaktifkan_kembali: false });
  });

  it("payload kosong/null menghasilkan objek kosong, bukan melempar", () => {
    expect(saringPayloadAudit(undefined)).toEqual({});
    expect(saringPayloadAudit(null)).toEqual({});
  });
});

describe("samarkanEmail", () => {
  it("mempertahankan huruf pertama local-part dan seluruh domain", () => {
    expect(samarkanEmail("Budi@Contoh.test")).toBe("B***@Contoh.test");
  });

  it("mengembalikan penanda aman untuk nilai yang bukan email", () => {
    expect(samarkanEmail("bukan-email")).toBe("***");
    expect(samarkanEmail("@contoh.test")).toBe("***");
    expect(samarkanEmail("")).toBe("***");
  });
});
