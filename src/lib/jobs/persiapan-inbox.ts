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
import { normalisasiKunciUrl } from "@/lib/career-ops";
import type { EntriCache } from "@/lib/career-ops/job-cache";
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
 * Build the matching text for one scanned row from its cache entry.
 *
 * `level` is left undefined on purpose — see the module note. Returning it
 * omitted is what keeps the shared ranker's level bonus at zero instead of
 * adding a number we cannot justify.
 *
 * This used to take a `ListingJobstreet`, which is why the recommendation
 * panels only ever worked for Jobstreet rows. It now takes the board-agnostic
 * `EntriCache`, so a Kalibrr or Dealls description ranks exactly like a
 * Jobstreet one.
 */
export function kebutuhanDariInbox(
  job: InboxJob,
  entri: EntriCache | null,
): { kebutuhan: KebutuhanLoker; sumber: SumberKebutuhan } {
  const tags = entri?.tags ?? [];
  const deskripsi = entri?.bahan.description ?? "";

  if (entri && (deskripsi.trim() || tags.length > 0)) {
    return {
      kebutuhan: { title: job.role, description: deskripsi, tags },
      sumber: "penuh",
    };
  }

  // Nothing in the cache. The role string is all we honestly have.
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

/**
 * A stable id for one scanned posting.
 *
 * `mastery_topics.jobId` is what makes "one active path per posting" work
 * (`buatJalurLokerAction` looks up an existing topic by it before creating). A
 * scanned row has no fixture id, and using the raw URL would put a 200-character
 * string in an id column and in every `pointIdLoker` string. This is the
 * normalized URL reduced to a short deterministic hash: same posting, same id,
 * on every machine, with no database round-trip to find out.
 *
 * Not a security token — it identifies a posting, it does not authenticate one.
 */
export function idLokerDariUrl(url: string): string {
  const kunci = normalisasiKunciUrl(url) || url.trim();
  // FNV-1a 32-bit. Short, stable, and dependency-free; a collision would merge
  // two postings' paths, which is why the full normalized URL is the seed
  // rather than a truncated one.
  let hash = 0x811c9dc5;
  for (let i = 0; i < kunci.length; i += 1) {
    hash ^= kunci.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `inbox-${hash.toString(16).padStart(8, "0")}`;
}

/**
 * The `JobFixture` the shared agents already expect.
 *
 * `jelaskanKursus` and `susunJalurLoker` both read `title`, `company`, `tags`
 * and `description`. Supplying them from a scanned row is what lets the inbox
 * reuse the existing explanation and path builders verbatim instead of forking
 * a second prompt for the same job.
 *
 * `sentinel_status` comes from the server-side audit, never from the client —
 * `buatJalurLokerAction` refuses a `rejected` posting, and that guard has to be
 * re-derivable here rather than believed.
 */
export function sebagaiJobFixture(
  baris: InboxJob,
  kebutuhan: KebutuhanLoker,
  status: "clean" | "quarantined" | "rejected",
): JobFixture {
  return {
    title: kebutuhan.title || baris.role,
    company: baris.company,
    description: kebutuhan.description,
    tags: kebutuhan.tags,
    location: baris.location ?? "",
    sentinel_status: status,
  } as unknown as JobFixture;
}
