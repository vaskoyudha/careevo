import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bacaSecret,
  isProduksi,
  PANJANG_MINIMUM,
  periksaNilaiSecret,
  SECRET_DEV,
  SECRET_WAJIB,
  SecretConfigError,
  verifikasiKonfigurasiSecret,
} from "./secrets";

/**
 * Adversarial tests for the production secret gate.
 *
 * The failure this prevents is not a crash — it is a deployment that *works*
 * while signing every session, enrollment cookie, and attestation with a
 * secret that is printed in this repository. So the tests below are written
 * from the attacker's side: what value would an operator (or a template) leave
 * in place, and would the gate still let the app start?
 *
 * `stubEnv` mutates `process.env` for the current test only, so the real
 * environment of the developer machine never decides the outcome.
 */

/** Nilai produksi yang sah — acak, panjang, bukan template. */
const SAH = "Q7fZ2mKp9VtR4xLb8NwYcHsD6gJqAeU3TzXvBnMrPiOlKdSw";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("periksaNilaiSecret", () => {
  it("menerima secret acak yang panjang", () => {
    expect(periksaNilaiSecret("SESSION_SECRET", SAH)).toEqual({ ok: true });
  });

  it("menolak secret yang belum diisi", () => {
    for (const kosong of [undefined, "", "   "]) {
      expect(periksaNilaiSecret("SESSION_SECRET", kosong)).toEqual({
        ok: false,
        alasan: "kosong",
      });
    }
  });

  // Inilah nilai yang paling mungkin tertinggal di deployment nyata: nilai dev
  // yang dipakai `npm run dev` dan sudah dipublikasikan di repositori.
  it("menolak nilai dev yang dipublikasikan untuk setiap secret yang dikenal", () => {
    for (const nama of SECRET_WAJIB) {
      expect(periksaNilaiSecret(nama, SECRET_DEV[nama])).toEqual({
        ok: false,
        alasan: "default_development",
      });
    }
  });

  it("menolak nilai template yang biasa disalin dari dokumentasi", () => {
    for (const template of ["changeme", "CHANGEME", "your-secret-here", "todo", "rahasia"]) {
      expect(periksaNilaiSecret("SESSION_SECRET", template)).toEqual({
        ok: false,
        alasan: "placeholder",
      });
    }
  });

  it("menolak secret yang hanya menambahkan awalan dev pada nilai acak", () => {
    // Penyerang tidak perlu tahu secret-nya: nilai yang *berpola* dev sudah
    // cukup untuk menebak bahwa operator menyalin template.
    expect(periksaNilaiSecret("SESSION_SECRET", `dev-${SAH}`)).toEqual({
      ok: false,
      alasan: "placeholder",
    });
  });

  it("menolak secret yang lebih pendek dari minimum", () => {
    const pendek = "a1B2c3D4e5F6g7H8";
    expect(pendek.length).toBeLessThan(PANJANG_MINIMUM.SESSION_SECRET);
    expect(periksaNilaiSecret("SESSION_SECRET", pendek)).toEqual({
      ok: false,
      alasan: "terlalu_pendek",
    });
  });

  it("menerima panjang tepat pada ambang minimum", () => {
    const pas = "a1B2c3D4".repeat(PANJANG_MINIMUM.ATTESTATION_SECRET / 8);
    expect(pas.length).toBe(PANJANG_MINIMUM.ATTESTATION_SECRET);
    expect(periksaNilaiSecret("ATTESTATION_SECRET", pas)).toEqual({ ok: true });
  });
});

describe("bacaSecret di luar produksi", () => {
  it("memakai nilai dev bila env kosong sehingga pengembangan lokal tanpa .env tetap jalan", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_SECRET", "");

    expect(bacaSecret("SESSION_SECRET")).toBe(SECRET_DEV.SESSION_SECRET);
  });

  it("menghormati env yang diisi walau nilainya pendek di luar produksi", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ATTESTATION_SECRET", "pendek");

    expect(bacaSecret("ATTESTATION_SECRET")).toBe("pendek");
  });
});

describe("bacaSecret di produksi", () => {
  it("tidak pernah mengembalikan nilai dev sebagai ganti env yang hilang", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("ATTESTATION_SECRET", "");

    // Keduanya harus gagal-tertutup: tidak ada jalur yang mengembalikan nilai
    // dev ketika produksi tidak dikonfigurasi.
    expect(() => bacaSecret("SESSION_SECRET")).toThrow(SecretConfigError);
    expect(() => bacaSecret("ATTESTATION_SECRET")).toThrow(SecretConfigError);
  });

  it("menolak nilai dev di produksi", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", SECRET_DEV.SESSION_SECRET);

    expect(() => bacaSecret("SESSION_SECRET")).toThrow(/default|dev/i);
  });

  it("mengembalikan secret produksi yang sah", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", SAH);

    expect(bacaSecret("SESSION_SECRET")).toBe(SAH);
  });

  it("tidak membocorkan nilai secret ke dalam pesan galat", () => {
    const rahasia = "pendek-tapi-rahasia";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", rahasia);

    let pesan = "";
    try {
      bacaSecret("SESSION_SECRET");
    } catch (error) {
      pesan = (error as Error).message;
    }

    expect(pesan).toContain("SESSION_SECRET");
    expect(pesan).not.toContain(rahasia);
  });
});

describe("isProduksi", () => {
  it("hanya benar untuk NODE_ENV=production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isProduksi()).toBe(true);

    vi.stubEnv("NODE_ENV", "test");
    expect(isProduksi()).toBe(false);
  });
});

describe("verifikasiKonfigurasiSecret (gate saat server start)", () => {
  it("tidak melempar di luar produksi", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("ATTESTATION_SECRET", "");

    expect(() => verifikasiKonfigurasiSecret()).not.toThrow();
  });

  it("menggagalkan start produksi ketika secret hilang", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("ATTESTATION_SECRET", "");

    expect(() => verifikasiKonfigurasiSecret()).toThrow(SecretConfigError);
  });

  it("menggagalkan start produksi ketika attestation masih memakai nilai dev", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", SAH);
    vi.stubEnv("ATTESTATION_SECRET", SECRET_DEV.ATTESTATION_SECRET);

    expect(() => verifikasiKonfigurasiSecret()).toThrow(/ATTESTATION_SECRET/);
  });

  it("menyebut seluruh secret yang bermasalah sekaligus, bukan hanya yang pertama", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", SECRET_DEV.SESSION_SECRET);
    vi.stubEnv("ATTESTATION_SECRET", "");

    let pesan = "";
    try {
      verifikasiKonfigurasiSecret();
    } catch (error) {
      pesan = (error as Error).message;
    }

    expect(pesan).toContain("SESSION_SECRET");
    expect(pesan).toContain("ATTESTATION_SECRET");
  });

  it("lulus ketika semua secret produksi sah", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", SAH);
    vi.stubEnv("ATTESTATION_SECRET", `${SAH}${SAH}`);

    expect(() => verifikasiKonfigurasiSecret()).not.toThrow();
  });
});
