"use server";

import { getSession } from "@/lib/auth/session";
import { punyaRoleStaff } from "@/lib/auth/authorization";
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
  "Keputusan diterima, tetapi penerbitan attestation belum aktif: menunggu layanan review sisi server (Fase 3). Tidak ada credential yang dibuat, dan belum ada yang tersimpan.";

/**
 * The honest counterpart of the line above for non-approval decisions.
 *
 * This action validates the decision and returns it, but persists **nothing**:
 * `logAudit` is still an unimplemented stub (`src/lib/audit/logger.ts`) and
 * there is no review store before Fase 3. The previous copy said "Alasan
 * tercatat di audit log", which claimed a write that never happens — a
 * verifikator would read that as a completed record. Say what is true instead:
 * the decision is accepted for this response only, and nothing was stored.
 */
const PESAN_BELUM_TERSIMPAN =
  "Belum ada yang tersimpan: layanan review sisi server (Fase 3) belum ada, jadi keputusan ini tidak masuk audit log maupun database.";

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
  //
  // Otorisasinya membaca `roles` dari principal database (`punyaRoleStaff`),
  // bukan field kompatibilitas `session.role` — supaya pencabutan role berlaku
  // pada permintaan berikutnya lewat aturan yang sama dengan `gateStaff()`.
  // Principal tanpa `userId` (cookie legacy) tetap ditolak.
  const session = await getSession();
  if (!session || !session.userId || !punyaRoleStaff(session.roles ?? [])) {
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
    message: `Submission ${DECISION_LABEL[decision] ?? decision} (belum tersimpan). ${PESAN_BELUM_TERSIMPAN}`,
  };
}
