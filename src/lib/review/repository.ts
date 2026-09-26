/**
 * Repository review & attestation — **server-only**.
 *
 * Ini satu-satunya lapisan yang menyentuh tabel Fase 3 (`submissions`,
 * `submission_versions`, `reviews`, `badges`, `attestations`,
 * `attestation_events`). `ReviewService` (application service) memanggil fungsi
 * di sini; **tidak ada** query database langsung dari Server Action atau component.
 *
 * Aturan yang dikunci:
 *
 * - **Setiap fungsi menerima eksekutor (`KoneksiDb`/`TransaksiDb`) sebagai argumen
 *   pertama.** Tidak ada `getDb()` di dalam modul ini (kecuali pembaca satu baris
 *   yang memang tidak butuh transaksi). Ini yang membuat `ReviewService` dapat
 *   menulis review + badge + attestation + outbox event dalam **satu** transaksi.
 * - **Transition state machine memakai compare-and-set, bukan baca-lalu-tulis.**
 *   Setiap transisi `UPDATE … WHERE id = $1 AND status = $expected RETURNING`;
 *   nol baris berarti transisi ditolak. Dua reviewer yang menyetujui submission
 *   bersamaan hanya menghasilkan satu transisi.
 * - **Attestation diterbitkan idempoten lewat partial unique index.**
 *   `attestations_active_review_unique` (`WHERE status = 'active'`) menggagalkan
 *   penerbitan kedua untuk review yang sama; pemanggil menangkap pelanggaran
 *   unique dan membaca baris yang sudah ada (`baru: false`).
 * - **Credential yang dipakai tidak bisa dihapus.** FK `onDelete: "restrict"`
 *   menjaga evidence/review yang sudah jadi credential.
 * - **`payload_canonical` adalah string, bukan objek.** Yang ditandatangani
 *   adalah bentuk kanonik dari `src/lib/attestation/payload.ts`; repository
 *   menyimpannya apa adanya.
 *
 * Nama fungsi bisnis berbahasa Indonesia; tipe/helper infrastruktur Inggris.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, type KoneksiDb, type TransaksiDb } from "@/lib/db/client";
import {
  attestationEvents,
  attestations,
  badges,
  reviews,
  submissions,
  submissionVersions,
  users,
  type Attestation,
  type Badge,
  type Review,
  type Submission,
  type SubmissionVersion,
} from "@/lib/db/schema";

/** Koneksi atau transaksi — repository menerima keduanya. */
export type EksekutorDb = KoneksiDb | TransaksiDb;

/* ------------------------------------------------------------------ *
 * Submission
 * ------------------------------------------------------------------ */

/** Buat submission `draft` + versi 1 dalam satu transaksi. */
export async function buatSubmission(
  db: EksekutorDb,
  input: {
    userId: string;
    courseId?: string | null;
    enrollmentId?: string | null;
    contentSnapshot: Record<string, unknown>;
  },
): Promise<{ submission: Submission; versi: SubmissionVersion }> {
  const [submission] = await db
    .insert(submissions)
    .values({
      userId: input.userId,
      courseId: input.courseId ?? null,
      enrollmentId: input.enrollmentId ?? null,
      status: "draft",
      currentVersion: 1,
    })
    .returning();
  if (!submission) throw new Error("Submission gagal dibuat.");

  const [versi] = await db
    .insert(submissionVersions)
    .values({
      submissionId: submission.id,
      version: 1,
      contentSnapshot: input.contentSnapshot,
      submittedByUserId: input.userId,
    })
    .returning();
  if (!versi) throw new Error("Versi submission gagal dibuat.");

  return { submission, versi };
}

/** Submission berdasarkan id. */
export async function ambilSubmission(id: string): Promise<Submission | null> {
  const [baris] = await getDb().select().from(submissions).where(eq(submissions.id, id));
  return baris ?? null;
}

/** Versi terkini sebuah submission, atau `null`. */
export async function ambilVersiTerkini(
  submissionId: string,
): Promise<SubmissionVersion | null> {
  const [baris] = await getDb()
    .select()
    .from(submissionVersions)
    .where(eq(submissionVersions.submissionId, submissionId))
    .orderBy(desc(submissionVersions.version));
  return baris ?? null;
}

/**
 * Tambah versi baru (resubmit). Version baru = `current_version + 1`, atomic
 * lewat `FOR UPDATE` + unique `(submission_id, version)`.
 */
