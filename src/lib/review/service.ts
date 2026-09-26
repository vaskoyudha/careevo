/**
 * Application service review & attestation — **server-only**.
 *
 * Ini permukaan yang dipanggil Server Action untuk submission, review, badge,
 * attestation, dan revocation. Aturan yang dikunci:
 *
 * - **Transition state machine hanya di sini, bukan di component/action.**
 *   Tabel transisi `TRANSISI` adalah satu-satunya sumber transisi yang sah;
 *   `transisiSubmission` di repository menegakkannya dengan compare-and-set.
 * - **Attestation dibangun server-side dari baris review + course + user.**
 *   `username`, `task_id`, `task_title`, `track`, `level`, dan `score` tidak
 *   pernah diterima dari `FormData`; semuanya dibaca dari database/store server.
 * - **Skor dihitung server dari rubrik.** Rubrik diterima sebagai input
 *   tervalidasi Zod (5 nilai 0–4), lalu `hitungSkorKarya` + pemetaan 0–100
 *   dihitung ulang di sini. Nilai `total`/`score` dari klien diabaikan.
 * - **Penerbitan idempoten lewat constraint.** Partial unique index membuat dua
 *   penerbitan untuk review yang sama menghasilkan satu attestation. Badge,
 *   attestation, dan outbox event commit **atomik** dalam satu transaksi.
 *
 * Nama fungsi bisnis berbahasa Indonesia; tipe/helper infrastruktur Inggris.
 */

import { getCourseById } from "@/lib/courses/store";
import { hitungSkorKarya, type RubricCriterion } from "@/lib/scoring/karya";
import { punyaRoleStaff } from "@/lib/auth/authorization";
import type { SessionPrincipal } from "@/lib/auth/principal";
import { kanonik, type AttestationPayload } from "@/lib/attestation/payload";
import { tandaTangan, tokenPublicBaru, type KeyVersion } from "@/lib/attestation/key";
import { jalankanDenganOutbox } from "@/lib/outbox/writer";
import { ambilRolesAktif, cariUserById } from "@/lib/auth/identity-repository";
import {
  ambilCompletion,
  ambilCompletionBanyak,
  ambilEnrollment,
  ambilEnrollmentById,
  listEnrollments,
} from "@/lib/learning/repository";
import { getDb } from "@/lib/db/client";
import {
  ambilAttestation,
  ambilSubmission,
  ambilVersiTerkini,
  buatBadge,
  buatSubmission,
  cabutAttestation,
  listSubmissionMenunggu,
  listSubmissionUser,
  rekamReview,
  setReviewer,
  tambahVersiSubmission,
  terbitAttestation,
  transisiSubmission,
  type Attestation,
  type Badge,
  type Review,
  type Submission,
  type SubmissionVersion,
} from "@/lib/review/repository";

/** Versi kunci attestation yang dipakai Fase 3. */
export const KEY_VERSION_AKTIF: KeyVersion = 1;

/** Keputusan review yang sah — satu daftar untuk Zod dan CHECK. */
export const KEPUTUSAN_REVIEW = ["approved", "changes_requested", "rejected"] as const;
export type KeputusanReview = (typeof KEPUTUSAN_REVIEW)[number];

/** Galat domain review — bukan galat database, supaya bisa dipetakan ke pesan UI. */
export class GalatReview extends Error {
  readonly kode: string;
  constructor(kode: string, pesan: string) {
    super(pesan);
    this.name = "GalatReview";
    this.kode = kode;
  }
}

/**
 * Gate staff murni dari principal — **bukan** `gateStaff()`.
 *
 * `gateStaff()` membaca cookie sesi (`getSession()`), yang hanya sah di dalam
 * Server Action/Route Handler dengan request scope. Service Fase 3 menerima
 * principal dari pemanggil (action yang sudah memanggil `getSession()`), lalu
 * memeriksa role-nya di sini. Ini konsisten dengan `tandaiModulDb`/`service.ts`
 * Fase 2 yang menerima `principal` sebagai argumen, bukan membaca sesi sendiri.
 */
