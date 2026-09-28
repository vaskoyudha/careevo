import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Kontrak tinggi navbar.
 *
 * `.chrome` adalah `position: sticky`, jadi ia **memakan tinggi sungguhan di
 * flow** (66px di >= 769px, 62px di bawahnya —lihat `--chrome-h`). Halaman
 * yang mau hero-nya mulai tepat di y=0 harus menarik dirinya ke atas sebesar
 * angka itu. Angka itu dulu ditulis manual di tiga tempat dan **ketiganya
 * salah**: `-mt-[60px]` di `/loker` dan `/professional-certificates/[slug]`
 * menyisakan pita putih 6px di atas layar (bar `is-top` memang transparan,
 * jadi latar halaman yang tersingkap itu terlihat), dan
 * `--learner-chrome-height: 104px` di `.learner-shell--overlay` menarik hero
 * `/belajar/[slug]` 42px ke *atas* bar di mobile.
 *
 * Nol di sini adalah penghilangantaged: `typecheck`, `lint`, `vitest`, dan
 * `build` semuanya buta terhadap tinggi piksel. Yang bisa mengunci kontrak ini
 * hanya sumbernya, jadi polanya sama dengan `kode-view.test.ts`: baca
 * `globals.css` dan sumber komponennya.
 *
 * `.chrome.is-winged` (bar AI Mastery) sengaja tidak diatur di sini: siluetnya
 * berbeda, 64px, dan mempublikasikan `--app-chrome-h` sendiri. Yang dikunci
 * adalah **dua** bar yang bermorf, yang keduanya memakai `.under-chrome` atau
 * `--chrome-h`.
 */
const AKAR = fileURLToPath(new URL("..", import.meta.url));
const CSS = readFileSync(join(AKAR, "app/globals.css"), "utf8");

/** Semua `.tsx` di `src/`, tanpa `node_modules` dan tanpa pohon vendored. */
function semuaTsx(dir: string, hasil: string[] = []): string[] {
  for (const entri of readdirSync(dir)) {
    const jalur = join(dir, entri);
    if (entri === "node_modules" || entri.startsWith(".")) continue;
    if (statSync(jalur).isDirectory()) {
      semuaTsx(jalur, hasil);
    } else if (entri.endsWith(".tsx")) {
      hasil.push(jalur);
    }
  }
  return hasil;
}

const TSX = semuaTsx(join(AKAR, "components")).concat(semuaTsx(join(AKAR, "app")));

describe("tinggi navbar", () => {
  it("mengpublikasikan `--chrome-h` tepat sekali, dan `.chrome` mengikutinya", () => {
    // Dua blok `:root` (mobile lalu desktop) adalah minimum yang benar: satu
    // breakpoint. Lebih dari itu berarti ada angka ketiga yang bisa melenceng.
    const deklarasi = CSS.match(/--chrome-h:\s*\d+px/g) ?? [];
    expect(deklarasi).toHaveLength(2);

    // Nilai yang diukur di browser (lihat komentar di `.chrome`), bukan
    // tebakan: 44px tap target + 2 x 8px padding + 2 x 1px border, dan
    // 48px logo + 2 x 8px padding + 2 x 1px border.
    expect(CSS).toMatch(/@media \(min-width: 769px\) \{\s*:root \{\s*--chrome-h: 66px;/);
    expect(CSS).toMatch(/:root \{\s*--chrome-h: 62px;/);
  });

  it("tidak ada halaman yang menulis offset navbar dengan angka sendiri", () => {
    // Margin negatif per-page adalah constexpr yang lolos ke bundle dan tidak
    // terhubung ke `.chrome` sama sekali. `.under-chrome` adalah satu-satunya
    // jalan. Whole-file, bukan `className` saja, supaya komentar yang menyalin
    // angka lamanya ikut ketahuan.
    const pelaku = TSX.filter((f) => /-mt-\[\d+px\]/.test(readFileSync(f, "utf8"))).map(
      (f) => f.slice(AKAR.length),
    );
    expect(pelaku).toEqual([]);
  });

  it("halaman yang hero-nya di belakang navbar memakai `.under-chrome`", () => {
    // Dua halaman yang pernah menampakkan pita putih: `/loker` (juga `/kerja`,
    // yang mengulang `loker/page.tsx`) dan `/professional-certificates/[slug]`
    // (juga `/specializations/[slug]`, yang memakai view yang sama).
    for (const relatif of [
      "components/features/jobs/vertex-kerja-view.tsx",
      "components/features/learning/program-detail-view.tsx",
    ]) {
      const sumber = readFileSync(join(AKAR, relatif), "utf8");
      expect(sumber, relatif).toContain("under-chrome");
      expect(sumber, relatif).not.toMatch(/-mt-\[\d+px\]/);
    }
  });

  it("`.learner-shell--overlay` memakai pengukuran yang sama, bukan angka sendiri", () => {
    // `--learner-chrome-height` masih hidup karena `belajar-home.tsx`
    // menjumlahkannya ke padding hero-nya, jadi ia harus jadi alias.
    expect(CSS).toContain("--learner-chrome-height: var(--chrome-h);");
    expect(CSS).toMatch(
      /\.learner-shell--overlay > main \{\s*margin-top: calc\(-1 \* var\(--chrome-h\)\);/,
    );
  });
});
