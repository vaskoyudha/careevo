/**
 * faset-inbox.ts — the facets the lowongan search surface offers: city, role
 * category, and sort order.
 *
 * Pure and derived, like the rest of `src/lib/jobs`: `InboxList` already holds
 * every scanned row on the client, so a facet must not need a second fetch. It
 * is also why nothing here is stored — a facet is a reading of the rows, and a
 * stored copy would silently go stale the moment the engine appends a line to
 * `pipeline.md`.
 *
 * The two normalizations exist because the raw fields are not facets:
 *
 *  - `location` is a free string written by whichever portal the posting came
 *    from. Measured on the dev data root, 257 rows carried well over a hundred
 *    distinct values for what is really a handful of cities: "Jakarta",
 *    "South Jakarta, Jakarta", "Jakarta, ID", "Kota Jakarta Barat",
 *    "Kecamatan Tebet, Daerah Khusus Ibukota Jakarta, Indonesia". A select over
 *    that is unusable, so `kotaDariLokasi` drops the administrative noise
 *    (district, city admin, regency, province, country) and keeps the city.
 *
 *  - `role` is a job title, not a taxonomy. `kategoriUntukPeran` maps it with an
 *    ordered keyword list, so an unrecognized title lands in the general bucket
 *    rather than vanishing — a select that silently drops rows is worse than one
 *    that admits it does not know the label. The order IS the contract: "Full
 *    Stack" is tested before "frontend" and "backend" because a fullstack title
 *    contains neither of those two words, but a title that says both must be
 *    counted once, under the more specific one.
 *
 * Neither function decides anything about a learner. They choose which rows a
 * select shows, and every value they return is one a posting actually carries —
 * there is no score, no eligibility, and no LLM anywhere on this path.
 */

import type { InboxJob } from "@/lib/career-ops";

/** The bucket a title we do not specifically recognize falls into. */
export const KATEGORI_LAINNYA = "Teknologi";

/**
 * The facet list, in the order a select shows it. The order is hand-chosen for
 * a reader — biggest buckets first on the data we have — not an accident of the
 * keyword list, so the two are kept together on purpose: reordering the
 * categories here is a product decision, and reordering `KATEGORI_PERAN` is not.
 */
export const KATEGORI: readonly string[] = [
  "Fullstack",
  "Frontend & Web",
  "Backend & API",
  "Mobile & Apps",
  "Data & Analytics",
  "DevOps & Infrastruktur",
  "QA & Pengujian",
  "Product & Desain",
  KATEGORI_LAINNYA,
];

/** `Remote` is a value the data carries, not a fallback — it wins over any city. */
export const KOTA_REMOTE = "Remote";
/** The bucket for a location we could not read a city out of. */
export const KOTA_LAINNYA = "Lainnya";

/**
 * Cities, keyed by the lowercase token that identifies them.
 *
 * Deliberately a list of *Indonesian* cities: a portal writes the city in the
 * language of the country, so an English list would leave every row unmatched and
 * collapse the whole facet into "Lainnya". Jakarta is listed once because every
 * variant we measured ("South Jakarta", "Jakarta Selatan", "Kota Jakarta Barat",
 * "Daerah Khusus Ibukota Jakarta", "South Jakarta City") contains that token.
 */
const KOTA: Readonly<Record<string, string>> = {
  jakarta: "Jakarta",
  bandung: "Bandung",
  surabaya: "Surabaya",
  tangerang: "Tangerang",
  bekasi: "Bekasi",
  depok: "Depok",
  bogor: "Bogor",
  cimahi: "Cimahi",
  yogyakarta: "Yogyakarta",
  jogja: "Yogyakarta",
  semarang: "Semarang",
  magelang: "Magelang",
  malang: "Malang",
  denpasar: "Denpasar",
  makassar: "Makassar",
  medan: "Medan",
  padang: "Padang",
  Pekanbaru: "Pekanbaru",
  palembang: "Palembang",
  balikpapan: "Balikpapan",
  samarinda: "Samarinda",
  manado: "Manado",
  kupang: "Kupang",
  pontianak: "Pontianak",
  banjarmasin: "Banjarmasin",
  palangkaraya: "Palangkaraya",
  purwakarta: "Purwakarta",
  batam: "Batam",
  tasikmalaya: "Tasikmalaya",
  sukabumi: "Sukabumi",
  dumai: "Dumai",
  cirebon: "Cirebon",
};

