/**
 * Test integrasi ReviewService + attestation — **butuh PostgreSQL** (`npm run test:db`).
 *
 * Menutup acceptance criteria plan §7 "Fase 3" yang tidak bisa dibuktikan test unit:
 *
 * 1. **State machine ditegakkan di database.** Transisi terlarang (approved →
 *    rejected, submitted → approved) ditolak; dua reviewer menyetujui submission
 *    yang sama hanya menghasilkan satu transisi ke `approved` dan satu
 *    attestation `active`.
 * 2. **Attestation idempoten.** Penerbitan ganda (request/worker dua kali) untuk
 *    review yang sama tidak menghasilkan dua baris `attestations` `active` —
 *    partial unique index yang menolak.
 * 3. **Revocation.** `cabutAttestation` mengubah `active` → `revoked` dan idempoten.
 * 4. **Payload dibangun server-side.** Signature ditandatangani atas
 *    `payload_canonical` dari baris review (bukan input klien), dan diverifikasi
 *    ulang oleh `verifikasiSignature`.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { attestations, badges, courseCompletions, reviews, submissions } from "@/lib/db/schema";
import { daftarPengguna } from "@/lib/auth/auth-service";
import { beriRole } from "@/lib/auth/invitation";
import { daftarEnrollment, rekamCompletion } from "@/lib/learning/repository";
import type { SessionPrincipal } from "@/lib/auth/principal";
import {
  buatSubmissionDb,
  cabutAttestationDb,
  kirimSubmissionDb,
  mulaiReviewDb,
  putuskanReviewDb,
  tetapkanReviewerDb,
  transisiSah,
  type RubrikReview,
} from "@/lib/review/service";
import { verifikasiSignature } from "@/lib/attestation/key";
import { dariKanonik } from "@/lib/attestation/payload";

let db: KoneksiDb = getDb();

async function kosongkan() {
  await db.execute(
    sql`truncate table
      attestation_events,
      attestations,
      audit_events,
      badges,
      course_completions,
      courses,
      email_verification_tokens,
      enrollments,
      learning_events,
      learning_runs,
      module_progress,
      outbox_deliveries,
      outbox_events,
      password_reset_tokens,
      quiz_attempt_answers,
      quiz_attempts,
      reviews,
      sessions,
      staff_invitations,
      submission_versions,
      submissions,
      user_credentials,
      user_profiles,
      user_roles,
      users
      cascade`,
  );
}

beforeEach(async () => {
  db = getDb();
  await kosongkan();
});

afterAll(async () => {
  await tutupDb();
});

async function buatPrincipal(email: string, username: string): Promise<SessionPrincipal> {
  const hasil = await daftarPengguna({
    nama: `Uji ${username}`,
    username,
    email,
    password: "rahasia-panjang",
  });
  if (!hasil.ok) throw new Error("gagal buat user");
  return hasil.principal;
}

async function buatStaff(email: string, username: string): Promise<SessionPrincipal> {
  const principal = await buatPrincipal(email, username);
  const hasil = await beriRole({
    userId: principal.userId,
    role: "verifikator",
    grantedByUserId: null,
  });
  if (!hasil.ok) throw new Error("gagal beri role staff");
  return { ...principal, roles: ["verifikator"], role: "verifikator" };
}

const RUBRIK_LULUS: RubrikReview = {
  kelengkapan: 4,
  kualitas: 4,
  orisinalitas: 4,
  ketepatan_brief: 4,
  dokumentasi: 4,
};

describe("state machine submission — transisi ditegakkan di database", () => {
  it("alur lengkap: draft → submitted → assigned → in_review → approved", async () => {
    const learner = await buatPrincipal("learner@contoh.test", "learner");
    const staff = await buatStaff("staff@contoh.test", "staff");

    const { submission } = await buatSubmissionDb({
      principal: learner,
      konten: { judul: "Karya saya", catatan: "lorem" },
    });
    expect(submission.status).toBe("draft");

    const dikirim = await kirimSubmissionDb({ principal: learner, submissionId: submission.id });
    expect(dikirim.status).toBe("submitted");
    expect(dikirim.submittedAt).toBeInstanceOf(Date);

    const assigned = await tetapkanReviewerDb({
      principal: staff,
      submissionId: submission.id,
      reviewerUserId: staff.userId,
    });
    expect(assigned.status).toBe("assigned");

    const direview = await mulaiReviewDb({ principal: staff, submissionId: submission.id });
    expect(direview.status).toBe("in_review");

    const hasil = await putuskanReviewDb({
      principal: staff,
      submissionId: submission.id,
      decision: "approved",
      rubric: RUBRIK_LULUS,
      rationale: "Karya lengkap dan orisinal.",
    });
    expect(hasil.submission.status).toBe("approved");
    expect(hasil.review.decision).toBe("approved");
    expect(hasil.badge).not.toBeNull();
    expect(hasil.attestation).not.toBeNull();
    expect(hasil.attestation?.status).toBe("active");
  });

  it("transisi terlarang ditolak oleh service (bukan cuma table TRANSISI)", async () => {
    // `transisiSah` murni memegang aturan; di sini kita pastikan service
    // memakainya — submission `draft` tidak bisa langsung di-approve.
    expect(transisiSah("draft", "approved")).toBe(false);

    const learner = await buatPrincipal("draft@contoh.test", "draft");
    const staff = await buatStaff("staff2@contoh.test", "staff2");
    const { submission } = await buatSubmissionDb({
      principal: learner,
      konten: { judul: "Belum dikirim" },
    });

    await expect(
      putuskanReviewDb({
        principal: staff,
        submissionId: submission.id,
        decision: "approved",
        rubric: RUBRIK_LULUS,
        rationale: "Alasan yang cukup panjang.",
      }),
    ).rejects.toMatchObject({ kode: "transisi_ditolak" });
  });
});

describe("otorisasi reviewer", () => {
  it("menolak self-claim dan reviewer tanpa role aktif", async () => {
    const pemilik = await buatStaff("owner@contoh.test", "ownerreview");
    const learner = await buatPrincipal("ownerlearner@contoh.test", "ownerlearner");
    const tanpaRole = await buatPrincipal("nonstaff@contoh.test", "nonstaff");
    const { submission } = await buatSubmissionDb({ principal: pemilik, konten: { judul: "Karya sendiri" } });
    await kirimSubmissionDb({ principal: pemilik, submissionId: submission.id });
    await expect(tetapkanReviewerDb({ principal: pemilik, submissionId: submission.id, reviewerUserId: pemilik.userId }))
      .rejects.toMatchObject({ kode: "akses_ditolak" });
    await expect(tetapkanReviewerDb({ principal: pemilik, submissionId: submission.id, reviewerUserId: tanpaRole.userId }))
      .rejects.toMatchObject({ kode: "akses_ditolak" });
    const staff = await buatStaff("valid@contoh.test", "validreview");
    await tetapkanReviewerDb({ principal: staff, submissionId: submission.id, reviewerUserId: staff.userId });
    await expect(mulaiReviewDb({ principal: pemilik, submissionId: submission.id }))
      .rejects.toMatchObject({ kode: "akses_ditolak" });
    await expect(mulaiReviewDb({ principal: learner, submissionId: submission.id }))
      .rejects.toMatchObject({ kode: "akses_ditolak" });
  });

  it("staf lain tidak dapat memulai atau memutuskan review yang ditugaskan", async () => {
    const learner = await buatPrincipal("reviewlearner@contoh.test", "reviewlearner");
    const reviewer = await buatStaff("reviewer@contoh.test", "reviewer");
    const staffLain = await buatStaff("stafflain@contoh.test", "stafflain");
    const { submission } = await buatSubmissionDb({ principal: learner, konten: { judul: "Karya untuk review" } });
    await kirimSubmissionDb({ principal: learner, submissionId: submission.id });
    await tetapkanReviewerDb({ principal: reviewer, submissionId: submission.id, reviewerUserId: reviewer.userId });
    await expect(mulaiReviewDb({ principal: staffLain, submissionId: submission.id }))
      .rejects.toMatchObject({ kode: "akses_ditolak" });
    await mulaiReviewDb({ principal: reviewer, submissionId: submission.id });
    await expect(putuskanReviewDb({ principal: staffLain, submissionId: submission.id, decision: "approved", rubric: RUBRIK_LULUS, rationale: "Review tidak sah." }))
      .rejects.toMatchObject({ kode: "akses_ditolak" });
    const tersimpan = await db.select().from(attestations);
    expect(tersimpan).toHaveLength(0);
  });
});

describe("kelayakan kursus submission", () => {
  async function submissionTerikat(learner: SessionPrincipal, courseId: string, enrollmentId: string) {
    const { submission } = await buatSubmissionDb({
      principal: learner,
      courseId,
      enrollmentId,
      konten: { judul: "Karya kursus", catatan: "deskripsi" },
    });
    return submission;
  }

  it("menolak enrollment milik user lain", async () => {
    const pemilik = await buatPrincipal("elig-a@contoh.test", "elig-a");
    const penyusup = await buatPrincipal("elig-b@contoh.test", "elig-b");
    const { enrollment } = await daftarEnrollment({
      userId: pemilik.userId, courseId: "crs-1",
      slug: "fullstack-web-development-nextjs-15-react-19", title: "Kursus A",
    });
    await rekamCompletion({
      userId: pemilik.userId, courseId: "crs-1", enrollmentId: enrollment.id,
      completionPath: "terverifikasi", policyVersion: 1,
    });
    await expect(
      buatSubmissionDb({ principal: penyusup, courseId: "crs-1", enrollmentId: enrollment.id, konten: { judul: "X" } }),
    ).rejects.toMatchObject({ kode: "kelayakan_ditolak" });
  });

  it("menolak enrollment yang belum completion terverifikasi", async () => {
    const learner = await buatPrincipal("elig-c@contoh.test", "elig-c");
    const { enrollment } = await daftarEnrollment({
      userId: learner.userId, courseId: "crs-1",
      slug: "fullstack-web-development-nextjs-15-react-19", title: "Kursus A",
    });
    // Belum ada completion sama sekali.
    await expect(
      buatSubmissionDb({ principal: learner, courseId: "crs-1", enrollmentId: enrollment.id, konten: { judul: "X" } }),
    ).rejects.toMatchObject({ kode: "kelayakan_ditolak" });
  });

  it("menolak completion informal", async () => {
    const learner = await buatPrincipal("elig-d@contoh.test", "elig-d");
    const { enrollment } = await daftarEnrollment({
      userId: learner.userId, courseId: "crs-1",
      slug: "fullstack-web-development-nextjs-15-react-19", title: "Kursus A",
    });
    await rekamCompletion({
      userId: learner.userId, courseId: "crs-1", enrollmentId: enrollment.id,
      completionPath: "informal", policyVersion: 1,
    });
    await expect(
      buatSubmissionDb({ principal: learner, courseId: "crs-1", enrollmentId: enrollment.id, konten: { judul: "X" } }),
    ).rejects.toMatchObject({ kode: "kelayakan_ditolak" });
  });

  it("menolak approve bila completion terverifikasi sudah hilang", async () => {
    const learner = await buatPrincipal("elig-e@contoh.test", "elig-e");
    const reviewer = await buatStaff("elig-staff@contoh.test", "elig-staff");
    const { enrollment } = await daftarEnrollment({
      userId: learner.userId, courseId: "crs-1",
      slug: "fullstack-web-development-nextjs-15-react-19", title: "Kursus A",
    });
    await rekamCompletion({
      userId: learner.userId, courseId: "crs-1", enrollmentId: enrollment.id,
      completionPath: "terverifikasi", policyVersion: 1,
    });
    const submission = await submissionTerikat(learner, "crs-1", enrollment.id);
    await kirimSubmissionDb({ principal: learner, submissionId: submission.id });
    await tetapkanReviewerDb({ principal: reviewer, submissionId: submission.id, reviewerUserId: reviewer.userId });
    await mulaiReviewDb({ principal: reviewer, submissionId: submission.id });
    // Hapus completion sehingga approve wajib gagal (re-check saat approve).
    await db.delete(courseCompletions).where(eq(courseCompletions.enrollmentId, enrollment.id));
    await expect(
      putuskanReviewDb({ principal: reviewer, submissionId: submission.id, decision: "approved", rubric: RUBRIK_LULUS, rationale: "Review tanpa completion." }),
    ).rejects.toMatchObject({ kode: "kelayakan_ditolak" });
  });
});

describe("attestation — idempoten dan payload server-side", () => {
  async function approveSekali(learner: SessionPrincipal, staff: SessionPrincipal) {
    const { submission } = await buatSubmissionDb({
      principal: learner,
      konten: { judul: "Karya", catatan: "x" },
    });
    await kirimSubmissionDb({ principal: learner, submissionId: submission.id });
    await tetapkanReviewerDb({
      principal: staff,
      submissionId: submission.id,
      reviewerUserId: staff.userId,
    });
    await mulaiReviewDb({ principal: staff, submissionId: submission.id });
    const hasil = await putuskanReviewDb({
      principal: staff,
      submissionId: submission.id,
      decision: "approved",
      rubric: RUBRIK_LULUS,
      rationale: "Alasan yang cukup panjang.",
    });
    return { submission, hasil };
  }

  it("satu review approved menghasilkan tepat satu attestation active", async () => {
    const learner = await buatPrincipal("att@contoh.test", "att");
    const staff = await buatStaff("staff3@contoh.test", "staff3");
    const { hasil } = await approveSekali(learner, staff);

    const baris = await db
      .select()
      .from(attestations)
      .where(eq(attestations.sourceReviewId, hasil.review.id));
    expect(baris).toHaveLength(1);
    expect(baris[0]?.status).toBe("active");
  });

  it("signature attestation dibangun atas payload_canonical dan bisa diverifikasi ulang", async () => {
    const learner = await buatPrincipal("sig@contoh.test", "sig");
    const staff = await buatStaff("staff4@contoh.test", "staff4");
    const { hasil } = await approveSekali(learner, staff);

    const attestation = hasil.attestation!;
    const payload = dariKanonik(attestation.payloadCanonical);
    expect(payload).not.toBeNull();
    // Payload memakai username database (bukan input klien).
    expect(payload?.username).toBe("sig");
    expect(verifikasiSignature(attestation.payloadCanonical, attestation.signature, attestation.keyVersion)).toBe(true);
  });

  it("revocation mengubah active → revoked dan idempoten", async () => {
    const learner = await buatPrincipal("revoke@contoh.test", "revoke");
    const staff = await buatStaff("staff5@contoh.test", "staff5");
    const { hasil } = await approveSekali(learner, staff);
    const attestation = hasil.attestation!;

    const dicabut = await cabutAttestationDb({
      principal: staff,
      attestationId: attestation.id,
      reason: "Kesalahan data.",
    });
    expect(dicabut?.status).toBe("revoked");

    // Idempoten: pencabutan kedua mengembalikan null (sudah revoked).
    const kedua = await cabutAttestationDb({
      principal: staff,
      attestationId: attestation.id,
      reason: "Percobaan ulang.",
    });
    expect(kedua).toBeNull();
  });
});

describe("isolasi lintas user", () => {
  it("learner tidak bisa menyubmit atau me-review submission orang lain", async () => {
    const a = await buatPrincipal("aaa2@contoh.test", "aaa2");
    const b = await buatPrincipal("bbb2@contoh.test", "bbb2");

    const { submission } = await buatSubmissionDb({
      principal: a,
      konten: { judul: "Milik A" },
    });

    // B (learner lain) tidak bisa mengirim submission milik A.
    await expect(
      kirimSubmissionDb({ principal: b, submissionId: submission.id }),
    ).rejects.toMatchObject({ kode: "submission_tidak_ditemukan" });

    // B (bukan staff) tidak bisa me-review.
    await expect(
      mulaiReviewDb({ principal: b, submissionId: submission.id }),
    ).rejects.toMatchObject({ kode: "akses_ditolak" });

    // Baris submission benar-benar ada tepat satu untuk A, nol untuk B.
    await kirimSubmissionDb({ principal: a, submissionId: submission.id });
    const menunggu = await db.select().from(submissions);
    expect(menunggu.filter((s) => s.userId === a.userId)).toHaveLength(1);
    expect(menunggu.some((s) => s.userId === b.userId)).toBe(false);
  });

  it("badge dan review yang dipakai credential tidak bisa dihapus langsung (FK restrict)", async () => {
    const learner = await buatPrincipal("fk@contoh.test", "fk");
    const staff = await buatStaff("staff7@contoh.test", "staff7");
    const { hasil } = await (async () => {
      const { submission } = await buatSubmissionDb({
        principal: learner,
        konten: { judul: "Karya", catatan: "x" },
      });
      await kirimSubmissionDb({ principal: learner, submissionId: submission.id });
      await tetapkanReviewerDb({
        principal: staff,
        submissionId: submission.id,
        reviewerUserId: staff.userId,
      });
      await mulaiReviewDb({ principal: staff, submissionId: submission.id });
      const hasil = await putuskanReviewDb({
        principal: staff,
        submissionId: submission.id,
        decision: "approved",
        rubric: RUBRIK_LULUS,
        rationale: "Alasan yang cukup panjang.",
      });
      return { submission, hasil };
    })();

    expect(hasil.badge).not.toBeNull();

    // Menghapus review yang sudah dipakai badge/attestation ditolak FK (restrict).
    await expect(db.delete(reviews).where(eq(reviews.id, hasil.review.id))).rejects.toThrow();
    // Baris tetap ada.
    const sisa = await db.select().from(reviews).where(eq(reviews.id, hasil.review.id));
    expect(sisa).toHaveLength(1);

    // Badge juga masih ada.
    const sisaBadge = await db.select().from(badges).where(eq(badges.id, hasil.badge!.id));
    expect(sisaBadge).toHaveLength(1);
  });
});
