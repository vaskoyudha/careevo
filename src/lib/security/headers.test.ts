import { describe, expect, it } from "vitest";
import {
  aturanKeamanan,
  HEADER_KEAMANAN,
  HSTS_PRODUCTION,
} from "./headers";

/**
 * Baseline security headers dipasang lewat `headers()` di `next.config.ts`.
 * Yang diuji di sini adalah kontraknya, bukan perilaku Next — karena itu kita
 * panggil `aturanKeamanan(isProduction)` dengan argumen eksplisit, bukan
 * menyetel `process.env` (kalau memakai env, test `production` akan membuat
 * test lain di berkas yang sama ikut berubah).
 */
function headerDari(isProduction: boolean): Record<string, string> {
  const aturan = aturanKeamanan(isProduction);
  // Satu aturan menutup seluruh path; ini kontrak yang membuat tiap halaman,
  // route handler, dan berkas `/public` mendapat header tanpa didaftarkan satu
  // per satu.
  expect(aturan).toHaveLength(1);
  expect(aturan[0].source).toBe("/:path*");
  return Object.fromEntries(aturan[0].headers.map((h) => [h.key, h.value]));
}

describe("aturanKeamanan", () => {
  it("mengirim baseline di luar production", () => {
    const h = headerDari(false);

    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(h["Permissions-Policy"]).toBe(HEADER_KEAMANAN["Permissions-Policy"]);
  });

  it("tidak mengirim HSTS di luar production", () => {
    // Kalau HSTS bocor ke `next dev`, localhost yang sudah pernah dibuka akan
    // dipaksa HTTPS dan dev server http biasa berhenti bisa diakses.
    expect(headerDari(false)["Strict-Transport-Security"]).toBeUndefined();
  });

  it("menambahkan HSTS di production tanpa preload", () => {
    const h = headerDari(true);

    expect(h["Strict-Transport-Security"]).toBe(HSTS_PRODUCTION);
    expect(h["Strict-Transport-Security"]).toContain("max-age=");
    expect(h["Strict-Transport-Security"]).toContain("includeSubDomains");
    // `preload` praktis tidak bisa dibatalkan dan mensyaratkan seluruh
    // subdomain sudah HTTPS; jangan dipasang tanpa inventaris domain.
    expect(h["Strict-Transport-Security"]).not.toContain("preload");
  });

  it("mengizinkan kamera hanya ke origin sendiri", () => {
    // Sesi terverifikasi course direncanakan memakai kamera; `camera=()` akan
    // mematikan fitur itu sebelum dibangun. Yang dilarang adalah akses dari
    // iframe/origin pihak ketiga.
    expect(HEADER_KEAMANAN["Permissions-Policy"]).toContain("camera=(self)");
  });

  it("tidak menetapkan CSP diam-diam", () => {
    // CSP menuntut nonce + dynamic rendering (lihat docs Next 16); menambah
    // `Content-Security-Policy` di sini akan memecah halaman tanpa peringatan.
    // Test ini penjaga agar tidak ada yang menambahkannya lewat jalan belakang.
    expect(Object.keys(HEADER_KEAMANAN)).not.toContain("Content-Security-Policy");
    expect(headerDari(true)["Content-Security-Policy"]).toBeUndefined();
  });
});
