"use client";

import { useMemo, useState } from "react";
import type { ReviewQueueItem } from "@/lib/fixtures";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = ["semua", "waiting_review", "waiting_socrates"] as const;

export function ReviewQueue({ items }: { items: ReviewQueueItem[] }) {
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("semua");

  const filtered = useMemo(
    () => (filter === "semua" ? items : items.filter((item) => item.status === filter)),
    [items, filter],
  );

  return (
    <div>
      <div className="editor-toolbar" role="group" aria-label="Filter antrean" style={{ marginBottom: "1rem" }}>
        {STATUS_FILTERS.map((status) => (
          <Button
            key={status}
            type="button"
            variant="ghost"
            size="sm"
            className={cn("tab-btn", filter === status && "is-active")}
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
          >
            {status === "semua" ? "Semua" : status === "waiting_review" ? "Menunggu review" : "Menunggu Socrates"}
          </Button>
        ))}
      </div>

      <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {filtered.map((item) => (
          <li className="list-app-row" key={item.id}>
            <a className="row-title" href={`/review/${item.id}`}>
              {item.task_title}
            </a>
            <span className="row-aside">
              <span className="mono muted">VTS {item.vts_score}</span>
              <StatusBadge status={item.status} />
            </span>
            <span className="row-meta">
              @{item.username} · {item.track} · {item.level} · {item.submitted_at} ·{" "}
              {item.socrates_answered ? "Socrates dijawab" : "Socrates belum"}
            </span>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? <p className="empty">Antrean kosong untuk filter ini.</p> : null}
    </div>
  );
}