/**
 * Words that are part of an Indonesian address but name no city on their own.
 * Only consulted *after* the city list misses, so dropping one from here can
 * never override a real city — a row that says "Jakarta, ID" is still Jakarta.
 */
const BUKAN_KOTA = new Set([
  "indonesia",
  "id",
  "jawa",
  "java",
  "bali",
  "sumatera",
  "sumatra",
  "sulawesi",
  "kalimantan",
  "papua",
  "nusantara",
  "regency",
  "special region",
  "wilayah",
  "daerah",
  "kota",
  "kabupaten",
  "kecamatan",
  "kelurahan",
  "provinsi",
  "province",
]);

/**
 * The city a posting sits in, or `KOTA_LAINNYA` when the string names no city we
 * know.
 *
 * Remote is checked first because a remote posting often carries a nominal city
 * too ("Remote — Jakarta"), and the work arrangement is the thing a learner
 * filters on.
 */
export function kotaDariLokasi(location: string | undefined | null): string {
  const teks = (location ?? "").trim();
  if (!teks) return KOTA_LAINNYA;

  if (/\b(remote|remotely|work from home|wfh)\b/i.test(teks)) return KOTA_REMOTE;

  const bagian = teks.split(",").map((b) => b.trim().toLowerCase());

  for (const segmen of bagian) {
    const kota = Object.keys(KOTA).find((token) => containsKata(segmen, token));
    if (kota) return KOTA[kota];
  }

  // Tidak ada kota yang dikenali. Segmen pertama yang bukan administrative noise
  // adalah nama yang paling mungkin masih kota — "Kepulauan Seribu", misalnya.
  const sisa = bagian.find((segmen) => segmen && !BUKAN_KOTA.has(segmen));
  return sisa ? judulkan(sisa) : KOTA_LAINNYA;
}

/** `kotaDariLokasi` with a readability pass: "kota jakarta barat" → "Kota Jakarta Barat". */
function judulkan(teks: string): string {
  return teks.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Word-boundary containment.
 *
 * Plain `includes` is what breaks this module: `\b` is what keeps "java" from
 * matching "javascript" and "test" from matching "latest", so a title of
 * "Software Engineer Javascript" is not counted as Java.
 */
function containsKata(teks: string, token: string): boolean {
  return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(teks);
}

/**
 * Keyword lists per category, checked in this order. The order is the contract,
 * not an implementation detail — see the note on `KATEGORI`.
 */
const KATEGORI_PERAN: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    "Fullstack",
    ["fullstack", "full stack", "full-stack", "fullstck", "end to end", "e2e engineer"],
  ],
  ["Mobile & Apps", ["mobile", "android", "ios", "iphone", "flutter", "react native", "kotlin", "swift"]],
  [
    "Data & Analytics",
    ["data", "analyst", "analytics", "scientist", "machine learning", "big data", "business intelligence"],
  ],
  [
    "DevOps & Infrastruktur",
    [
      "devops",
      "sre",
      "site reliability",
      "cloud",
      "infrastructure",
      "infra",
      "sysadmin",
      "system administrator",
      "systems engineer",
      "platform engineer",
      "kubernetes",
      "docker",
      "network",
    ],
  ],
  ["QA & Pengujian", ["qa", "quality assurance", "quality engineer", "tester", "testing", "sqa"]],
  [
    "Product & Desain",
    ["product", "designer", "design", "ux", "ui/ux", "scrum", "product owner", "project manager"],
  ],
  [
    "Frontend & Web",
    [
      "frontend",
      "front-end",
      "front end",
      "web",
      "ui engineer",
      "react",
      "vue",
      "angular",
      "svelte",
      "css",
      "html",
      "wordpress",
    ],
  ],
  [
    "Backend & API",
    [
      "backend",
      "back-end",
      "back end",
      "api",
      "microservice",
      "node",
      "node.js",
      "java",
      "php",
      "python",
      "golang",
      "dotnet",
      ".net",
      "spring",
      "laravel",
      "symfony",
      "express",
    ],
  ],
];

/**
 * The bucket a job title belongs to.
 *
 * An empty or unrecognized title is `KATEGORI_LAINNYA` rather than a guess: the
 * general bucket is visible in the select, so a reader can see that the rows
 * they are looking at were not classified — which is a different thing from
 * those rows being hidden.
 */
