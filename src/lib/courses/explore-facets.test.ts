import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  EXPLORE_FACETS,
  FASET_AWAL,
  TOTAL_PROGRAM,
  cariFaset,
  cariItem,
  normalisasi,
} from "./explore-facets";
import {
  CATEGORIES,
  CERTIFICATES,
  DEGREES,
  ROLES,
  TRENDING_SKILLS,
} from "./explore-taxonomy";

/**
 * Pola route yang benar-benar ada, dibaca dari pohon App Router.
 *
 * Ini menjawab hal yang tidak bisa dijawab dari string: apakah sebuah
 * href di taksonomi benar-benar mendarat di halaman, atau cuma kelihatan
 * benar. Test sebelumnya ("semua href memakai path absolut yang dikenal")
 * hanya memeriksa `startsWith("/")` dan tidak ada `//`, jadi
 * `/certificates/learn` lolos padahal route itu tidak pernah ada dan
 * tautannya 404 dari dalam menu navbar.
 *
 * Segmen dinamis (`[role]`, `[category]`, `[level]`, ...) jadi wildcard
 * satu segmen, bukan dicocokkan harfiah. `/career-academy/roles/[role]`
 * harus cocok dengan `/career-academy/roles/data-analyst`, sementara
 * `/certificates/learn` tetap tidak cocok apa pun karena tidak ada
 * `/certificates/*` sama sekali.
 */
function polaRoute(): RegExp[] {
  const appDir = resolve(__dirname, "../../app");
  const out: RegExp[] = [];

  const walk = (dir: string, segments: string[]) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      // Route group `(public)` tidak muncul di URL.
      if (entry.startsWith("(") && entry.endsWith(")")) {
        walk(full, segments);
        continue;
      }
      if (entry.startsWith("@")) continue; // parallel route slot
      walk(full, [...segments, entry]);
    }
    if (segments.length === 0) return;
    const pola = segments
      .map((s) =>
        /^\[.+\]$/.test(s) ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("/");
    out.push(new RegExp(`^/${pola}/?$`));
  };

  walk(appDir, []);
  return out;
}

/** Samakan href dengan rute: buang query dan garis miring akhir. */
function ruteDariHref(href: string): string {
  return href.split("?")[0].replace(/\/$/, "") || "/";
}

const POLA = polaRoute();

/** Apakah `href` ini mendarat di route yang benar-benar ada? */
function mendarat(href: string): boolean {
  const rute = ruteDariHref(href);
  return POLA.some((p) => p.test(rute));
}

const ITEM_TAKSONOMI = [
  ...ROLES,
  ...CATEGORIES,
  ...CERTIFICATES,
  ...DEGREES,
  ...TRENDING_SKILLS,
];

describe("explore-facets: href benar-benar mendarat", () => {
  it("sanity: pola router dibangun dan route statis dikenali", () => {
    // Kalau ini gagal, `POLA` kosong dan semua test di bawah jadi tidak
    // berarti. Lebih baik gagal keras di sini.
    expect(POLA.length).toBeGreaterThan(20);
    expect(mendarat("/browse")).toBe(true);
    expect(mendarat("/career-academy")).toBe(true);
    expect(mendarat("/courses")).toBe(true);
  });

  it("sanity: segmen dinamis dikenali sebagai wildcard", () => {
    expect(mendarat("/career-academy/roles/data-analyst")).toBe(true);
    expect(mendarat("/browse/data-science")).toBe(true);
    expect(mendarat("/degrees/bachelors")).toBe(true);
  });

  it("sanity: route yang tidak ada memang tidak cocok", () => {
    // Guard untuk guard: kalau wildcard-nya terlalu longgar, test di
    // bawah akan lulus tanpa artinya.
    expect(mendarat("/certificates/learn")).toBe(false);
    expect(mendarat("/tidak-ada-sama-sekali")).toBe(false);
  });

  it("setiap href taksonomi mendarat di route yang ada", () => {
    const hilang = ITEM_TAKSONOMI.filter((i) => !mendarat(i.href));
    expect(hilang.map((i) => i.href)).toEqual([]);
  });

  it("setiap href rail faset mendarat di route yang ada", () => {
    const hilang = EXPLORE_FACETS.filter((f) => !mendarat(f.href));
    expect(hilang.map((f) => f.href)).toEqual([]);
  });

  it("setiap item faset mendarat di route yang ada", () => {
    const hilang = EXPLORE_FACETS.flatMap((f) =>
      f.items.filter((i) => !mendarat(i.href)).map((i) => i.href),
    );
    expect(hilang).toEqual([]);
  });
});

