import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static checks on `proxy.ts`, in the style already used by
 * `src/lib/learning/security.test.ts`: read the source, assert a property that
 * is easy to lose in a later edit. These are not runtime tests — the failure
 * modes here are silent, and a render-free repo like this one cannot catch them
 * any other way.
 *
 * The failure the Next docs call out explicitly: a `matcher` change (or a
 * refactor that moves a Server Action) can drop Proxy coverage without any
 * error. So the matcher is pinned here, deliberately, together with the reason
 * it covers only `/verify`.
 */
const ROOT = path.resolve(__dirname, "..");
const SUMBER = readFileSync(path.join(ROOT, "src/proxy.ts"), "utf8");

describe("proxy.ts", () => {
  it("mengekspor fungsi bernama `proxy` (konvensi Next 16, bukan `middleware`)", () => {
    expect(SUMBER).toMatch(/export async function proxy\(/);
    expect(SUMBER).not.toMatch(/export (async )?function middleware\(/);
  });

  it("memakai matcher literal, bukan nilai yang dibangun dari variabel", () => {
    // Matcher dianalisis statis saat build; nilai dinamis diabaikan diam-diam
    // dan pembatasan hilang tanpa error.
    expect(SUMBER).toMatch(/matcher:\s*\[\s*"\/verify\/:token"\s*\]/);
  });

  it("membatasi hanya rute yang memang tidak punya handler tempat cek bisa berdiri", () => {
    // `/verify/[token]` adalah Server Component, dan sebuah page tidak dapat
    // membalas 429 dengan Retry-After — Proxy adalah satu-satunya pola yang benar
    // di sana. PDF publik, unggahan, dan seluruh Server Action diperiksa di
    // dalam handler-nya masing-masing (lebih kuat terhadap pergeseran matcher).
    expect(SUMBER).toContain('batasiRequestMasuk(request, "verifyPublik")');
    // PDF publik sengaja TIDAK ditangani di sini.
    expect(SUMBER).not.toContain('"pdfPublik"');
  });

  it("tidak pernah membaca x-forwarded-for yang dapat dikendalikan klien", () => {
    // Bila header yang dapat dipalsukan dipakai sebagai kunci, setiap request
    // dapat memakai bucket baru dan rate limiting mati tanpa terlihat. Yang
    // diperiksa adalah pemakaiannya (`get("...")`), bukan namanya di komentar.
    expect(SUMBER).not.toMatch(/\.get\(\s*["'`]x-forwarded-for/i);
    expect(SUMBER).toContain("batasiRequestMasuk");
  });
});
