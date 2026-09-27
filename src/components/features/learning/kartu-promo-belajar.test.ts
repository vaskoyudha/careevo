import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  closestPromoIndex,
  promoCardOffset,
  promoSnapLeft,
} from "@/lib/learning/hero-promo";

/**
 * Kontrak: **kartu promo di `/belajar` bisa digeser dengan mouse, dan setiap
 * titik (dot) benar-benar sampai ke kartunya.**
 *
 * Dua bug nyata yang dikunci di sini, keduanya tidak terlihat oleh gate mana pun
 * (`typecheck`, `lint`, `vitest`, `build` semuanya hijau):
 *
 *  1. **Tidak ada drag-to-scroll sama sekali.** `<div>` itu `overflow-x-auto`,
 *     jadi roda tetikus menggesernya — tapi mouse yang di-drag ke kiri/kanan
 *     tidak melakukan apa pun (`scrollLeft` tetap `0` setelah 12 langkah drag),
 *     dan yang benar-benar terjadi adalah **drag bawaan peramban**: `<img>`
 *     dalam kartu `draggable`, jadi halaman menyeret gambar, bukan korsel.
 *  2. **`snap-start` + kartu `w-[47%]` membuat kartu tengah tidak terjangkau.**
 *     Titik snap yang benar-benar bisa dicapai pada 1440px hanya `0` dan `509`,
 *     sedangkan tombol dot menggeser ke **tengah** kartu (`254`): `snap-mandatory`
 *     menulis ulang setiap `scrollLeft` mentah ke titik snap terdekat, jadi dot
 *     kedua menggeser ke `0` — tidak berpindah sama sekali.
 *
 * Karena itu geometri korsel diuji sebagai **fungsi murni** (`hero-promo.ts`), dan
 * sisanya sebagai bentuk kode: tanpa jsdom, satu-satunya cara menahan regresi ini
 * adalah membaca sumbernya.
 *
 * Angka-angka di komentar ini diukur di Chromium pada 1440/1024/820/640/414/375px.
 */

const AKAR = fileURLToPath(new URL("../../../../", import.meta.url));
const BERKAS = join(AKAR, "src/components/features/learning/belajar-home.tsx");

/** Sumber tanpa komentar: komentar di berkas itu menjelaskan alasannya, jadi
 *  menguji teks mentah akan gagal justru karena dokumentasinya benar. */
