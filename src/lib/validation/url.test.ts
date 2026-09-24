import { describe, it, expect } from "vitest";
import { skemaUrlHttp } from "./url";

/**
 * `skemaUrlHttp` sengaja bukan `z.url()`: zod memvalidasi *bentuk* URL, bukan
 * keamanan protokolnya. `z.url().safeParse("javascript:alert(1)")` sukses di
 * zod 4, sehingga nilai itu bisa tersimpan lalu dirender ke `<a href>`.
 */
describe("skemaUrlHttp", () => {
  it("menerima http dan https", () => {
    expect(skemaUrlHttp.safeParse("https://careevo.test/kursus").success).toBe(true);
    expect(skemaUrlHttp.safeParse("http://localhost:3000").success).toBe(true);
  });

  it("memangkas spasi di sekitar URL", () => {
    const parsed = skemaUrlHttp.safeParse("  https://careevo.test  ");
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toBe("https://careevo.test");
    }
  });

  it("menolak skema berbahaya dan path relatif", () => {
    const ditolak = [
      "javascript:alert(1)",
      "data:text/html,x",
      "ftp://x",
      "/foo",
      "",
    ];

    for (const nilai of ditolak) {
      expect(skemaUrlHttp.safeParse(nilai).success, nilai).toBe(false);
    }
  });
});
