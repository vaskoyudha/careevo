"use client";

import { useMemo, useState } from "react";
import type { ResourceFixture } from "@/lib/fixtures";
import { levelLabel, tipeLabel } from "@/lib/onboarding/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const LEVELS = ["semua", "dasar", "menengah", "lanjut"] as const;

export function ResourceList({ resources }: { resources: ResourceFixture[] }) {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("semua");
  const [onlyFree, setOnlyFree] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(resources.map((resource) => [resource.id, resource.completed])),
  );

  const filtered = useMemo(
    () =>
      resources.filter((resource) => {
        if (level !== "semua" && resource.level !== level) return false;
        if (onlyFree && !resource.is_free) return false;
        return true;
      }),
    [resources, level, onlyFree],
  );

  const completedCount = Object.values(done).filter(Boolean).length;

  return (
    <div>
      <div className="editor-toolbar" role="group" aria-label="Filter resource" style={{ marginBottom: "1rem" }}>
        {LEVELS.map((item) => (
          <Button
            key={item}
            type="button"
            variant="ghost"
            size="sm"
            className={cn("tab-btn", level === item && "is-active")}
            aria-pressed={level === item}
            onClick={() => setLevel(item)}
          >
            {item}
          </Button>
        ))}
        <span className="tab-btn" style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
          <Checkbox
            checked={onlyFree}
            onCheckedChange={(value) => setOnlyFree(value === true)}
          />
          Gratis saja
        </span>
      </div>

      <p className="caption muted" style={{ marginBottom: "1rem" }}>
        Progres modul: {completedCount}/{resources.length} selesai
      </p>

      <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {filtered.map((resource) => (
          <li className="list-app-row" key={resource.id}>
            <a className="row-title" href={resource.url} target="_blank" rel="noreferrer">
              {resource.title}
            </a>
            <span className="row-aside">
              <span className="tag">{levelLabel(resource.level)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn("tab-btn", done[resource.id] && "is-active")}
                aria-pressed={done[resource.id]}
                onClick={() => setDone((prev) => ({ ...prev, [resource.id]: !prev[resource.id] }))}
              >
                {done[resource.id] ? "Selesai" : "Tandai"}
              </Button>
            </span>
            <span className="row-meta">
              {resource.provider} · {tipeLabel(resource.type)} · {resource.duration_min} menit
              {resource.is_free ? "" : " · berbayar"}
            </span>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? <p className="empty">Tidak ada resource untuk filter ini.</p> : null}
    </div>
  );
}