describe("explore-facets: tidak pernah menjanjikan ruang kosong", () => {
  it("tidak ada item dengan 0 program", () => {
    const kosong = EXPLORE_FACETS.flatMap((f) =>
      f.items.filter((i) => i.jumlah <= 0).map((i) => `${f.key}:${i.label}`),
    );
    expect(kosong).toEqual([]);
  });

  it("setiap faset punya minimal satu item, jadi rail tidak ada yang buntu", () => {
    for (const f of EXPLORE_FACETS) {
      expect(f.items.length, `${f.key} tidak punya item`).toBeGreaterThan(0);
    }
  });

  it("`items` + `tanpaIsi` = seluruh entri taksonomi faset itu", () => {
    // Kalau tidak, ada entri yang hilang diam-diam — dan itu persis
    // bentuk janji yang tidak ditepati.
    const sumber = {
      peran: ROLES.length,
      keterampilan: TRENDING_SKILLS.length,
      bidang: CATEGORIES.length,
      sertifikat: CERTIFICATES.length,
    } as const;

    for (const f of EXPLORE_FACETS) {
      expect(f.items.length + f.tanpaIsi, f.key).toBe(sumber[f.key]);
    }
  });

  it("faset awal benar-benar punya isi", () => {
    expect(cariFaset(FASET_AWAL).items.length).toBeGreaterThan(0);
  });

  it("tidak ada href yang menunjuk ke route lama yang dipakai sebagai placeholder", () => {
    const salah = EXPLORE_FACETS.flatMap((f) =>
      f.items.filter((i) => i.href === "/belajar").map((i) => i.href),
    );
    expect(salah).toEqual([]);
  });

  it("angka di menu berasal dari katalog, bukan placeholder", () => {
    expect(TOTAL_PROGRAM).toBeGreaterThan(0);
    for (const f of EXPLORE_FACETS) {
      for (const item of f.items) {
        expect(item.jumlah, `${f.key}/${item.label}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("explore-facets: pencarian", () => {
  it("query kosong tidak mengembalikan apa-apa", () => {
    expect(cariItem("")).toEqual([]);
    expect(cariItem("   ")).toEqual([]);
  });

  it("spasi diabaikan: 'powerbi' menemukan 'Power BI'", () => {
    expect(cariItem("powerbi").map((i) => i.label)).toContain("Power BI");
  });

  it("satu label boleh muncul di dua faset, dan kuncinya href + faset", () => {
    // "Data Science" ada di `bidang` dan `sertifikat`: dua entri, dua
    // href. Menggabungkan keduanya jadi satu akan menghilangkan jalan
    // masuk ke salah satunya.
    const pasangan = cariItem("data science").map((i) => `${i.facet}|${i.href}`);
    expect(new Set(pasangan).size).toBe(pasangan.length);
  });

  it("normalisasi membuang spasi dan huruf besar", () => {
    expect(normalisasi("Power BI")).toBe("powerbi");
    expect(normalisasi("  Data   Science ")).toBe("datascience");
  });

  it("query yang tidak ada di katalog nihil, bukan jatuh ke semua", () => {
    // Katalog 6 program, jadi 'kubernetes' harus nihil. Kalau diam-diam
    // mengembalikan semua, panel akan mengarang hasil.
    expect(cariItem("kubernetes")).toEqual([]);
  });
});