export async function tambahVersiSubmission(
  db: EksekutorDb,
  input: {
    submissionId: string;
    userId: string;
    contentSnapshot: Record<string, unknown>;
  },
): Promise<SubmissionVersion> {
  const [submission] = await db
    .select({ currentVersion: submissions.currentVersion })
    .from(submissions)
    .where(eq(submissions.id, input.submissionId))
    .for("update");
  if (!submission) throw new Error("Submission tidak ditemukan.");

  const versiBaru = submission.currentVersion + 1;
  const [versi] = await db
    .insert(submissionVersions)
    .values({
      submissionId: input.submissionId,
      version: versiBaru,
      contentSnapshot: input.contentSnapshot,
      submittedByUserId: input.userId,
    })
    .returning();
  if (!versi) throw new Error("Versi submission gagal dibuat.");

  await db
    .update(submissions)
    .set({ currentVersion: versiBaru, updatedAt: new Date() })
    .where(eq(submissions.id, input.submissionId));

  return versi;
}

/**
 * Transisi status submission — compare-and-set. Nol baris = ditolak.
 */
export async function transisiSubmission(
  db: EksekutorDb,
  id: string,
  dari: Submission["status"],
  ke: Submission["status"],
): Promise<Submission | null> {
  const [baris] = await db
    .update(submissions)
    .set({ status: ke, updatedAt: new Date() })
    .where(and(eq(submissions.id, id), eq(submissions.status, dari)))
    .returning();
  return baris ?? null;
}

/** Set `assigned_reviewer_user_id` (metadata, bukan transition). */
export async function setReviewer(
  db: EksekutorDb,
  submissionId: string,
  reviewerUserId: string,
): Promise<Submission | null> {
  const [baris] = await db
    .update(submissions)
    .set({ assignedReviewerUserId: reviewerUserId, updatedAt: new Date() })
    .where(eq(submissions.id, submissionId))
    .returning();
  return baris ?? null;
}

/** Semua submission seorang user. */
export async function listSubmissionUser(userId: string): Promise<Submission[]> {
  return getDb()
    .select()
    .from(submissions)
    .where(eq(submissions.userId, userId))
    .orderBy(desc(submissions.updatedAt));
}

/** Semua submission yang menunggu review. */
export async function listSubmissionMenunggu(): Promise<Submission[]> {
  return getDb()
    .select()
    .from(submissions)
    .where(eq(submissions.status, "submitted"))
    .orderBy(asc(submissions.submittedAt));
}

/* ------------------------------------------------------------------ *
 * Review
 * ------------------------------------------------------------------ */

/** Rekam review untuk sebuah versi submission (dalam transaksi pemanggil). */
export async function rekamReview(
  db: EksekutorDb,
  input: {
    submissionId: string;
    submissionVersionId: string;
    reviewerUserId: string;
    decision: Review["decision"];
    rubricSnapshot: Record<string, unknown>;
    score: number | null;
    rationale: string;
  },
): Promise<Review> {
  const [baris] = await db
    .insert(reviews)
    .values({
      submissionId: input.submissionId,
      submissionVersionId: input.submissionVersionId,
      reviewerUserId: input.reviewerUserId,
      decision: input.decision,
      rubricSnapshot: input.rubricSnapshot,
      score: input.score,
      rationale: input.rationale,
    })
    .returning();
  if (!baris) throw new Error("Review gagal disimpan.");
  return baris;
}

/** Semua review sebuah submission, terbaru lebih dulu (halaman learner). */
export async function listReviewSubmission(submissionId: string): Promise<Review[]> {
  return getDb()
    .select()
    .from(reviews)
    .where(eq(reviews.submissionId, submissionId))
    .orderBy(desc(reviews.createdAt));
}

/* ------------------------------------------------------------------ *
 * Badge
 * ------------------------------------------------------------------ */

/** Buat badge atas review yang disetujui (dalam transaksi pemanggil). */
export async function buatBadge(
  db: EksekutorDb,
  input: { userId: string; type: string; sourceReviewId: string },
): Promise<Badge> {
  const [baris] = await db
    .insert(badges)
    .values({ userId: input.userId, type: input.type, sourceReviewId: input.sourceReviewId })
    .returning();
  if (!baris) throw new Error("Badge gagal dibuat.");
  return baris;
}

/* ------------------------------------------------------------------ *
 * Attestation
 * ------------------------------------------------------------------ */

/**
 * Terbitkan attestation aktif untuk sebuah review (dalam transaksi pemanggil).
 *
 * Idempoten lewat partial unique index; pelanggaran unique dibaca sebagai baris
 * yang sudah ada (`baru: false`). Event `issued` ditulis di transaksi yang sama.
 */
