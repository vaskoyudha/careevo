import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Bar fokus reader — lebar dan sayapnya.
 *
 * Tiga properti, semuanya **buta** bagi typecheck, lint, dan vitest biasa karena
 * mereka hanya ada di angka CSS:
 *
 * 1. Batasnya lebih lebar dari `--max` (1280px) tapi bukan `100%`. Full-bleed
 *    pernah dicoba dan dibalik: sayapnya harus berada *di luar* kotak bar untuk
 *    terlihat, dan pada `width: 100%` tidak ada sisa ruang untuk itu — keduanya
 *    terpotong viewport dan siluetnya rata jadi persegi membulat biasa.
 * 2. Sayapnya menempel di tepi luar bar (`calc(-1 * var(--wing))`), bukan di
 *    dalamnya. Di dalam, gradien radial-nya tidak menyambung ke siluet bar dan
 *    yang terlihat hanya sudut yang aneh.
 * 3. Lebarnya tetap `min(...)`, bukan angka mati. Itu yang menjamin sayap selalu
 *    punya gutter: pada 1280px rumusnya memberi 1144px + 2×44px sayap = 1232px,
 *    masih di bawah viewport. Angka mati pada layar sempit akan mendorong
 *    sayapnya keluar layar — kegagalan yang sama dengan full-bleed.
 *
 * Terakhir diukur di peramban nyata pada 390/1024/1280/1440/1680/1920px:
 * sayap kiri dan kanan berada di dalam viewport di keenam lebar itu.
 */
const ROOT = path.resolve(__dirname, "../../../..");
const CSS = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

const bar = CSS.match(/\.reader-bar \{[\s\S]*?\n\}/)?.[0] ?? "";

/**
 * Semua blok aturan untuk satu pseudo-element, digabung.
 *
 * `.reader-bar::before` ditulis sebagai **dua** aturan: satu blok bersama
 * (`::before, ::after`) untuk ukuran, lalu satu blok per elemen untuk `left` /
 * `right` dan gradiennya. Regex non-greedy mengambil yang pertama saja — blok
 * bersama, yang tidak memuat posisinya — jadi assertion atas `right` gagal pada
 * CSS yang benar. Digabung supaya urutan penulisannya tidak jadi kontrak.
 */
function aturanSemua(selector: string): string {
  const re = new RegExp(`\\${selector} \\{[\\s\\S]*?\\n\\}`, "g");
  return (CSS.match(re) ?? []).join("\n");
}

const sayapKiri = aturanSemua(".reader-bar::before");
const sayapKanan = aturanSemua(".reader-bar::after");

describe("bar fokus reader — lebar", () => {
  it("memakai batas yang lebih lebar dari --max, tapi bukan full-bleed", () => {
    const cap = bar.match(/--reader-bar-max:\s*(\d+)px/)?.[1];
    expect(cap, "batas bar tidak ditemukan").toBeDefined();
    expect(Number(cap)).toBeGreaterThan(1280);
    expect(bar).not.toMatch(/width:\s*100%/);
    expect(bar).toMatch(/width:\s*min\(var\(--reader-bar-max\),/);
  });

  it("menyisakan ruang untuk sayap di rumus lebarnya", () => {
    // `- 2 * var(--wing)` adalah yang menjaga sayap tetap di dalam viewport.
    // Menghapusnya membuat bar selebar sisa padding, dan sayapnya keluar layar.
    expect(bar).toMatch(/calc\(100% - 2 \* var\(--page-pad\) - 2 \* var\(--wing\)\)/);
    expect(bar).toMatch(/margin:\s*0 auto/);
  });
});

describe("bar fokus reader — sayap", () => {
  it("menggantung di luar tepi bar, satu di tiap sudut atas", () => {
    expect(sayapKiri).toMatch(/left:\s*calc\(-1 \* var\(--wing\)\)/);
    expect(sayapKanan).toMatch(/right:\s*calc\(-1 \* var\(--wing\)\)/);
    // Bukan ditempelkan ke tepi viewport: posisi itu yang dipakai percobaan
    // full-bleed, dan ia menghilangkan bentuk sayapnya.
    expect(sayapKiri).not.toMatch(/left:\s*0/);
    expect(sayapKanan).not.toMatch(/right:\s*0/);
  });
});
