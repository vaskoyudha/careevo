"use client";

import { useMemo, useState } from "react";
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
    <div>
      <div className="editor-toolbar" role="group" aria-label="Filter lokasi" style={{ marginBottom: "0.5rem" }}>
        {LOCATIONS.map((item) => (
          <Button
            key={item}
            type="button"
            variant="ghost"
            size="sm"
            className={cn("tab-btn", location === item && "is-active")}
            aria-pressed={location === item}
            onClick={() => setLocation(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      <div className="editor-toolbar" role="group" aria-label="Filter gaji" style={{ marginBottom: "0.5rem" }}>
        {GAJI.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            size="sm"
            className={cn("tab-btn", gaji === item.id && "is-active")}
            aria-pressed={gaji === item.id}
            onClick={() => setGaji(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <Input
          type="search"
          value={kueri}
          onChange={(event) => setKueri(event.target.value)}
          placeholder="Cari kata kunci: React, Node.js, testing…"
          aria-label="Cari loker"
        />
      </div>

      <div
        className="editor-toolbar"
        role="group"
        aria-label="Filter kualitas"
        style={{ marginBottom: "1rem", gap: "1rem" }}
      >
        <span className="tab-btn" style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
          <Checkbox checked={noFee} onCheckedChange={(value) => setNoFee(value === true)} />
          Tanpa sinyal fee
        </span>
        <span className="tab-btn" style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
          <Checkbox checked={onlyClean} onCheckedChange={(value) => setOnlyClean(value === true)} />
          Loker AMAN saja
        </span>
      </div>

      <p className="caption muted" style={{ marginTop: 0 }}>
        Menampilkan {filtered.length} dari {jobs.length} loker.
      </p>

      <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {filtered.map((job) => (
          <li className="list-app-row" key={job.id}>
            <a className="row-title" href={`/loker/${job.id}`}>
              {job.title}
            </a>
            <span className="row-aside">
              <StatusBadge status={job.sentinel_status} />
            </span>
            <span className="row-meta">
              {job.company} · {job.location}
              {job.salary_range ? ` · ${job.salary_range}` : ""} · {job.source}
            </span>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? <p className="empty">Tidak ada loker untuk filter ini.</p> : null}
    </div>
  );
}
