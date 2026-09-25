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
import { cekBatasiAksi } from "@/lib/rate-limit/next";

export interface EvaluasiState {
  ok: boolean;
  /** Present only on success. */
  hasil?: HasilEvaluasi;
  /** Present only on failure — why there is no score. */
  alasan?: JenisGagal;
  pesan?: string;
}

export async function nilaiLokerAction(jobId: string): Promise<EvaluasiState> {
  const session = await getSession();
  if (!session) {
    return { ok: false, alasan: "gagal", pesan: "Sesi tidak ditemukan." };
  }

  // Dibatasi SETELAH sesi (agar principal tersedia) dan SEBELUM `evaluasiLoker`:
  // satu panggilan adalah 30–60 detik dan berbiaya, jadi inilah titik termurah
  // untuk menolak. Principal = email sesi, bukan `jobId` dari klien.
  const batas = await cekBatasiAksi("evaluasi", { principal: session.email });
  if (batas) {
    return { ok: false, alasan: "gagal", pesan: batas.gagal.pesan };
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

  return { ok: true, hasil: hasil.hasil };
}
