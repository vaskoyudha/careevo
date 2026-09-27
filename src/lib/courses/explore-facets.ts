/**
 * Faset Explore: satu model untuk "menjelajah per ___".
 *
 * Model lama (`explore-taxonomy.ts` + kolom di `explore-menu.tsx`) menaruh
 * semua taksonomi sebagai satu daftar flat: 10 peran, 10 bidang, 4 topik
 * sertifikat, 3 jenjang, 8 skill = 35 pintu masuk, semuanya ditampilkan
 * tanpa syarat. Katalog sebenarnya berisi **6 program**, dan 4 dari 10
 * bidang sudah terbaca `0 program` di `/browse`. Jadi menu lama
 * menjanjikan 35 hal di depan 6 isi.
 *
 * Di sini tiap faset **dihitung dari katalog**, bukan dari daftar statis:
 * `jumlah` diambil dari fungsi yang sama dengan yang dipakai halaman
 * tujuan (`getProgramsByRole` untuk `/career-academy/roles/*`,
 * `getProgramsByCategory` untuk `/browse/*`, dst), jadi angka di menu dan
 * angka di halaman tidak bisa berbeda. Item dengan `jumlah === 0` tidak
 * masuk `items`; jumlahnya dikumpulkan ke `tanpaIsi` supaya UI bisa
 * mengatakannya secara jujur alih-alih diam-diam menyembunyikan.
 *
 * Menu karena itu tidak pernah bisa mengarahkan orang ke ruangan kosong.
 *
 * Klien-safety: modul ini murni, hanya membaca `catalog-data.ts` yang
 * sudah data murni, jadi aman diimpor dari komponen client navbar tanpa
 * menarik `node:net` atau database ke bundel browser.
 */

import {
  getAllPrograms,
  getProgramsByCategory,
  getProgramsByQuery,
  getProgramsByRole,
  getProgramsBySearch,
} from "./explore-queries";
import {
  CATEGORIES,
  CERTIFICATES,
  ROLES,
  TRENDING_SKILLS,
  type ExploreItem,
} from "./explore-taxonomy";

export type ExploreFacetKey = "peran" | "keterampilan" | "bidang" | "sertifikat";

export type ExploreFacetItem = {
  label: string;
  href: string;
  /** Berapa program yang benar-benar ada. Selalu > 0 untuk item di `items`. */
  jumlah: number;
};

export type ExploreFacet = {
  key: ExploreFacetKey;
  label: string;
  /** Halaman penuh untuk faset ini. Rail panel dan "Lihat semua" menuju ke sini. */
  href: string;
  /** Satu kalimat penunjuk, bahasa Indonesia. */
  ringkas: string;
  /** Hanya item yang punya isi. */
  items: ExploreFacetItem[];
  /** Berapa entri yang disembunyikan karena `0 program`. */
  tanpaIsi: number;
};

/** Semua item dari semua faset, untuk pencarian silang. */
export type ExploreItemILatar = ExploreFacetItem & {
  facet: ExploreFacetKey;
  facetLabel: string;
};

/* ------------------------------------------------------------------ */
/* Pembaca href                                                        */
/* ------------------------------------------------------------------ */

/** Path tanpa query: `/browse/data-science?topic=x` -> `data-science`. */
function slugTerakhir(href: string): string {
  const jalur = href.split("?")[0];
  return jalur.split("/").filter(Boolean).pop() ?? "";
}

/**
 * Baca satu query param dari href taksonomi.
 *
 * `+` berarti spasi di query string (`?topic=Data+Science`), jadi harus
 * diganti dulu sebelum `decodeURIComponent` — kalau tidak, "Data+Science"
 * tidak akan cocok dengan `p.category` yang berisi spasi asli.
 */
