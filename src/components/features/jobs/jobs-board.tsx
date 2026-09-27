"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, MapPin } from "lucide-react";
import type { JobFixture } from "@/lib/fixtures";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buatFilterKonten } from "@/lib/jobs/filters";
import { teksLoker, uraiKueri } from "@/lib/jobs/kueri-chat";
import { monogram } from "@/lib/jobs/monogram";
import { labelSinyal } from "@/lib/agents/sentinel";
import { ChatCariLowongan } from "@/components/features/jobs/chat-cari-lowongan";

/**
 * One posting.
 *
 * Built on the house card recipe (`CourseCardShell` in
 * `src/components/ui/catalog-course-card.tsx`), which DESIGN.md names as the
 * single card language: a 4:3 media block, a white sheet overlapping it
 * (`-mt-8 rounded-t-2xl`), a `mb-*` vertical rhythm rather than stacked `mt-*`,
 * and a footer closed by a `border-t` with a blue pill on the left. The grid is
 * the reason it works — a full-width row cannot carry a 4:3 media block, and
 * dropping the media is what made the earlier version read as a plain list.
 *
 * The media is the `ThumbMedia` fallback path, not invented artwork: jobs have no
 * photograph, so the tile carries the company monogram over the same gradient the
 * course card uses when a thumbnail is missing.
 *
 * Flags are labelled through `labelSinyal` — never index a label map here, or a
 * signal with no entry reaches the learner as raw snake_case. The verdict strip
 * appears only when there is something to say, and it takes the slot the course
 * card gives its rating row.
 */
function KartuLoker({ job }: { job: JobFixture }) {
  const meta = job.salary_range
    ? `${job.location} · ${job.salary_range}`
    : job.location;

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs transition-shadow duration-200 hover:shadow-md",
        // A flagged posting is tinted, not relabelled: the verdict is already
        // carried by the badge and the strip, and a third signal would be noise.
        job.sentinel_status !== "clean" && "border-amber-200",
      )}
    >
      {/* Media — the monogram tile, with the verdict as the corner pill.

          Deliberately NOT the course card's `aspect-[4/3]`. That ratio exists so a
          photograph is tall enough to read at card size, and a job posting has no
          photograph — at 4:3 this block was 263px of gradient holding two short
          strings, which made every card 435px tall. A fixed height keeps the tile
          legible without the dead space. Same tokens, same gradient, same
          overlap; only the box is shorter. */}
      <div className="relative block h-28 w-full overflow-hidden bg-gray-100 sm:h-32">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-linear-to-br from-[#e2eef4] via-[#ecf3f7] to-[#cbe6ef] px-5">
          <span className="text-2xl font-bold tracking-tight text-[#0a3d62]">
            {monogram(job.company)}
          </span>
          <span className="line-clamp-1 text-center text-[11px] font-medium text-[#0a3d62]/70">
            {job.company}
          </span>
        </div>
        <span className="absolute top-2.5 left-2.5">
          <StatusBadge status={job.sentinel_status} />
        </span>
      </div>

      {/* Sheet — overlaps the media, so its top corners read as rounded. */}
      <div className="relative z-10 -mt-8 flex flex-1 flex-col rounded-t-2xl bg-white p-4">
        <h3 className="mb-1.5 line-clamp-2 min-h-[2.6rem] text-sm font-bold text-gray-900 transition-colors group-hover:text-[#0056D2]">
          {/* `text-inherit` is load-bearing: globals.css sets `a { color:
              var(--info) }`, which beats inheritance, so without it the title
              renders blue at rest and the h3's gray-900 / hover-blue pair above
              never applies. */}
          <Link href={`/loker/${job.id}`} className="text-inherit hover:no-underline">
            {job.title}
          </Link>
        </h3>

        <p className="mb-3 flex items-center gap-1.5 text-[11px] text-gray-500">
          <MapPin className="size-3 shrink-0 text-gray-400" aria-hidden />
          <span className="truncate">{meta}</span>
        </p>

        {/* Why it was flagged, in the slot the course card gives its rating row. */}
        {job.flags.length > 0 ? (
          <p className="mb-3 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900">
            <AlertTriangle className="mt-px size-3 shrink-0 text-amber-600" aria-hidden />
            <span>{job.flags.map(labelSinyal).join(" · ")}</span>
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
          {job.tags[0] ? (
            <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0056D2]">
              {job.tags[0]}
            </span>
          ) : (
            <span aria-hidden="true" />
          )}
          {/* Provenance is identical on every row, so it yields the bold slot to
              the one number that differs between postings. */}
          <span className="truncate text-xs font-semibold text-gray-700">via {job.source}</span>
        </div>
      </div>
    </article>
  );
}