function tanpaKomentar(berkas: string): string {
  return readFileSync(berkas, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const SUMBER = tanpaKomentar(BERKAS);

/**
 * Hanya badan `HeroPromoCards`, batas atas sampai definisi berikutnya.
 *
 * Wajib: berkas ini memuat **dua** baris yang bisa digeser dengan mouse, dan
 * baris kategori di bawahnya memakai nama handler yang sama (`mulaiSeret`,
 * `tangkapKlik`, `pointerType !== "mouse"`). Assertion yang mencari string itu di
 * seluruh berkas akan tetap hijau meskipun drag korsel promo dihapus — persis
 * regresi yang ingin dicegah di sini.
 */
function badanHeroPromo(sumber: string): string {
  const mulai = sumber.indexOf("function HeroPromoCards()");
  const selesai = sumber.indexOf("const PARTNERS");
  expect(mulai, "HeroPromoCards tidak ditemukan").toBeGreaterThanOrEqual(0);
  expect(selesai, "batas akhir HeroPromoCards tidak ditemukan").toBeGreaterThan(mulai);
  return sumber.slice(mulai, selesai);
}

const KARTU = badanHeroPromo(SUMBER);

/**
 * Geometri yang diukur di Chromium pada 1440px: viewport 1192px, tiga kartu
 * selebar 560,234px dengan jarak 10px. Sub-piksel, bukan bulat — `scrollWidth`
 * yang dilaporkan peramban 1701px sementara tepi kanan kartu terakhir hanya
 * 1700,703px, jadi membandingkan dengan angka bulat akan gagal karena
 * pembulatan, bukan karena rumusnya salah.
 */
const KARTU_1440 = [
  { left: 0, width: 560.234375 },
  { left: 570.234375, width: 560.234375 },
  { left: 1140.46875, width: 560.234375 },
];
const VW_1440 = 1192;

describe("promoCardOffset", () => {
  it("menaruh kartu tengah tepat di tengah viewport", () => {
    // (570,234 + 280,117) - 596 = 254,35 — angka yang sama dengan titik snap
    // nyata, yang dibulatkan peramban menjadi 254.
    expect(promoCardOffset(1, VW_1440, KARTU_1440)).toBeCloseTo(254.3515625, 4);
    expect(Math.round(promoCardOffset(1, VW_1440, KARTU_1440))).toBe(254);
  });

  it("menjepit kartu pertama dan terakhir ke tepi, karena tidak ada sisi lain", () => {
    expect(promoCardOffset(0, VW_1440, KARTU_1440)).toBe(0);
    // Titik snap terjauh adalah `scrollWidth - clientWidth` (509 di peramban),
    // dan offset kartu terakhir terjepit persis ke situ.
    const maks = 508.703125;
    expect(promoCardOffset(2, VW_1440, KARTU_1440)).toBeCloseTo(maks, 4);
    expect(Math.round(promoCardOffset(2, VW_1440, KARTU_1440))).toBe(509);
  });

  it("memberi offset yang berbeda dan menaik untuk setiap kartu", () => {
    // Inilah regresi `snap-start`: dengan geometri kartu lebar, hanya dua titik
    // snap yang bisa dicapai, jadi tiga kartu memetakan ke dua offset.
    const offset = KARTU_1440.map((_, i) => promoCardOffset(i, VW_1440, KARTU_1440));
    expect(new Set(offset).size).toBe(KARTU_1440.length);
    expect(offset[0]).toBeLessThan(offset[1]);
    expect(offset[1]).toBeLessThan(offset[2]);
  });

  it("menjepit indeks di luar rentang, bukan menghasilkan NaN", () => {
    expect(promoCardOffset(-5, VW_1440, KARTU_1440)).toBe(0);
    expect(Math.round(promoCardOffset(99, VW_1440, KARTU_1440))).toBe(509);
  });

  it("tidak memecah belah saat tidak ada kartu atau viewport lebih lebar dari isi", () => {
    expect(promoCardOffset(0, VW_1440, [])).toBe(0);
    expect(promoCardOffset(0, 4000, KARTU_1440)).toBe(0);
  });
});

describe("promoSnapLeft", () => {
  it("mendaratkan drag yang dilepas di kartu terdekat", () => {
    // Drag berhenti di 340: lebih dekat ke tengah kartu 2 (254,35) daripada 3.
    expect(Math.round(promoSnapLeft(340, VW_1440, KARTU_1440))).toBe(254);
  });

  it("memakai pembulatan yang sama dengan dot yang menyala", () => {
    // Tidak ada rumus "kartu terdekat" kedua: dot dan pendaratan harus sepakat.
    for (let scrollLeft = 0; scrollLeft <= 509; scrollLeft += 17) {
      expect(promoSnapLeft(scrollLeft, VW_1440, KARTU_1440)).toBe(
        promoCardOffset(
          closestPromoIndex(scrollLeft, VW_1440, KARTU_1440),
          VW_1440,
          KARTU_1440,
        ),
      );
    }
  });
});

describe("belajar-home.tsx — kartu promo", () => {
  it("menggeser kartu ke tengah, bukan ke tepi kiri", () => {
    // `snap-start` adalah bugnya: hanya `0` dan `509` yang bisa dicapai.
    expect(KARTU).toContain("snap-center");
    expect(KARTU).not.toMatch(/shrink-0 snap-start/);
  });

  it("memasang drag-to-scroll pada penggeser, bukan pada kartunya", () => {
    expect(KARTU).toContain("onPointerDown={mulaiSeret}");
    expect(KARTU).toContain("onPointerMove={seretKartu}");
    expect(KARTU).toContain("onPointerUp={selesaiSeret}");
    expect(KARTU).toContain("onPointerCancel={selesaiSeret}");
  });

  it("hanya mengambil pointer tetikus, supaya sentuh tetap punya momentum", () => {
    expect(KARTU).toContain('event.pointerType !== "mouse"');
  });

  it("mematikan snap saat menyeret dan menyalakannya kembali", () => {
    // Tanpa mematikan snap, `snap-mandatory` menulis ulang setiap posisi drag
    // ke titik snap terdekat — drag 1:1 jadi mustahil.
    expect(KARTU).toContain('scrollSnapType = "none"');
    expect(KARTU).toContain('scrollSnapType = ""');
  });

  it("menelan klik yang jatuh setelah drag, dan tetap membiarkan klik biasa", () => {
    expect(KARTU).toContain("onClickCapture={tangkapKlik}");
    expect(KARTU).toMatch(/event\.preventDefault\(\)/);
    // Penjaga `geser` itulah yang membuatnya "hanya setelah drag": tanpa itu
    // setiap klik pada kartu ikut ditelan dan tautannya mati.
    expect(KARTU).toMatch(/if \(!seretRef\.current\.geser\) return;/);
  });

  it("mematikan drag bawaan peramban dan seleksi teks", () => {
    // Yang paling penting: `<img>` di dalam kartu tidak boleh menyeret dirinya —
    // itulah yang menggagalkan drag tanpa jejak (peramban menyeret gambar alih-alih
    // menggeser korsel).
    expect(KARTU).toMatch(/onDragStart=\{\(event\) => event\.preventDefault\(\)\}/);
    expect(KARTU).toContain("select-none");
    // Anchor ke `<Link>` kartu promo — `data-promo-card` di JSX, bukan yang di
    // dalam `querySelectorAll` milik hook pengukuran. Jendelanya sempit supaya
    // `draggable={false}` milik anchor yang diperiksa, bukan yang mana saja.
    const anchor = KARTU.indexOf("<Link\n                  key={card.title}");
    expect(anchor, "anchor <Link> kartu promo tidak ditemukan").toBeGreaterThanOrEqual(0);
    expect(KARTU.slice(anchor, anchor + 200)).toContain("draggable={false}");
  });

  it("memberi isyarat grab hanya pada perangkat bertetikus", () => {
    expect(KARTU).toContain("cursor-grab");
    expect(KARTU).toContain("cursor-grabbing");
    expect(KARTU).toContain("touch-pan-x");
  });

  it("memakai satu pengukuran kartu untuk dot, tombol, dan pendaratan drag", () => {
    // Dua pengukuran geometri yang berbeda adalah cara korsel mendarat di posisi
    // yang tidak disetujui dot-nya sendiri.
    expect(KARTU).toContain("promoCardOffset");
    expect(KARTU).toContain("promoSnapLeft");
    expect(KARTU).toContain("ukurKartu");
  });
});