function wajibStaff(principal: SessionPrincipal): SessionPrincipal {
  if (!principal || !principal.userId || !punyaRoleStaff(principal.roles ?? [])) {
    throw new GalatReview("akses_ditolak", "Akses ditolak.");
  }
  return principal;
}

/** Rubrik 5 kriteria (nilai 0–4), input tervalidasi server. */
export type RubrikReview = Record<RubricCriterion, number>;

/** Bentuk ringkas satu keputusan untuk pemanggil (tanpa kunci/snapshot penuh). */
export interface HasilKeputusan {
  review: Review;
  submission: Submission;
  badge: Badge | null;
  attestation: Attestation | null;
}

/* ------------------------------------------------------------------ *
 * State machine murni
 * ------------------------------------------------------------------ */

/**
 * Transisi status submission yang sah.
 *
 * `approved`/`rejected` terminal (kecuali resubmit dari `changes_requested`);
 * `attested` bukan status kolom — ia turunan dari baris `attestations` `active`.
 */
export const TRANSISI: Readonly<Record<Submission["status"], readonly Submission["status"][]>> = {
  draft: ["submitted"],
  submitted: ["assigned"],
  assigned: ["in_review"],
  in_review: ["approved", "rejected", "changes_requested"],
  changes_requested: ["submitted"],
  approved: [],
  rejected: [],
};

/** Apakah transisi `dari` → `ke` sah. Fungsi murni, diuji unit. */
export function transisiSah(
  dari: Submission["status"],
  ke: Submission["status"],
): boolean {
  return (TRANSISI[dari] ?? []).includes(ke);
}

/* ------------------------------------------------------------------ *
 * Submission (learner)
 * ------------------------------------------------------------------ */

/** Konten submission learner — snapshot, bukan payload credential. */
export interface KontenSubmission {
  judul?: string | null;
  catatan?: string | null;
}

/** Jalur kursus wajib memakai enrollment dan completion milik subjek di DB. */
async function pastikanKelayakanKursus(
  userId: string,
  courseId: string | null | undefined,
  enrollmentId: string | null | undefined,
): Promise<void> {
  // Submission portofolio lama tetap berdiri sendiri, bukan bukti lulus kursus.
  if (!courseId && !enrollmentId) return;
  const enrollment = enrollmentId
    ? await ambilEnrollmentById(enrollmentId)
    : courseId ? await ambilEnrollment(userId, courseId) : null;
  if (!courseId || !enrollment || enrollment.userId !== userId || enrollment.courseId !== courseId) {
    throw new GalatReview("kelayakan_ditolak", "Enrollment kursus tidak sesuai dengan pemilik submission.");
  }
  const completion = await ambilCompletion(enrollment.id);
  if (
    !completion || completion.userId !== userId || completion.courseId !== courseId ||
    completion.completionPath !== "terverifikasi" || !(await getCourseById(courseId))
  ) {
    throw new GalatReview("kelayakan_ditolak", "Selesaikan kursus melalui jalur terverifikasi sebelum mengirim karya.");
  }
}

/** Pilihan form berasal dari completion server, bukan klaim browser. */
export async function daftarKursusSubmission(principal: SessionPrincipal): Promise<{
  courseId: string; enrollmentId: string; title: string;
}[]> {
  const enrollments = await listEnrollments(principal.userId);
  const completions = await ambilCompletionBanyak(enrollments.map((e) => e.id));
  const hasil: { courseId: string; enrollmentId: string; title: string }[] = [];
  for (const enrollment of enrollments) {
    const completion = completions.get(enrollment.id);
    if (completion?.completionPath !== "terverifikasi") continue;
    const course = await getCourseById(enrollment.courseId);
    if (course) hasil.push({ courseId: course.id, enrollmentId: enrollment.id, title: course.title });
  }
  return hasil;
}

function wajibReviewer(submission: Submission, principal: SessionPrincipal): void {
  wajibStaff(principal);
  if (submission.userId === principal.userId || submission.assignedReviewerUserId !== principal.userId) {
    throw new GalatReview("akses_ditolak", "Review hanya dapat dilakukan oleh verifikator yang ditugaskan, bukan pemilik karya.");
  }
}