function param(href: string, key: string): string | undefined {
  const query = href.split("?")[1];
  if (!query) return undefined;
  for (const pasangan of query.split("&")) {
    const eq = pasangan.indexOf("=");
    const k = eq === -1 ? pasangan : pasangan.slice(0, eq);
    if (k !== key) continue;
    const v = eq === -1 ? "" : pasangan.slice(eq + 1);
    return decodeURIComponent(v.replace(/\+/g, " "));
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Spec per faset                                                      */
/* ------------------------------------------------------------------ */

type FacetSpec = {
  key: ExploreFacetKey;
  label: string;
  href: string;
  ringkas: string;
  sumber: ExploreItem[];
  /**
   * Hitung jumlah program untuk satu entri taksonomi.
   *
   * WAJIB memakai helper yang sama dengan halaman tujuan, kalau tidak
   * angka di menu akan menyimpang dari angka di halaman — dan itu
   * bentuk lain dari janji yang tidak ditepati.
   */
  hitung: (item: ExploreItem) => number;
};

const SPECS: FacetSpec[] = [
  {
    key: "peran",
    label: "Peran",
    href: "/career-academy",
    ringkas: "Mulai dari posisi yang kamu incar, lalu lihat skill yang paling sering diminta.",
    sumber: ROLES,
    hitung: (item) => getProgramsByRole(slugTerakhir(item.href)).length,
  },
  {
    key: "keterampilan",
    label: "Keterampilan",
    href: "/courses",
    ringkas: "Cari skill, lalu lihat program yang mengajari skill itu.",
    // `TRENDING_SKILLS`, bukan kunci `SKILL_INDEX`: `free` ada di sana dan
    // `getProgramsByQuery('free')` mengembalikan SELURUH katalog karena
    // tidak ada yang cocok (lihat explore-queries.ts). Registry program
    // tidak punya field harga sama sekali, jadi "kursus gratis" belum
    // bisa dijanjikan. `EXPLORE_FALLBACKS.freeCourses` sengaja tidak
    // dipakai di menu sampai ada harga di katalog.
    sumber: TRENDING_SKILLS,
    hitung: (item) => getProgramsByQuery(param(item.href, "query")).length,
  },
  {
    key: "bidang",
    label: "Bidang",
    href: "/browse",
    ringkas: "Pilih bidang yang mau kamu masuki. Daftar program dihitung dari katalog yang benar-benar ada.",
    sumber: CATEGORIES,
    hitung: (item) =>
      getProgramsByCategory(slugTerakhir(item.href), param(item.href, "topic")).length,
  },
  {
    key: "sertifikat",
    label: "Sertifikat",
    href: "/search?productType=Professional+Certificate",
    ringkas: "Sertifikat profesional per bidang, untuk yang mau bukti skill yang setara ijazah.",
    sumber: CERTIFICATES,
    hitung: (item) => {
      const topic = param(item.href, "topic");
      return getProgramsBySearch("Professional Certificate", topic).length;
    },
  },
];

function bangunFaset(): ExploreFacet[] {
  return SPECS.map((spec) => {
    const items: ExploreFacetItem[] = [];
    let tanpaIsi = 0;
    for (const entry of spec.sumber) {
      const jumlah = spec.hitung(entry);
      if (jumlah > 0) items.push({ label: entry.label, href: entry.href, jumlah });
      else tanpaIsi += 1;
    }
    return {
      key: spec.key,
      label: spec.label,
      href: spec.href,
      ringkas: spec.ringkas,
      items,
      tanpaIsi,
    };
  });
}

/**
 * Faset utuh, termasuk yang belum punya isi.
 *
 * `facetAktif` dipilih di sini supaya menu tidak pernah membuka diri ke
 * kolom kosong: kalau semua entri sebuah faset ternyata 0 program, faset
 * itu tidak boleh jadi tampilan pertama.
 */
export const EXPLORE_FACETS: readonly ExploreFacet[] = bangunFaset();

export const FASET_AWAL: ExploreFacetKey =
  EXPLORE_FACETS.find((f) => f.items.length > 0)?.key ?? "peran";

export function cariFaset(key: ExploreFacetKey): ExploreFacet {
  const found = EXPLORE_FACETS.find((f) => f.key === key);
  if (!found) throw new Error(`Faset Explore tidak dikenal: ${key}`);
  return found;
}

/** Semua item, untuk pencarian silang di panel. */
export const ITEM_ALL_FASET: readonly ExploreItemILatar[] = EXPLORE_FACETS.flatMap((f) =>
  f.items.map((item) => ({ ...item, facet: f.key, facetLabel: f.label })),
);

/** Jumlah program di seluruh katalog, untuk kalimat jujur di panel. */
export const TOTAL_PROGRAM = getAllPrograms().length;

/**
 * Normalisasi untuk pencarian: huruf kecil + spasi rapat.
 *
 * "Power BI" harus bisa ditemukan dengan mengetik "powerbi", dan "Data
 * Science" dengan "datascience".
 */
export function normalisasi(teks: string): string {
  return teks.toLowerCase().replace(/\s+/g, "");
}

/** Cari item di seluruh faset. `""` berarti tidak ada query, bukan "tampilkan semua". */
export function cariItem(query: string): ExploreItemILatar[] {
  const q = normalisasi(query);
  if (!q) return [];
  return ITEM_ALL_FASET.filter((i) => normalisasi(i.label).includes(q));
}
