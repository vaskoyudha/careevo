"use server";

import { getSession } from "@/lib/auth/session";
import { safeRevalidate } from "@/lib/actions-common";
import { z } from "zod";
import { punyaRoleStaff } from "@/lib/auth/authorization";
import { PESAN_AKSES_DITOLAK } from "@/lib/actions-common";
import {
  GalatReview,
  KEPUTUSAN_REVIEW,
  buatSubmissionDb,
  daftarKursusSubmission,
  kirimSubmissionDb,
  tetapkanReviewerDb,
  mulaiReviewDb,
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
  submissionId?: string;
}

const idSchema = z.uuid();
const buatSchema = z.object({
  enrollmentId: idSchema,
  judul: z.string().trim().min(3).max(160),
  // Catatan **opsional**. `FormData.get()` mengembalikan `null` (field tidak
  // ada) atau `""` (dikosongkan), jadi skema wajib-string menolak keduanya dan
  // membuat submission tanpa catatan mustahil dibuat. Panjang minimum tetap
  // diberlakukan saat catatan benar-benar diisi.
  catatan: z
    .string()
    .trim()
    .max(5000)
    .refine((nilai) => nilai.length === 0 || nilai.length >= 10, {
      message: "Catatan minimal 10 karakter bila diisi.",
    })
    .nullable()
    .optional(),
});

async function jalankanMutation(
  formData: FormData,
  role: "learner" | "staff",
  operation: (principal: NonNullable<Awaited<ReturnType<typeof getSession>>>, submissionId: string) => Promise<void>,
): Promise<ReviewState> {
  const session = await getSession();
  if (!session?.userId || (role === "staff" && !punyaRoleStaff(session.roles ?? []))) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }
  const id = idSchema.safeParse(formData.get("submissionId"));
  if (!id.success) return { ok: false, error: "Submission tidak valid." };
  try {
    await operation(session, id.data);
    safeRevalidate("/submission", `/submission/${id.data}`, "/review", `/review/${id.data}`);
    return { ok: true, submissionId: id.data, message: "Perubahan tersimpan." };
  } catch (error) {
    if (error instanceof GalatReview) return { ok: false, error: error.message };
    throw error;
  }
}

export async function buatSubmissionAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const session = await getSession();
  if (!session?.userId) return { ok: false, error: PESAN_AKSES_DITOLAK };
  const parsed = buatSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    judul: formData.get("judul"),
    catatan: formData.get("catatan"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  try {
    const pilihan = (await daftarKursusSubmission(session)).find(
      (item) => item.enrollmentId === parsed.data.enrollmentId,
    );
    if (!pilihan) return { ok: false, error: "Kursus belum memenuhi syarat untuk submission." };
    const { submission } = await buatSubmissionDb({
      principal: session,
      courseId: pilihan.courseId,
      enrollmentId: pilihan.enrollmentId,
      konten: { judul: parsed.data.judul, catatan: parsed.data.catatan },
    });
    safeRevalidate("/submission");
    return { ok: true, submissionId: submission.id, message: "Draf karya dibuat." };
  } catch (error) {
    if (error instanceof GalatReview) return { ok: false, error: error.message };
    throw error;
  }
}

export async function kirimSubmissionAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  return jalankanMutation(formData, "learner", async (principal, submissionId) => {
    await kirimSubmissionDb({ principal, submissionId });
  });
}

export async function ambilReviewAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  return jalankanMutation(formData, "staff", async (principal, submissionId) => {
    await tetapkanReviewerDb({ principal, submissionId, reviewerUserId: principal.userId });
  });
}

export async function mulaiReviewAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  return jalankanMutation(formData, "staff", async (principal, submissionId) => {
    await mulaiReviewDb({ principal, submissionId });
  });
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

  if (!idSchema.safeParse(submissionId).success) {
    return { ok: false, error: "Submission tidak valid." };
  }
  if (!(KEPUTUSAN_REVIEW as readonly string[]).includes(decision)) {
    return { ok: false, error: "Keputusan tidak valid." };
  }
  // UI MVP hanya menawarkan approve/reject. `changes_requested` masih ada di
  // state machine, tetapi tanpa UI revisi/resubmit ia hanya menciptakan status
  // buntu; tolak di sini sampai jalur revisi benar-benar disambungkan.
  if (decision === "changes_requested") {
    return { ok: false, error: "Permintaan revisi belum tersedia." };
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

    safeRevalidate("/review", `/review/${submissionId}`, "/submission", `/submission/${submissionId}`);
    return { ok: true, decision, message: pesan };
  } catch (error) {
    if (error instanceof GalatReview) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