export function kategoriUntukPeran(role: string | undefined | null): string {
  const teks = (role ?? "").trim();
  if (!teks) return KATEGORI_LAINNYA;

  for (const [kategori, token] of KATEGORI_PERAN) {
    if (token.some((t) => containsKata(teks, t))) return kategori;
  }
  return KATEGORI_LAINNYA;
}

/** The minimum a row needs for the facets above; keeps this module off the fs. */
export type BarisFaset = Pick<InboxJob, "url" | "role" | "location" | "company"> & {
  /** `YYYY-MM-DD`, from the row's own `posted:` label or the first scan that saw it. */
  firstSeen?: string;
};

export const URUTAN = [
  { nilai: "terbaru", label: "Terbaru" },
  { nilai: "terlama", label: "Terlama" },
  { nilai: "peran", label: "Peran (A–Z)" },
] as const;

export type NilaiUrutan = (typeof URUTAN)[number]["nilai"];

export function labelUrutan(nilai: NilaiUrutan): string {
  return URUTAN.find((u) => u.nilai === nilai)?.label ?? URUTAN[0].label;
}

/**
 * Rows in the order the select promises.
 *
 * A row with no date sorts last in *both* directions rather than being treated
 * as the oldest: "newest first" with undated rows pinned to the top would claim
 * they are the freshest, which is the one claim this surface must not make up.
 */
export function urutkanBaris<T extends BarisFaset>(baris: T[], urutan: NilaiUrutan): T[] {
  const salinan = [...baris];
  if (urutan === "peran") {
    return salinan.sort((a, b) =>
      (a.role ?? "").localeCompare(b.role ?? "", "id", { sensitivity: "base" }),
    );
  }
  const arah = urutan === "terlama" ? 1 : -1;
  return salinan.sort((a, b) => {
    const tglA = a.firstSeen ?? "";
    const tglB = b.firstSeen ?? "";
    if (!tglA && !tglB) return 0;
    if (!tglA) return 1;
    if (!tglB) return -1;
    return tglA.localeCompare(tglB) * arah;
  });
}

/** Distinct cities present in the rows, alphabetically, for the location select. */
export function daftarKota(baris: BarisFaset[]): string[] {
  const kota = new Set(baris.map((b) => kotaDariLokasi(b.location)));
  return [...kota].sort((a, b) => a.localeCompare(b, "id"));
}

/**
 * Categories present in the rows, in `KATEGORI` order.
 *
 * Only categories that actually occur are offered: a select whose options are
 * hard-coded will show "DevOps & Infrastruktur" over a corpus with no DevOps
 * posting, and clicking it then returns nothing — a dead control that looks
 * alive.
 */
export function daftarKategori(baris: BarisFaset[]): string[] {
  const ada = new Set(baris.map((b) => kategoriUntukPeran(b.role)));
  return KATEGORI.filter((k) => ada.has(k));
}

/**
 * Distinct companies present in the rows, alphabetically, for the company select.
 *
 * Read off the rows rather than from `portals.yml`, for the same reason
 * `daftarKota` is: the config names the SOURCES, while this names the EMPLOYERS
 * that actually produced a row. A company whose board returned nothing is
 * therefore never offered as a filter that would then return zero — a dead
 * control that looks alive.
 *
 * Not normalized the way `kotaDariLokasi` is: a company name has no
 * administrative noise to strip, and collapsing "PT X" with "X" would merge two
 * employers a reader can tell apart.
 */
export function daftarPerusahaan(baris: BarisFaset[]): string[] {
  const perusahaan = new Set(
    baris.map((b) => (b.company ?? "").trim()).filter((nama) => nama.length > 0),
  );
  return [...perusahaan].sort((a, b) => a.localeCompare(b, "id"));
}

/**
 * Rows the engine first recorded today, in the posting's own `firstSeen` date.
 *
 * "Hari ini" is read in the server's local day and compared as a string, because
 * `firstSeen` is a `YYYY-MM-DD` label rather than an instant: there is no time
 * component to convert, and treating one as a timezone would move a posting
 * across the day boundary for no reason.
 */
export function hitungBarisHariIni(baris: BarisFaset[], hariIni: string): number {
  return baris.filter((b) => b.firstSeen === hariIni).length;
}
