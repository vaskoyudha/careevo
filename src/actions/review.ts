"use server";

import { getSession } from "@/lib/auth/session";
import { punyaRoleStaff } from "@/lib/auth/authorization";
import { PESAN_AKSES_DITOLAK } from "@/lib/actions-common";
import {
  GalatReview,
  KEPUTUSAN_REVIEW,
  putuskanReviewDb,
  type KeputusanReview,
  type RubrikReview,
} from "@/lib/review/service";
import type { RubricCriterion } from "@/lib/scoring/karya";

export interface ReviewState {
  ok: boolean;
  message?: string;
  error?: string;
  decision?: string;
}

const DECISION_LABEL: Record<string, string> = {
  approved: "disetujui",
  changes_requested: "diminta revisi",
  rejected: "ditolak",
};

/** Nama field rubrik yang dikirim form — satu daftar, dipakai parse + validasi. */
const FIELD_RUBRIK: readonly RubricCriterion[] = [
  "kelengkapan",
  "kualitas",
  "orisinalitas",
  "ketepatan_brief",
  "dokumentasi",
];

/**
 * Parse rubrik 5 kriteria dari FormData. Nilai di luar 0–4 ditolak, bukan
 * dijepit diam-diam: skor yang menentukan credential wajib dibaca dari input
 * tervalidasi, dan nilai yang mencurigakan harus terlihat sebagai galat.
 */
function parseRubrik(formData: FormData): RubrikReview | { error: string } {
  const rubrik = {} as RubrikReview;
  for (const field of FIELD_RUBRIK) {
    const mentah = String(formData.get(field) ?? "");
    const nilai = Number(mentah);
    if (!Number.isInteger(nilai) || nilai < 0 || nilai > 4) {
      return { error: `Rubrik ${field} harus bilangan bulat 0–4.` };
    }
    rubrik[field] = nilai;
  }
  return rubrik;
}

/**
 * Putuskan sebuah submission dari record server-side.
 *
 * Ini adalah penerbitan credential yang sesungguhnya: keputusan + rubrik
 * diteruskan ke `putuskanReviewDb`, yang membangun payload attestation dari baris
 * review + course + user — bukan dari field yang dikirim browser. Skor dihitung
 * ulang server dari rubrik; `total`/`score`/`username`/`task_title` dari FormData
 * tidak pernah menjadi payload credential.
 *
 * Authentication + staff authorization dilakukan di sini (Server Action adalah
 * POST endpoint yang bisa dipanggil siapa pun), dan diulang oleh service
 * (`wajibStaff`) — layout bukan boundary keamanan.
 */
export async function decideReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const session = await getSession();
  if (!session || !session.userId || !punyaRoleStaff(session.roles ?? [])) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!submissionId) {
    return { ok: false, error: "Submission tidak valid." };
  }
  if (!(KEPUTUSAN_REVIEW as readonly string[]).includes(decision)) {
    return { ok: false, error: "Keputusan tidak valid." };
  }
  if (reason.length < 8) {
    return { ok: false, error: "Alasan wajib diisi minimal 8 karakter. Tidak ada silent reject." };
  }

  const rubrik = parseRubrik(formData);
  if ("error" in rubrik) {
    return { ok: false, error: rubrik.error };
  }

  try {
    const hasil = await putuskanReviewDb({
      principal: session,
      submissionId,
      decision: decision as KeputusanReview,
      rubric: rubrik,
      rationale: reason,
    });

    const diterbitkan =
      hasil.attestation && hasil.attestation.status === "active" ? true : false;
    const pesan =
      decision === "approved"
        ? diterbitkan
          ? "Disetujui dan credential diterbitkan."
          : "Disetujui; credential sudah ada untuk review ini."
        : `Submission ${DECISION_LABEL[decision] ?? decision} dan tersimpan.`;

    return { ok: true, decision, message: pesan };
  } catch (error) {
    if (error instanceof GalatReview) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
