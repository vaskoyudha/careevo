"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Satu baris antrean review — bentuk datar dari `SubmissionStaf` (repository)
 * yang sengaja didefinisikan lokal, bukan diimpor dari
 * `@/lib/review/repository`: komponen ini client, dan modul itu menarik
 * `@/lib/db/client` (driver Postgres) ke bundle browser. Halaman server-lah
 * yang memetakan baris database ke bentuk serializable ini.
 */
export interface ReviewQueueItem {
  id: string;
  ownerNama: string;
  ownerEmail: string;
  /** `submissions.status` — kolom teks dengan CHECK constraint, jadi `string`. */
  status: string;
  currentVersion: number;
  /** ISO string dari kolom timestamp; `null` bila belum pernah disubmit. */
  submittedAt: string | null;
  updatedAt: string;
}

const STATUS_FILTERS = [
  "semua",
  "submitted",
  "assigned",
  "in_review",
  "approved",
  "changes_requested",
  "rejected",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

const FILTER_LABEL: Record<StatusFilter, string> = {
  semua: "Semua",
  submitted: "Menunggu review",
  assigned: "Ditugaskan",
  in_review: "Sedang direview",
  approved: "Disetujui",
  changes_requested: "Revisi",
  rejected: "Ditolak",
};

/** Badge hanya mengerti `revision`; `changes_requested` dipetakan ke sana. */
function statusBadge(status: string): string {
  return status === "changes_requested" ? "revision" : status;
}

/** Timestamp database berupa ISO — `null`/tidak valid ditampilkan "—", bukan tanggal karangan. */
function formatWaktu(nilai: string | null): string {
  if (!nilai) return "—";
  const tanggal = new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(tanggal);
}

export function ReviewQueue({ items }: { items: ReviewQueueItem[] }) {
  const [filter, setFilter] = useState<StatusFilter>("semua");

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
            {FILTER_LABEL[status]}
          </Button>
        ))}
      </div>

      <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {filtered.map((item) => (
          <li className="list-app-row" key={item.id}>
            <a className="row-title" href={`/review/${item.id}`}>
              Submission {item.id.slice(0, 8)}
            </a>
            <span className="row-aside">
              <span className="mono muted">v{item.currentVersion}</span>
              <StatusBadge status={statusBadge(item.status)} />
            </span>
            <span className="row-meta">
              {item.ownerNama} · {item.ownerEmail} · dikirim {formatWaktu(item.submittedAt)} ·
              diperbarui {formatWaktu(item.updatedAt)}
            </span>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? <p className="empty">Antrean kosong untuk filter ini.</p> : null}
    </div>
  );
}