/**
 * Buat submission `draft` untuk learner.
 *
 * `courseId` opsional; bila diisi, submission mengikat kursus. Konten dari klien
 * hanya untuk tampilan dashboard learner, **bukan** bahan payload attestation.
 */
export async function buatSubmissionDb(input: {
  principal: SessionPrincipal;
  courseId?: string | null;
  enrollmentId?: string | null;
  konten: KontenSubmission;
}): Promise<{ submission: Submission; versi: SubmissionVersion }> {
  await pastikanKelayakanKursus(
    input.principal.userId,
    input.courseId,
    input.enrollmentId,
  );
  return jalankanDenganOutbox(
    async (tx) =>
      buatSubmission(tx, {
        userId: input.principal.userId,
        courseId: input.courseId ?? null,
        enrollmentId: input.enrollmentId ?? null,
        contentSnapshot: {
          judul: input.konten.judul ?? null,
          catatan: input.konten.catatan ?? null,
        },
      }),
    (hasil) => ({
      type: "submission.created",
      aggregateType: "submission",
      aggregateId: hasil.submission.id,
      payloadRedacted: { submissionId: hasil.submission.id, userId: input.principal.userId },
      idempotencyKey: `submission.created:${hasil.submission.id}`,
    }),
  );
}

/**
 * Submit submission milik principal (draft/changes_requested → submitted).
 *
 * Kepemilikan diperiksa di sini. Resubmit dari `changes_requested` dengan konten
 * baru menambah versi; submit dari `draft` hanya menaikkan status.
 */
export async function kirimSubmissionDb(input: {
  principal: SessionPrincipal;
  submissionId: string;
  konten?: KontenSubmission;
}): Promise<Submission> {
  const submission = await ambilSubmission(input.submissionId);
  if (!submission || submission.userId !== input.principal.userId) {
    throw new GalatReview("submission_tidak_ditemukan", "Submission tidak ditemukan.");
  }
  if (!transisiSah(submission.status, "submitted")) {
    throw new GalatReview("transisi_ditolak", "Submission tidak dalam status yang bisa dikirim.");
  }
  await pastikanKelayakanKursus(submission.userId, submission.courseId, submission.enrollmentId);

  return jalankanDenganOutbox(
    async (tx) => {
      if (submission.status === "changes_requested" && input.konten) {
        await tambahVersiSubmission(tx, {
          submissionId: submission.id,
          userId: input.principal.userId,
          contentSnapshot: {
            judul: input.konten.judul ?? null,
            catatan: input.konten.catatan ?? null,
          },
        });
      }

      const hasil = await transisiSubmission(tx, submission.id, submission.status, "submitted");
      if (!hasil) {
        throw new GalatReview("transisi_ditolak", "Submission tidak dalam status yang bisa dikirim.");
      }
      return hasil;
    },
    (hasil) => ({
      type: "submission.submitted",
      aggregateType: "submission",
      aggregateId: hasil.id,
      payloadRedacted: { submissionId: hasil.id, userId: input.principal.userId },
      idempotencyKey: `submission.submitted:${hasil.id}:${hasil.currentVersion}`,
    }),
  );
}

/** Daftar submission milik principal. */
export async function listSubmissionDb(principal: SessionPrincipal): Promise<Submission[]> {
  return listSubmissionUser(principal.userId);
}

/* ------------------------------------------------------------------ *
 * Review (staff)
 * ------------------------------------------------------------------ */