export async function terbitAttestation(
  db: EksekutorDb,
  input: {
    subjectUserId: string;
    sourceReviewId: string;
    badgeId: string | null;
    publicToken: string;
    payloadCanonical: string;
    signature: string;
    keyVersion: number;
  },
): Promise<{ attestation: Attestation; baru: boolean }> {
  const [baru] = await db
    .insert(attestations)
    .values({
      publicToken: input.publicToken,
      subjectUserId: input.subjectUserId,
      sourceReviewId: input.sourceReviewId,
      badgeId: input.badgeId,
      payloadCanonical: input.payloadCanonical,
      signature: input.signature,
      keyVersion: input.keyVersion,
      status: "active",
    })
    .onConflictDoNothing({
      target: attestations.sourceReviewId,
      where: sql`${attestations.status} = 'active'`,
    })
    .returning();

  if (baru) {
    await db.insert(attestationEvents).values({
      attestationId: baru.id,
      kind: "issued",
      actorUserId: null,
      payloadRedacted: {},
    });
    return { attestation: baru, baru: true };
  }

  const [ada] = await db
    .select()
    .from(attestations)
    .where(eq(attestations.sourceReviewId, input.sourceReviewId));
  if (!ada) throw new Error("Attestation gagal diterbitkan.");
  return { attestation: ada, baru: false };
}

/** Attestation berdasarkan id. */
export async function ambilAttestation(id: string): Promise<Attestation | null> {
  const [baris] = await getDb().select().from(attestations).where(eq(attestations.id, id));
  return baris ?? null;
}

/**
 * Cabut attestation — compare-and-set `active` → `revoked` (dalam transaksi
 * pemanggil). Mengembalikan `null` bila sudah `revoked`/tidak ditemukan.
 */
export async function cabutAttestation(
  db: EksekutorDb,
  input: { id: string; revokedByUserId: string | null; reason: string },
): Promise<Attestation | null> {
  const [baris] = await db
    .update(attestations)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revokedByUserId: input.revokedByUserId,
      revocationReason: input.reason,
    })
    .where(and(eq(attestations.id, input.id), eq(attestations.status, "active")))
    .returning();
  if (!baris) return null;

  await db.insert(attestationEvents).values({
    attestationId: baris.id,
    kind: "revoked",
    actorUserId: input.revokedByUserId,
    payloadRedacted: {},
  });
  return baris;
}

/** Re-export tipe baris untuk pemanggil. */
export type { Attestation, Badge, Review, Submission, SubmissionVersion };

/* ------------------------------------------------------------------ *
 * Pembacaan lintas-pemilik (dashboard staf + halaman review)
 * ------------------------------------------------------------------ */

/** Baris submission beserta pemiliknya (nama/email) untuk dashboard staf. */
export interface SubmissionStaf {
  submission: Submission;
  owner: { userId: string; nama: string; email: string };
}

/**
 * Semua submission lintas user, bergabung dengan `users` untuk nama/email.
 * Dipakai halaman review staf menggantikan fixture `reviewQueue`.
 */
export async function listSubmissionStaf(): Promise<SubmissionStaf[]> {
  const baris = await getDb()
    .select({
      submission: submissions,
      userId: users.id,
      nama: users.displayName,
      email: users.emailNormalized,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .orderBy(desc(submissions.updatedAt));

  return baris.map((b) => ({
    submission: b.submission,
    owner: { userId: b.userId, nama: b.nama, email: b.email },
  }));
}

/** Attestation aktif (dan subjeknya) untuk endpoint verify publik + profil. */
export interface AttestationPublik {
  attestation: Attestation;
  subject: { userId: string; nama: string; username: string };
}

/**
 * Attestation + username subjek untuk sebuah public token. Dipakai endpoint
 * verify publik: status active/revoked ikut dikembalikan supaya UI bisa
 * membedakan "valid" dari "revoked".
 */
export async function ambilAttestationPublik(
  token: string,
): Promise<AttestationPublik | null> {
  const baris = await getDb()
    .select({
      attestation: attestations,
      userId: users.id,
      nama: users.displayName,
      username: users.usernameNormalized,
    })
    .from(attestations)
    .innerJoin(users, eq(attestations.subjectUserId, users.id))
    .where(eq(attestations.publicToken, token));
  const b = baris[0];
  if (!b) return null;
  return {
    attestation: b.attestation,
    subject: { userId: b.userId, nama: b.nama, username: b.username },
  };
}