export function JobsBoard({
  jobs,
  searchQuery,
  onSearchQueryChange,
}: {
  jobs: JobFixture[];
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
}) {
  const [internalKueri, setInternalKueri] = useState("");
  const kueri = searchQuery !== undefined ? searchQuery : internalKueri;
  const setKueri = onSearchQueryChange ?? setInternalKueri;

  // Free-text search via the ported content filter, one filter per term and
  // requiring ALL of them. `buatFilterKonten` OR-s its own keyword list, which is
  // right for a coarse screen but wrong for a sentence — see `kueri-chat.ts` for
  // the two measured ways it misbehaves. The rule stays single-sourced: this
  // only decides how many times to call it.
  const filterKonten = useMemo(() => {
    const perTerm = uraiKueri(kueri).map((term) => buatFilterKonten({ positive: [term] }));
    if (perTerm.length === 0) return null;
    return (job: JobFixture) => {
      const teks = teksLoker(job);
      return perTerm.every((f) => f(teks));
    };
  }, [kueri]);

  const filtered = useMemo(
    () => (filterKonten ? jobs.filter((job) => filterKonten(job)) : jobs),
    [jobs, filterKonten],
  );

  const adaChat = kueri.trim().length > 0;

  return (
    <div className="space-y-8">
      {/* Chat composer — the primary control, above everything. */}
      <ChatCariLowongan nilai={kueri} onChange={setKueri} hasil={filtered.length} />

      {/* Results */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500">
          <p className="caption muted">
            Menampilkan <strong className="font-semibold text-gray-900">{filtered.length}</strong> dari {jobs.length} loker.
          </p>
          {adaChat ? (
            <button
              type="button"
              onClick={() => setKueri("")}
              className="rounded-full px-2.5 py-1 font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              Hapus pencarian
            </button>
          ) : null}
        </div>

        {/* A grid, not a full-width list: the card's media block is what carries
            the design, and a 4:3 tile has no room in a 1190px row. */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job) => (
            <KartuLoker key={job.id} job={job} />
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
            {adaChat ? (
              <>
                Tidak ada loker untuk &ldquo;{kueri.trim()}&rdquo;.
                <button
                  type="button"
                  onClick={() => setKueri("")}
                  className="ml-1 font-medium text-[#388AF3] underline underline-offset-2"
                >
                  Hapus pencarian
                </button>
              </>
            ) : (
              "Belum ada lowongan yang bisa ditampilkan."
            )}
          </div>
        ) : null}
      </div>

      {/* The way to the full, scanned board.
          These cards are the small audited KarirHub set; the web-wide scan lives
          at `/loker/inbox` and is hundreds of postings, so the chat here can
          never be the whole product. `variant="brand"` is the hero's own button —
          DESIGN.md makes `--brand-grad` the single source for it, and the
          `ocean` variant is the flat product control for learner surfaces. */}
      <div className="flex flex-col items-center gap-3 border-t border-gray-100 pt-8 text-center">
        <Button asChild variant="brand" size="pill" className="gap-2">
          <Link href="/loker/inbox">
            <span>Lihat semua lowongan hasil pindai</span>
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        <p className="max-w-md text-xs text-gray-500">
          Lowongan di atas adalah hasil audit Sentinel dari KarirHub. Halaman lowongan
          ditemukan memindai papan publik lain — Glints, Jobstreet, dan ATS perusahaan.
        </p>
      </div>
    </div>
  );
}
