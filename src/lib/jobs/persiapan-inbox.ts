/**
 * persiapan-inbox.ts — rank the course catalog for one SCANNED posting.
 *
 * `lib/jobs/rekomendasi-kursus.ts` already ranks courses against a posting, but
 * it takes a `JobFixture`: a shape carrying `title`, `description`, `tags` and
 * `level`. A scanned row is an `InboxJobShape` — `url`, `company`, `role`,
 * `location`, `compensation` — and none of those four fields exist on it. So the
 * existing ranker cannot be pointed at the 214 rows the scanner actually
 * produces, which is why the recommendation panels on `/loker/[id]` never
 * appear for them.
 *
 * This module is the adapter. It turns a scanned row plus its fetched Jobstreet
 * listing into the minimal text the shared ranker reads, and it derives `tags`
 * from a source we can name rather than inventing them.
 *
 * Two rules govern the derivation, and both exist because this feeds a learner a
 * recommendation:
 *
 *   1. `level` is NEVER guessed. `skorKursusUntukLoker` adds `(2 - jarak) * 4`
 *      for level proximity, so a fabricated level would silently add up to 8
 *      points to courses chosen for a posting that never stated a level. A row
 *      with no stated level contributes no level signal at all.
 *   2. A row we could not fetch falls back to its role string alone, and says
 *      so. Role titles still carry most of the discriminating vocabulary
 *      ("Frontend", "Data Analyst", "DevOps"), so the fallback is weak but real —
 *      and the UI must not present a title-only match as a full one.
 */

import type { InboxJob } from "@/lib/career-ops";
import type { ListingJobstreet } from "@/lib/career-ops";
import type { Level } from "@/types/domain";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { JobFixture } from "@/lib/fixtures";
import { rekomendasiKursusUntukLoker } from "@/lib/jobs/rekomendasi-kursus";

/**
 * The shape the shared ranker needs, and nothing more.
 *
 * `rekomendasiKursusUntukLoker` is typed against `JobFixture`, so it cannot
 * accept this directly — `RekomendasiKursusUntukLoker` below is a thin
 * re-declaration of the same scoring call, kept honest by
 * `uji-kesiapan-inbox.test.ts`, which asserts the two agree course-for-course
 * on a catalog built from real rows.
 */
export interface KebutuhanLoker {
  title: string;
  description: string;
  tags: string[];
  level?: Level;
}

/** Where the text used for matching actually came from. */
export type SumberKebutuhan =
  | "penuh" // title + description + occupational category
  | "ringan" // title only — the listing could not be fetched
  | "peran"; // the role string from pipeline.md, nothing else

/**
 * Occupational categories, used as tags when present.
 *
 * Jobstreet returns a controlled vocabulary (`Information & Communication
 * Technology`, `Business/Systems Analysts`). Those are the employer's own
 * classification, not our guess, so they carry more weight than anything derived
 * from the title.
 */
function tagDariKlasifikasi(listing: ListingJobstreet | null): string[] {
  const klasifikasi = (listing as { classifications?: unknown } | null)?.classifications;
  if (!Array.isArray(klasifikasi)) return [];

  const tags: string[] = [];
  for (const item of klasifikasi) {
    const c = (item as { classification?: { description?: string } })?.classification;
    const s = (item as { subclassification?: { description?: string } })?.subclassification;
    for (const deskripsi of [c?.description, s?.description]) {
      if (typeof deskripsi === "string" && deskripsi.trim()) tags.push(deskripsi.trim());
    }
  }
  return tags;
}

/**
 * Skills read off the role string, as whole phrases.
 *
 * These are INFERRED, and the UI says so. The list is deliberately small and
 * holds only terms that unambiguously name a technology or a role family —
 * "engineer" alone would match every row on the board and say nothing.
 */