/** Assign reviewer — hanya staff, submission harus `submitted`. */
export async function tetapkanReviewerDb(input: {
  principal: SessionPrincipal;
  submissionId: string;
  reviewerUserId: string;
}): Promise<Submission> {
  wajibStaff(input.principal);
  const submission = await ambilSubmission(input.submissionId);
  if (!submission) throw new GalatReview("submission_tidak_ditemukan", "Submission tidak ditemukan.");
  if (submission.userId === input.reviewerUserId) {
    throw new GalatReview("akses_ditolak", "Pemilik karya tidak boleh menilai karyanya sendiri.");
  }
  const roles = await ambilRolesAktif(getDb(), input.reviewerUserId);
  if (!roles.includes("verifikator") && !roles.includes("admin")) {
    throw new GalatReview("akses_ditolak", "Reviewer harus memiliki hak akses verifikator.");
  }

  return jalankanDenganOutbox(
    async (tx) => {
      const hasil = await transisiSubmission(tx, submission.id, "submitted", "assigned");
      if (!hasil) throw new GalatReview("transisi_ditolak", "Submission sudah tidak menunggu review.");
      await setReviewer(tx, submission.id, input.reviewerUserId);
      return hasil;
    },
    (hasil) => ({
      type: "submission.assigned",
      aggregateType: "submission",
      aggregateId: hasil.id,
      payloadRedacted: { submissionId: hasil.id, reviewerUserId: input.reviewerUserId },
      idempotencyKey: `submission.assigned:${hasil.id}`,
    }),
  );
}

/** Klaim review — reviewer harus staff dan status `assigned`. */
export async function mulaiReviewDb(input: {
  principal: SessionPrincipal;
  submissionId: string;
}): Promise<Submission> {
  wajibStaff(input.principal);
  const submission = await ambilSubmission(input.submissionId);
  if (!submission) throw new GalatReview("submission_tidak_ditemukan", "Submission tidak ditemukan.");
  wajibReviewer(submission, input.principal);

  const hasil = await transisiSubmission(getDb(), submission.id, "assigned", "in_review", input.principal.userId);
  if (!hasil) throw new GalatReview("transisi_ditolak", "Submission belum di-assign ke reviewer.");
  return hasil;
}

/**
 * Putuskan review — inti state machine Fase 3.
 *
 * Hanya staff. Rubrik divalidasi server (5 nilai 0–4), skor dihitung ulang.
 * Bila `approved`, badge + attestation diterbitkan **dalam transaksi yang sama**
 * dengan review dan event outbox `attestation.issued`.
 */
