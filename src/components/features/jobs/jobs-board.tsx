"use client";

import { useMemo, useState } from "react";
import type { JobFixture } from "@/lib/fixtures";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const LOCATIONS = ["semua", "Jakarta", "Bandung", "Remote", "Yogyakarta", "Surabaya", "Semarang"] as const;

export function JobsBoard({ jobs }: { jobs: JobFixture[] }) {
  const [location, setLocation] = useState<(typeof LOCATIONS)[number]>("semua");
  const [onlyClean, setOnlyClean] = useState(false);

  const filtered = useMemo(
    () =>
      jobs.filter((job) => {
        if (location !== "semua" && !job.location.toLowerCase().includes(location.toLowerCase())) return false;
        if (onlyClean && job.sentinel_status !== "clean") return false;
        return true;
      }),
    [jobs, location, onlyClean],
  );

  return (
    <div>
      <div className="editor-toolbar" role="group" aria-label="Filter loker" style={{ marginBottom: "1rem" }}>
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
        <span className="tab-btn" style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
          <Checkbox
            checked={onlyClean}
            onCheckedChange={(value) => setOnlyClean(value === true)}
          />
          Loker AMAN saja
        </span>
      </div>

      <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {filtered.map((job) => (
          <li className="list-app-row" key={job.id}>
            <a className="row-title" href={`/loker/${job.id}`}>
              {job.title}
            </a>
            <span className="row-aside">
              {job.fit_score !== null ? <span className="mono muted">Fit {job.fit_score}</span> : null}
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
