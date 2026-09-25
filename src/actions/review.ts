"use server";

import { getSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/roles";
import { PESAN_AKSES_DITOLAK } from "@/lib/actions-common";

export interface ReviewState {
  ok: boolean;
  message?: string;
  error?: string;
  decision?: string;
}

/**
 * Attestation issuance is intentionally not reachable from this action yet.
 *
 * A credential must be derived from a server-side review record: the subject,
 * the task, and the score all have to come from stored data the caller cannot
 * write. No such record exists before Fase 3, and everything this action used to
 * receive (username, task title, score) arrived in `FormData` — so a learner
 * could mint an attestation for any username and any score by calling the action
 * directly, past the `/review` layout.
 *
 * Fase 0 therefore refuses to issue and says so, rather than issuing something
 * unfounded. Restoring issuance means adding the review service and reading the
 * payload from it — not re-adding these fields.
 */
const PESAN_TERBIT_NONAKTIF =
  "Keputusan tersimpan, tetapi penerbitan attestation belum aktif: menunggu layanan review sisi server (Fase 3). Tidak ada credential yang dibuat.";

const DECISION_LABEL: Record<string, string> = {
  approved: "disetujui",
  revision: "diminta revisi",
  rejected: "ditolak",
};

export async function decideReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  // Authentication and staff authorization happen here, in the action itself.
  // The `/review` layout is a navigation guard, not a security boundary: a
  // Server Action is a POST endpoint reachable by anyone who can send it.
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!["approved", "revision", "rejected"].includes(decision)) {
    return { ok: false, error: "Keputusan tidak valid." };
  }

  if (reason.length < 8) {
    return { ok: false, error: "Alasan wajib diisi minimal 8 karakter. Tidak ada silent reject." };
  }

  if (decision === "approved") {
    return { ok: false, error: PESAN_TERBIT_NONAKTIF };
  }

  return {
    ok: true,
    decision,
    message: `Submission ${DECISION_LABEL[decision] ?? decision}. Alasan tercatat di audit log.`,
  };
}
