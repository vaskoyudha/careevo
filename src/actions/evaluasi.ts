"use server";

/**
 * evaluasi.ts — server action that runs the A–H evaluation for one posting.
 *
 * A server action rather than a page-load call, for two reasons that are
 * product constraints rather than preferences:
 *   - The evaluation takes 30–60s and costs money per call. Running it on render
 *     would make every page view a paid API call.
 *   - career-ops' governing principle is human-in-the-loop: the tool prepares,
 *     the person decides. Triggering on demand keeps the candidate in control.
 *
 * Auth is required: this spends a shared API key, so it must not be callable by
 * an anonymous visitor. The layout already gates the route, but the action is
 * re-checked here — a server action is a public endpoint and cannot rely on the
 * page that happened to render it.
 */

import { getSession } from "@/lib/auth/session";
import { ambilLokerById } from "@/lib/jobs/cache";
import { profile } from "@/lib/fixtures";
import { evaluasiLoker, type JenisGagal } from "@/lib/agents/evaluasi/evaluasi";
import type { HasilEvaluasi } from "@/lib/agents/evaluasi/skema";
import { bootstrapCareerOps, simpanEvaluasi } from "@/lib/career-ops";

export interface EvaluasiState {
  ok: boolean;
  /** Present only on success. */
  hasil?: HasilEvaluasi;
  /** Present only on failure — why there is no score. */
  alasan?: JenisGagal;
  pesan?: string;
  /** Report persistence info — present when the evaluation was saved. */
  report?: { nomor?: number; path?: string; pesan: string };
}

export async function nilaiLokerAction(jobId: string): Promise<EvaluasiState> {
  const session = await getSession();
  if (!session) {
    return { ok: false, alasan: "gagal", pesan: "Sesi tidak ditemukan." };
  }

  const job = await ambilLokerById(jobId);
  if (!job) {
    return { ok: false, alasan: "gagal", pesan: "Loker tidak ditemukan." };
  }

  // A rejected posting is not reachable, so it is not evaluable either. Without
  // this, a crafted request could spend API budget evaluating a known scam.
  if (job.sentinel_status === "rejected") {
    return { ok: false, alasan: "gagal", pesan: "Loker ini ditolak Sentinel dan tidak dievaluasi." };
  }

  const hasil = await evaluasiLoker(job, profile);
  if (!hasil.ok) {
    return { ok: false, alasan: hasil.alasan, pesan: hasil.pesan };
  }

  // Pasca-evaluasi, verbatim from career-ops modes/id/lowongan.md: save the
  // report and record it to the tracker. Persistence is best-effort — a report
  // write failure must not turn a successful evaluation into "no score", because
  // the score is true regardless of whether the file landed.
  try {
    bootstrapCareerOps();
    const simpan = await simpanEvaluasi(job, hasil.hasil);
    return {
      ok: true,
      hasil: hasil.hasil,
      report: {
        nomor: simpan.nomor,
        path: simpan.reportPath,
        pesan: simpan.pesan,
      },
    };
  } catch {
    return { ok: true, hasil: hasil.hasil };
  }
}
