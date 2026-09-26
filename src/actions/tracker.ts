"use server";

/**
 * tracker.ts — server actions for the loker detail page's tracker section.
 *
 * Read path: a server component (the detail page) calls `ambilStatusLamaran`
 * during render to learn which tracker row — if any — describes this posting,
 * and passes the result to the client TrackerLoker component.
 *
 * Write path: `ubahStatusLamaran` is the ONLY way Careevo changes a canonical
 * status. It delegates to the engine's `set-status.mjs` (via
 * `src/lib/career-ops/tracker.ts`) — the single locked, validated, atomic write
 * path — and selects the row with `--row N`, so the write can only land on the
 * row the user saw. It never adds rows (new rows go through the report→TSV→
 * merge flow in `evaluasi.ts`), and it never edits applications.md by hand.
 *
 * Both are auth-gated: the tracker is the signed-in user's job-search data, and
 * a server action is a public endpoint that cannot rely on the page that
 * happened to render it.
 */

import { getSession } from "@/lib/auth/session";
import { ambilLokerById } from "@/lib/jobs/cache";
import {
  bacaTrackerMd,
  bootstrapCareerOps,
  cariBarisTracker,
  statusKanonis,
  ubahStatus,
  type BarisTracker,
} from "@/lib/career-ops";

export interface StatusLamaran {
  /** The matched tracker row, when this posting is already tracked. */
  baris: BarisTracker | null;
  /** "Loker tidak ditemukan" style message for render fallbacks. */
  pesan?: string;
}

/**
 * Resolve this posting's tracker row for display.
 *
 * `bootstrapCareerOps()` runs first so a fresh data root still answers with an
 * empty row set (the tracker file seeds without overwriting). Without it the
 * engine reports "no tracker" and the UI would treat every first visit as a
 * broken pipeline.
 */
export async function ambilStatusLamaran(jobId: string): Promise<StatusLamaran> {
  const session = await getSession();
  if (!session) return { baris: null, pesan: "Sesi tidak ditemukan." };

  const job = await ambilLokerById(jobId);
  if (!job) return { baris: null, pesan: "Loker tidak ditemukan." };

  try {
    bootstrapCareerOps();
  } catch {
    // A broken data root is a read-only failure for this view: show "belum
    // tercatat" rather than pretending the pipeline is healthy.
    return { baris: null };
  }

  const rows = bacaTrackerMd();
  return { baris: cariBarisTracker(rows, job) };
}

export interface HasilUbahStatus {
  ok: boolean;
  /** Canonical status echoed back (what the tracker now holds on success). */
  status?: string;
  /** Number of the tracker row written, when applicable. */
  nomor?: number;
  pesan: string;
}

/**
 * Transition the posting's tracker row to a canonical state.
 *
 * The row is selected by `--row N` (explicit tracker row, never a report
 * number), so the action cannot accidentally write a sibling requisition. The
 * engine re-validates the state against templates/states.yml and re-resolves
 * the row before writing.
 */
export async function ubahStatusLamaran(
  jobId: string,
  nomorBaris: number,
  status: string,
): Promise<HasilUbahStatus> {
  const session = await getSession();
  if (!session) return { ok: false, pesan: "Sesi tidak ditemukan." };

  const job = await ambilLokerById(jobId);
  if (!job) return { ok: false, pesan: "Loker tidak ditemukan." };

  const target = statusKanonis(status);
  if (!target) {
    return { ok: false, pesan: `"${status}" bukan status kanonis.` };
  }
  if (!Number.isSafeInteger(nomorBaris) || nomorBaris < 1) {
    return { ok: false, pesan: "Nomor baris tracker tidak valid." };
  }

  // Never update a quarantined/rejected posting: the Sentinel verdict gates the
  // apply flow everywhere else, and a tracker write must not bypass it.
  if (job.sentinel_status !== "clean") {
    return { ok: false, pesan: "Loker ini tidak bisa dilamar sebelum verifikasi." };
  }

  // Select by the tracker's # column explicitly — the same key the row display
  // showed, and the unambiguous number space. A bare numeric selector is the
  // report-number-mismatch case the engine guards; --row answers it instead of
  // suppressing it with --force.
  const hasil = await ubahStatus(String(nomorBaris), target.label, { row: nomorBaris });

  if (hasil.ok) {
    return { ok: true, status: target.label, nomor: nomorBaris, pesan: `Status diubah menjadi ${target.label}.` };
  }

  return {
    ok: false,
    pesan: hasil.data && typeof (hasil.data as Record<string, unknown>).error === "string"
      ? String((hasil.data as Record<string, unknown>).error)
      : hasil.stderr || "Gagal mengubah status.",
  };
}