export async function putuskanReviewDb(input: {
  principal: SessionPrincipal;
  submissionId: string;
  decision: KeputusanReview;
  rubric: RubrikReview;
  rationale: string;
}): Promise<HasilKeputusan> {
  const staff = wajibStaff(input.principal);

  const submission = await ambilSubmission(input.submissionId);
  if (!submission) throw new GalatReview("submission_tidak_ditemukan", "Submission tidak ditemukan.");
  if (submission.status !== "in_review") {
    throw new GalatReview("transisi_ditolak", "Submission belum dalam review.");
  }
  wajibReviewer(submission, staff);
  if (input.decision === "approved" && submission.courseId) {
    await pastikanKelayakanKursus(submission.userId, submission.courseId, submission.enrollmentId);
  }

  const versi = await ambilVersiTerkini(submission.id);
  if (!versi) throw new GalatReview("versi_tidak_ditemukan", "Versi submission tidak ditemukan.");

  const score = skorDariRubrik(input.rubric);
  const statusTujuan: Submission["status"] =
    input.decision === "approved"
      ? "approved"
      : input.decision === "rejected"
        ? "rejected"
        : "changes_requested";

  // Muat data payload di luar transaksi: `getCourseById` membaca store JSON
  // (bukan DB), `cariUserById` hanya SELECT. Menyiapkannya dulu membuat bagian
  // transaksional sesingkat mungkin.
  const course = submission.courseId ? await getCourseById(submission.courseId) : undefined;
  const user = await cariUserById(getDb(), submission.userId);
  if (!user) throw new GalatReview("user_tidak_ditemukan", "Pemilik submission tidak ditemukan.");

  const payload: AttestationPayload = {
    username: user.usernameNormalized,
    task_id: submission.courseId ?? submission.id,
    task_title: course?.title ?? "Submission",
    track: course?.track ?? "portofolio",
    level: course?.level ?? "mandiri",
    score,
    issued_at: new Date().toISOString(),
  };
  const payloadCanonical = kanonik(payload);
  const publicToken = tokenPublicBaru();
  const signature = tandaTangan(payloadCanonical, KEY_VERSION_AKTIF);

  const hasil = await jalankanDenganOutbox(
    async (tx) => {
      const review = await rekamReview(tx, {
        submissionId: submission.id,
        submissionVersionId: versi.id,
        reviewerUserId: staff.userId,
        decision: input.decision,
        rubricSnapshot: { ...input.rubric },
        score,
        rationale: input.rationale,
      });

      const hasilSub = await transisiSubmission(tx, submission.id, "in_review", statusTujuan, staff.userId);
      if (!hasilSub) {
        throw new GalatReview("transisi_ditolak", "Status submission berubah saat review diputuskan.");
      }

      let badge: Badge | null = null;
      let attestation: Attestation | null = null;

      if (input.decision === "approved") {
        badge = await buatBadge(tx, {
          userId: submission.userId,
          type: submission.courseId ? "course_submission" : "portfolio_submission",
          sourceReviewId: review.id,
        });

        const terbit = await terbitAttestation(tx, {
          subjectUserId: submission.userId,
          sourceReviewId: review.id,
          badgeId: badge.id,
          publicToken,
          payloadCanonical,
          signature,
          keyVersion: KEY_VERSION_AKTIF,
        });
        attestation = terbit.attestation;
      }

      return { review, submission: hasilSub, badge, attestation };
    },
    (hasil) => {
      const peristiwa: Array<{
        type: string;
        aggregateType: string;
        aggregateId: string;
        payloadRedacted: Record<string, unknown>;
        idempotencyKey: string;
      }> = [
        {
          type: "review.decided",
          aggregateType: "review",
          aggregateId: hasil.review.id,
          payloadRedacted: {
            reviewId: hasil.review.id,
            submissionId: hasil.submission.id,
            decision: hasil.review.decision,
          },
          idempotencyKey: `review.decided:${hasil.review.id}`,
        },
      ];
      if (hasil.attestation) {
        peristiwa.push({
          type: "attestation.issued",
          aggregateType: "attestation",
          aggregateId: hasil.attestation.id,
          payloadRedacted: {
            attestationId: hasil.attestation.id,
            subjectUserId: submission.userId,
          },
          idempotencyKey: `attestation.issued:${hasil.attestation.id}`,
        });
      }
      return peristiwa;
    },
  );

  return hasil;
}

/** Antrean review staf. */
export async function listAntreanReviewDb(principal: SessionPrincipal): Promise<Submission[]> {
  wajibStaff(principal);
  return listSubmissionMenunggu();
}

/* ------------------------------------------------------------------ *
 * Revocation
 * ------------------------------------------------------------------ */

/** Cabut attestation — hanya staff, compare-and-set active → revoked. */
export async function cabutAttestationDb(input: {
  principal: SessionPrincipal;
  attestationId: string;
  reason: string;
}): Promise<Attestation | null> {
  const staff = wajibStaff(input.principal);

  const attestation = await ambilAttestation(input.attestationId);
  if (!attestation) throw new GalatReview("attestation_tidak_ditemukan", "Attestation tidak ditemukan.");

  return jalankanDenganOutbox(
    async (tx) =>
      cabutAttestation(tx, {
        id: attestation.id,
        revokedByUserId: staff.userId,
        reason: input.reason,
      }),
    (hasil) =>
      hasil
        ? {
            type: "attestation.revoked",
            aggregateType: "attestation",
            aggregateId: hasil.id,
            payloadRedacted: { attestationId: hasil.id, subjectUserId: hasil.subjectUserId },
            idempotencyKey: `attestation.revoked:${hasil.id}`,
          }
        : [],
  );
}

/* ------------------------------------------------------------------ *
 * Helper murni
 * ------------------------------------------------------------------ */

/** Skor 0–100 dari rubrik 5 kriteria (bobot karya /40 dipetakan ke /100). */
export function skorDariRubrik(rubric: RubrikReview): number {
  const karya = hitungSkorKarya(rubric);
  return Math.round((karya / 40) * 100);
}

/** Re-export tipe baris untuk pemanggil. */
export type { Attestation, Badge, Review, Submission, SubmissionVersion };
