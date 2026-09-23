"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Building2,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { JobFixture } from "@/lib/fixtures";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buatFilterGaji, buatFilterKonten, buatFilterLokasi, parseRentangGaji } from "@/lib/jobs/filters";

const LOCATIONS = ["semua", "Jakarta", "Bandung", "Remote", "Yogyakarta", "Surabaya", "Semarang"] as const;

/**
 * Salary bands, in IDR. Chips rather than a slider: the fixture salary strings
 * ("Rp6-8 jt") are coarse, so a numeric slider would imply precision the data
 * does not have.
 */
const GAJI = [
  { id: "semua", label: "Semua gaji", min: 0, max: 0 },
  { id: "lt7", label: "< Rp7 jt", min: 0, max: 7_000_000 },
  { id: "7-10", label: "Rp7–10 jt", min: 7_000_000, max: 10_000_000 },
  { id: "gt10", label: "> Rp10 jt", min: 10_000_000, max: 0 },
] as const;

type GajiId = (typeof GAJI)[number]["id"];

export function JobsBoard({ jobs }: { jobs: JobFixture[] }) {
  const [location, setLocation] = useState<(typeof LOCATIONS)[number]>("semua");
  const [gaji, setGaji] = useState<GajiId>("semua");
  const [kueri, setKueri] = useState("");
  const [onlyClean, setOnlyClean] = useState(false);
  const [noFee, setNoFee] = useState(false);

  const filterLokasi = useMemo(
    () => buatFilterLokasi(location === "semua" ? null : { allow: [location] }),
    [location],
  );

  const band = GAJI.find((g) => g.id === gaji) ?? GAJI[0];
  const filterGaji = useMemo(
    () =>
      buatFilterGaji(
        band.min === 0 && band.max === 0 ? null : { min: band.min, max: band.max, currency: "IDR" },
      ),
    [band.min, band.max],
  );

  // Free-text search over the description + title, via the ported content filter.
  // Whitespace-separated terms are OR-ed (upstream's `positive` semantics).
  const kataKueri = useMemo(() => kueri.trim().toLowerCase().split(/\s+/).filter(Boolean), [kueri]);
  const filterKonten = useMemo(
    () => buatFilterKonten(kataKueri.length === 0 ? null : { positive: kataKueri }),
    [kataKueri],
  );

  const filtered = useMemo(
    () =>
      jobs.filter((job) => {
        if (!filterLokasi(job.location)) return false;
        if (!filterGaji(parseRentangGaji(job.salary_range))) return false;
        // `noFee` reads the AUDIT VERDICT, not the description text. The verdict
        // already encodes every fee rule plus the email/domain/trust signals, so
        // re-scanning the text here would be a second, drift-prone definition of
        // "fee" living in the UI.
        if (noFee && job.fee_flags.length > 0) return false;
        if (onlyClean && job.sentinel_status !== "clean") return false;
        if (!filterKonten(`${job.title} ${job.description}`)) return false;
        return true;
      }),
    [jobs, filterLokasi, filterGaji, filterKonten, noFee, onlyClean],
  );

  return (
    <div className="space-y-6">
      {/* Search Input Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          value={kueri}
          onChange={(event) => setKueri(event.target.value)}
          placeholder="Cari kata kunci: React, Node.js, Frontend, Security…"
          aria-label="Cari loker"
          className="h-12 w-full rounded-xl border-gray-200 bg-gray-50/50 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#388AF3] focus:bg-white focus:ring-2 focus:ring-[#388AF3]/20"
        />
      </div>

      {/* Filter Row 1: Locations */}
      <div className="space-y-2">
        <span className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Lokasi Kerja
        </span>
        <div
          className="editor-toolbar flex flex-wrap gap-2"
          role="group"
          aria-label="Filter lokasi"
        >
          {LOCATIONS.map((item) => {
            const isActive = location === item;
            return (
              <Button
                key={item}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "tab-btn h-8 rounded-full px-3.5 text-xs font-medium transition-all capitalize",
                  isActive
                    ? "is-active bg-gray-900 text-white hover:bg-gray-800"
                    : "bg-gray-100/80 text-gray-600 hover:bg-gray-200/80",
                )}
                aria-pressed={isActive}
                onClick={() => setLocation(item)}
              >
                {item}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Filter Row 2: Salary Range */}
      <div className="space-y-2">
        <span className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Rentang Gaji
        </span>
        <div
          className="editor-toolbar flex flex-wrap gap-2"
          role="group"
          aria-label="Filter gaji"
        >
          {GAJI.map((item) => {
            const isActive = gaji === item.id;
            return (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "tab-btn h-8 rounded-full px-3.5 text-xs font-medium transition-all",
                  isActive
                    ? "is-active bg-gray-900 text-white hover:bg-gray-800"
                    : "bg-gray-100/80 text-gray-600 hover:bg-gray-200/80",
                )}
                aria-pressed={isActive}
                onClick={() => setGaji(item.id)}
              >
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Filter Row 3: Security & Quality Badges */}
      <div
        className="editor-toolbar flex flex-wrap items-center gap-3 pt-2"
        role="group"
        aria-label="Filter kualitas"
      >
        <label
          className={cn(
            "tab-btn inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors",
            noFee
              ? "border-[#388AF3] bg-blue-50/70 text-[#388AF3]"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
          )}
        >
          <Checkbox checked={noFee} onCheckedChange={(value) => setNoFee(value === true)} />
          <span>Tanpa sinyal fee</span>
        </label>

        <label
          className={cn(
            "tab-btn inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors",
            onlyClean
              ? "border-emerald-500 bg-emerald-50/70 text-emerald-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
          )}
        >
          <Checkbox checked={onlyClean} onCheckedChange={(value) => setOnlyClean(value === true)} />
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span>Loker AMAN saja</span>
          </span>
        </label>
      </div>

      {/* Results Header Count */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-500">
        <p className="caption muted">
          Menampilkan <strong className="font-semibold text-gray-900">{filtered.length}</strong> dari {jobs.length} loker.
        </p>
      </div>

      {/* Job Postings List */}
      <ul className="list-app space-y-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {filtered.map((job) => (
          <li
            key={job.id}
            className="list-app-row group rounded-xl border border-gray-200/80 bg-white p-4 sm:p-5 transition-all hover:border-[#388AF3]/60 hover:shadow-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1.5">
                <Link
                  href={`/loker/${job.id}`}
                  className="row-title block text-base sm:text-lg font-semibold text-gray-900 transition-colors group-hover:text-[#388AF3]"
                >
                  {job.title}
                </Link>

                <div className="row-meta flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
                    <Building2 className="size-3.5 text-gray-400" />
                    {job.company}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-gray-400" />
                    {job.location}
                  </span>
                  {job.salary_range ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <Banknote className="size-3.5 text-emerald-600" />
                      {job.salary_range}
                    </span>
                  ) : null}
                  <span className="text-gray-400">· Sumber: {job.source}</span>
                </div>
              </div>

              <div className="row-aside flex items-center justify-end">
                <StatusBadge status={job.sentinel_status} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <div className="empty rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          Tidak ada loker untuk filter ini.
        </div>
      ) : null}
    </div>
  );
}