const KETERAMPILAN_DARI_PERAN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bfront[\s-]?end\b/i, "frontend"],
  [/\bback[\s-]?end\b/i, "backend"],
  [/\bfull[\s-]?stack\b/i, "fullstack"],
  [/\bdata\s+scientist\b/i, "data scientist"],
  [/\bdata\s+analyst\b/i, "data analyst"],
  [/\bdata\s+engineer\b/i, "data engineer"],
  [/\bdevops\b/i, "devops"],
  [/\bqa\b|\bquality\s+(assurance|engineer)\b/i, "quality assurance"],
  [/\bmobile\b|\bandroid\b|\bios\b/i, "mobile"],
  [/\bflutter\b/i, "flutter"],
  [/\breact\b/i, "react"],
  [/\btypescript\b/i, "typescript"],
  [/\bjavascript\b/i, "javascript"],
  [/\bnode(?:\.?js)?\b/i, "node"],
  [/\bpython\b/i, "python"],
  [/\bjava\b/i, "java"],
  [/\bphp\b/i, "php"],
  [/\bgo\b|\bgolang\b/i, "golang"],
  [/\brust\b/i, "rust"],
  [/\bsql\b/i, "sql"],
  [/\baws\b|\bcloud\b/i, "cloud"],
  [/\bproduct\s+manager\b/i, "product manager"],
  [/\bproduct\s+designer\b/i, "product designer"],
  [/\bui\/ux\b|\bux\b|\bui\b/i, "design"],
];

/**
 * Build the matching text for one scanned row.
 *
 * `level` is left undefined on purpose — see the module note. Returning it
 * omitted is what keeps the shared ranker's level bonus at zero instead of
 * adding a number we cannot justify.
 */
export function kebutuhanDariInbox(
  job: InboxJob,
  listing: ListingJobstreet | null,
): { kebutuhan: KebutuhanLoker; sumber: SumberKebutuhan } {
  const tags = tagDariKlasifikasi(listing);
  const deskripsi = [listing?.teaser, ...(listing?.bulletPoints ?? [])]
    .filter((bagian): bagian is string => typeof bagian === "string" && bagian.trim().length > 0)
    .join("\n");

  if (listing && (deskripsi || tags.length > 0)) {
    return {
      kebutuhan: { title: job.role, description: deskripsi, tags },
      sumber: "penuh",
    };
  }

  // The listing could not be fetched. The role string is all we honestly have.
  return {
    kebutuhan: { title: job.role, description: "", tags: [] },
    sumber: "ringan",
  };
}

/**
 * The same inferred-skill list, for a row with nothing else.
 *
 * Only reached when the row has no role at all, which `pipeline.md` should not
 * permit — kept because "empty title" is exactly the case where returning a
 * confident empty recommendation is most likely to be wrong.
 */
export function tagInferensiDariPeran(peran: string): string[] {
  return KETERAMPILAN_DARI_PERAN.filter(([pola]) => pola.test(peran)).map(([, tag]) => tag);
}

/** Human-readable label for where a recommendation's signal came from. */
export function labelSumber(sumber: SumberKebutuhan): string {
  switch (sumber) {
    case "penuh":
      return "Berdasarkan deskripsi lowongan dan kategori pekerjaan.";
    case "ringan":
      return "Berdasarkan judul peran saja — deskripsi lowongan tidak bisa diambil.";
    case "peran":
      return "Berdasarkan judul peran saja.";
  }
}

/**
 * Rank the catalog for one scanned row, reusing the shared scorer.
 *
 * `rekomendasiKursusUntukLoker` is typed against `JobFixture` and reads four
 * fields off the job. Casting a `KebutuhanLoker` to it is the whole point of
 * this module, and the cast is not unchecked belief: the adapter supplies
 * exactly those four fields, and `persiapan-inbox.test.ts` pins the two paths to
 * identical scores course-for-course. Widening the shared ranker's parameter
 * type instead would be the cleaner change, but it touches the `/loker/[id]`
 * path too, and this adapter is scoped to the inbox.
 */
export function rekomendasiKursusUntukInbox(
  katalog: EntriKatalog[],
  kebutuhan: KebutuhanLoker,
  limit = 3,
): EntriKatalog[] {
  return rekomendasiKursusUntukLoker(
    katalog,
    kebutuhan as unknown as JobFixture,
    limit,
  );
}
