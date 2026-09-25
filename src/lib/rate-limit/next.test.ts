import { describe, expect, it } from "vitest";
import { responsDibatasi, responsPembatasGagal } from "./next";
import type { HasilBatasi } from "./contract";

/**
 * Direct tests for the response builders.
 *
 * The route and proxy tests mock `batasiRequestMasuk`, so they never exercise
 * the actual 429/503 shape. These are the bytes the client sees, and the
 * `Retry-After` header is the contract that makes a 429 actionable — so it is
 * pinned here rather than left to integration coverage that might not reach it.
 */

const TERBATAS: HasilBatasi = {
  sukses: false,
  limit: 60,
  sisa: 0,
  resetMs: Date.now() + 45_000,
};

describe("responsDibatasi", () => {
  it("membalas 429 dengan Retry-After dan tiga header RateLimit", async () => {
    const response = responsDibatasi("verifyPublik", TERBATAS);

    expect(response.status).toBe(429);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const retry = Number(response.headers.get("Retry-After"));
    expect(Number.isInteger(retry)).toBe(true);
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(45);
    expect(response.headers.get("RateLimit-Limit")).toBe("60");
    expect(response.headers.get("RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("RateLimit-Reset")).toBe("PT600S");
  });

  it("memakai pesan generik yang tidak menyebut limit atau sisa kuota", async () => {
    const response = responsDibatasi("login", TERBATAS);
    const body = (await response.json()) as { ok: boolean; error: string };

    expect(body.ok).toBe(false);
    // Menyebut angka tidak menambah apa pun bagi pengguna sah dan membantu
    // penyerang mengkalibrasi.
    expect(body.error).not.toContain("60");
    expect(body.error).not.toContain("10");
  });

  it("tidak pernah membuat Retry-After negatif meski reset sudah lewat", () => {
    const response = responsDibatasi("login", { ...TERBATAS, resetMs: Date.now() - 10_000 });
    expect(Number(response.headers.get("Retry-After"))).toBe(1);
  });
});

describe("responsPembatasGagal", () => {
  it("membalas 503 dengan Retry-After, bukan 429", async () => {
    const response = responsPembatasGagal();

    // 429 berarti "pemakaian berlebih"; 503 berarti "layanan pembatas mati".
    // Mencampurnya menyesatkan klien yang menghormati Retry-After.
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});
