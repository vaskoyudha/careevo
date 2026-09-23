"use server";

import { signPayload, type AttestationPayload } from "@/lib/attestation/sign";
import { encodeToken, getAttestationSecret } from "@/lib/attestation/token";

export interface ReviewState {
  ok: boolean;
  message?: string;
  error?: string;
  decision?: string;
  token?: string;
}

const DECISION_LABEL: Record<string, string> = {
  approved: "disetujui",
  revision: "diminta revisi",
  rejected: "ditolak",
};

export async function decideReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const total = Number(formData.get("total") ?? 0);
  const username = String(formData.get("username") ?? "budi");
  const taskTitle = String(formData.get("task_title") ?? "Rebuild Landing Page");

  if (!["approved", "revision", "rejected"].includes(decision)) {
    return { ok: false, error: "Keputusan tidak valid." };
  }

  if (reason.length < 8) {
    return { ok: false, error: "Alasan wajib diisi minimal 8 karakter. Tidak ada silent reject." };
  }

  if (decision === "approved") {
    const payload: AttestationPayload = {
      username,
      task_id: "1",
      task_title: taskTitle,
      track: "Web Dev",
      level: "dasar",
      score: total,
      issued_at: new Date().toISOString(),
    };
    const token = encodeToken(payload, signPayload(payload, getAttestationSecret()));
    return {
      ok: true,
      decision,
      token,
      message: `Submission disetujui. Badge dan attestation HMAC-SHA256 terbit (skor ${total}).`,
    };
  }

  return {
    ok: true,
    decision,
    message: `Submission ${DECISION_LABEL[decision] ?? decision}. Alasan tercatat di audit log.`,
  };
}
