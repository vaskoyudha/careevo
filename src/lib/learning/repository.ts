/**
 * Repository learning evidence — **server-only**.
 *
 * Ini satu-satunya lapisan yang menyentuh tabel Fase 2 (`enrollments`,
 * `module_progress`, `learning_runs`, `learning_events`, `quiz_attempts`,
 * `quiz_attempt_answers`, `course_completions`, dan cache `courses`). Service
 * (`service.ts`, `run-service.ts`, `assessment-service.ts`) memanggil fungsi di
 * sini; **tidak ada** query database langsung dari Server Action atau component.
 *
 * Aturan yang dikunci:
 *
 * - **Idempotensi lewat constraint, bukan pengecekan.** `enrollments` unik pada
 *   `(user_id, course_id)`, `course_completions` unik pada `enrollment_id`,
 *   `module_progress` PK `(enrollment_id, module_id)`. Fungsi di sini memakai
 *   `onConflictDoNothing`/upsert dan mengembalikan baris yang ada bila bentrok,
 *   sehingga dua request paralel tidak pernah menghasilkan baris kedua.
 * - **`course_id`/`module_id`/`quiz_id` adalah `text`**, bukan uuid — id berasal
 *   dari `data/courses.json` dan fixture resource, bukan dari tabel `courses`.
 * - **Semua penulisan sequence event anti-replay** dilakukan di sini, bukan di
 *   service: `catatKejadianRun` mengunci baris run (`FOR UPDATE`) lalu menulis
 *   `sequence = max + 1`, sehingga dua event paralel tidak bisa memakai sequence
 *   yang sama, dan sequence yang dilompati tidak bisa diisi belakangan.
 * - **Penomoran attempt juga dikunci**, dengan pola yang sama:
 *   `buatAttemptBerikutnya` mengunci baris enrollment (`FOR UPDATE`) sebelum
 *   membaca `max(attempt_number)` dan menulis attempt baru, sehingga dua
 *   permintaan `mulaiAttemptVerified` serentak mendapat nomor berbeda alih-alih
 *   bentrok. Unique `(enrollment_id, quiz_id, attempt_number)` tetap dipertahankan
 *   sebagai pertahanan terakhir; pelanggarannya dikembalikan sebagai hasil
 *   terkontrol (`HasilBuatAttempt` dengan `sebab: "bentrok_attempt"`), bukan
 *   dibiarkan bocor sebagai galat driver.
 *
 * Nama fungsi bisnis berbahasa Indonesia; tipe/helper infrastruktur Inggris.
 */

import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { getDb, denganTransaksi, type KoneksiDb, type TransaksiDb } from "@/lib/db/client";
import {
  courseCompletions,
  courses,
  enrollments,
  learningEvents,
  learningRuns,
  moduleProgress,
  quizAttemptAnswers,
  quizAttempts,
  type CourseCompletion,
  type Enrollment,
  type LearningEvent,
  type LearningRun,
  type ModuleProgressRow,
  type QuizAttempt,
  type QuizAttemptAnswer,
} from "@/lib/db/schema";

/* ------------------------------------------------------------------ *
 * Kursus (cache referensi)
 * ------------------------------------------------------------------ */

/**
 * Upsert cache referensi kursus. Tidak pernah gagal; dipanggil setiap enrollment
 * supaya dashboard punya judul/slug tanpa membaca store JSON.
 */
export async function pastikanCourseRef(
  db: KoneksiDb | TransaksiDb,
  input: { id: string; slug: string; title: string },
): Promise<void> {
  await db
    .insert(courses)
    .values({ id: input.id, slug: input.slug, title: input.title })
    .onConflictDoUpdate({
      target: courses.id,
      set: { slug: input.slug, title: input.title },
    });
}

/* ------------------------------------------------------------------ *
 * Enrollment
 * ------------------------------------------------------------------ */

/** Bentuk hasil `daftarEnrollment`: baris + apakah baris itu baru dibuat. */
export interface HasilEnrollment {
  enrollment: Enrollment;
  baru: boolean;
}

/**
 * Daftarkan user ke sebuah kursus — idempoten lewat `unique(user_id, course_id)`.
 *
 * `onConflictDoNothing` membuat dua request paralel menghasilkan satu baris;
 * `baru` membedakan "baru dibuat" dari "sudah ada", sehingga pemanggil bisa
 * memilih pesan "berhasil" vs "sudah terdaftar".
 */
export async function daftarEnrollment(
  input: { userId: string; courseId: string; slug: string; title: string },
): Promise<HasilEnrollment> {
  const hasil = await denganTransaksi(async (tx) => {
    await pastikanCourseRef(tx, { id: input.courseId, slug: input.slug, title: input.title });
    const [baru] = await tx
      .insert(enrollments)
      .values({ userId: input.userId, courseId: input.courseId })
      .onConflictDoNothing({ target: [enrollments.userId, enrollments.courseId] })
      .returning();

    if (baru) return { enrollment: baru, baru: true as const };

    const [ada] = await tx
      .select()
      .from(enrollments)
      .where(
        and(eq(enrollments.userId, input.userId), eq(enrollments.courseId, input.courseId)),
      );
    // Baris dijamin ada (unique di atas), tetapi pertahanan berlapis.
    if (!ada) throw new Error("Enrollment gagal dibuat.");
    return { enrollment: ada, baru: false as const };
  });
  return hasil;
}

/** Enrollment seorang user untuk sebuah kursus, atau `null`. */
export async function ambilEnrollment(
  userId: string,
  courseId: string,
): Promise<Enrollment | null> {
  const [baris] = await getDb()
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
  return baris ?? null;
}

/** Enrollment berdasarkan id-nya (uuid). */
export async function ambilEnrollmentById(
  enrollmentId: string,
): Promise<Enrollment | null> {
  const [baris] = await getDb()
    .select()
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId));
  return baris ?? null;
}

/** Semua enrollment seorang user, terurut paling baru. */
export async function listEnrollments(userId: string): Promise<Enrollment[]> {
  return getDb()
    .select()
    .from(enrollments)
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.enrolledAt));
}

/* ------------------------------------------------------------------ *
 * Module progress
 * ------------------------------------------------------------------ */

/**
 * Tandai satu modul selesai pada sebuah enrollment. Idempoten lewat PK
 * `(enrollment_id, module_id)`: menandai ulang modul yang sudah selesai hanya
 * memperbarui timestamp/jalur, bukan menambah baris.
 */
export async function tandaiModulSelesai(input: {
  enrollmentId: string;
  moduleId: string;
  completionPath: "terverifikasi" | "informal";
  evidenceId?: string | null;
}): Promise<ModuleProgressRow> {
  const [baris] = await getDb()
    .insert(moduleProgress)
    .values({
      enrollmentId: input.enrollmentId,
      moduleId: input.moduleId,
      state: "completed",
      completedAt: new Date(),
      completionPath: input.completionPath,
      evidenceId: input.evidenceId ?? null,
    })
    .onConflictDoUpdate({
      target: [moduleProgress.enrollmentId, moduleProgress.moduleId],
      set: {
        state: "completed",
        completedAt: new Date(),
        completionPath: input.completionPath,
        evidenceId: input.evidenceId ?? null,
      },
    })
    .returning();
  if (!baris) throw new Error("Progres modul gagal disimpan.");
  return baris;
}

/** Hapus tanda selesai sebuah modul (jalur informal toggle). */
export async function batalkanModulSelesai(
  enrollmentId: string,
  moduleId: string,
): Promise<void> {
  await getDb()
    .delete(moduleProgress)
    .where(
      and(eq(moduleProgress.enrollmentId, enrollmentId), eq(moduleProgress.moduleId, moduleId)),
    );
}

/** Semua progres modul sebuah enrollment. */
export async function listProgresModul(enrollmentId: string): Promise<ModuleProgressRow[]> {
  return getDb()
    .select()
    .from(moduleProgress)
    .where(eq(moduleProgress.enrollmentId, enrollmentId));
}

/** Id modul yang sudah `completed` pada sebuah enrollment. */
export async function listModulSelesai(enrollmentId: string): Promise<string[]> {
  const baris = await getDb()
    .select({ moduleId: moduleProgress.moduleId })
    .from(moduleProgress)
    .where(
      and(
        eq(moduleProgress.enrollmentId, enrollmentId),
        eq(moduleProgress.state, "completed"),
      ),
    );
  return baris.map((b) => b.moduleId);
}

/* ------------------------------------------------------------------ *
 * Course completion
 * ------------------------------------------------------------------ */

/**
 * Rekam penyelesaian kursus — idempoten lewat `unique(enrollment_id)`.
 *
 * Dua request completion paralel saling berlomba; hanya satu yang menang insert,
 * sisanya melihat baris yang sudah ada dan mengembalikannya (`baru: false`).
 * Inilah penjamin "tidak ada double completion".
 */
export async function rekamCompletion(input: {
  userId: string;
  courseId: string;
  enrollmentId: string;
  completionPath: "terverifikasi" | "informal";
  policyVersion: number;
}): Promise<{ completion: CourseCompletion; baru: boolean }> {
  const hasil = await denganTransaksi(async (tx) => {
    const [baru] = await tx
      .insert(courseCompletions)
      .values({
        userId: input.userId,
        courseId: input.courseId,
        enrollmentId: input.enrollmentId,
        completionPath: input.completionPath,
        policyVersion: input.policyVersion,
      })
      .onConflictDoNothing({ target: courseCompletions.enrollmentId })
      .returning();

    if (baru) {
      await tx
        .update(enrollments)
        .set({ status: "completed", completedAt: new Date(), completionPath: input.completionPath })
        .where(eq(enrollments.id, input.enrollmentId));
      return { completion: baru, baru: true as const };
    }

    const [ada] = await tx
      .select()
      .from(courseCompletions)
      .where(eq(courseCompletions.enrollmentId, input.enrollmentId));
    if (!ada) throw new Error("Completion gagal dibuat.");
    return { completion: ada, baru: false as const };
  });
  return hasil;
}

/** Completion sebuah enrollment, atau `null` bila belum selesai. */
export async function ambilCompletion(enrollmentId: string): Promise<CourseCompletion | null> {
  const [baris] = await getDb()
    .select()
    .from(courseCompletions)
    .where(eq(courseCompletions.enrollmentId, enrollmentId));
  return baris ?? null;
}

/** Completion untuk banyak enrollment sekaligus — satu query, bukan N+1. */
export async function ambilCompletionBanyak(
  enrollmentIds: readonly string[],
): Promise<Map<string, CourseCompletion>> {
  if (enrollmentIds.length === 0) return new Map();
  const baris = await getDb()
    .select()
    .from(courseCompletions)
    .where(inArray(courseCompletions.enrollmentId, [...enrollmentIds]));
  return new Map(baris.map((b) => [b.enrollmentId, b]));
}

/* ------------------------------------------------------------------ *
 * Learning runs
 * ------------------------------------------------------------------ */

/** Buat run baru (state `active`). `moduleId` opsional (run bisa per course). */
export async function buatRun(input: {
  userId: string;
  enrollmentId: string;
  courseId: string;
  moduleId?: string | null;
  expiresAt: Date;
  integrityVersion: number;
  metadataRedacted?: Record<string, unknown> | null;
}): Promise<LearningRun> {
  const [baris] = await getDb()
    .insert(learningRuns)
    .values({
      userId: input.userId,
      enrollmentId: input.enrollmentId,
      courseId: input.courseId,
      moduleId: input.moduleId ?? null,
      state: "active",
      expiresAt: input.expiresAt,
      integrityVersion: input.integrityVersion,
      metadataRedacted: input.metadataRedacted ?? null,
    })
    .returning();
  if (!baris) throw new Error("Run gagal dibuat.");
  return baris;
}

/** Run berdasarkan id. */
export async function ambilRun(id: string): Promise<LearningRun | null> {
  const [baris] = await getDb().select().from(learningRuns).where(eq(learningRuns.id, id));
  return baris ?? null;
}

/**
 * Run aktif seorang user untuk sebuah kursus, atau `null`.
 *
 * Query terindeks (`user_id`, `course_id`, `state`) — tidak ada scan direktori.
 */
export async function ambilRunAktif(userId: string, courseId: string): Promise<LearningRun | null> {
  const [baris] = await getDb()
    .select()
    .from(learningRuns)
    .where(
      and(
        eq(learningRuns.userId, userId),
        eq(learningRuns.courseId, courseId),
        eq(learningRuns.state, "active"),
      ),
    )
    .orderBy(desc(learningRuns.startedAt));
  return baris ?? null;
}

/** Tutup run sebagai `completed`/`expired`. Idempoten: run non-aktif dibiarkan. */
export async function akhiriRun(
  id: string,
  state: "completed" | "expired",
): Promise<LearningRun | null> {
  const [baris] = await getDb()
    .update(learningRuns)
    .set({ state, completedAt: new Date() })
    .where(and(eq(learningRuns.id, id), eq(learningRuns.state, "active")))
    .returning();
  return baris ?? null;
}

/** Semua run seorang user (dashboard learner). */
export async function listRunUser(userId: string): Promise<LearningRun[]> {
  return getDb()
    .select()
    .from(learningRuns)
    .where(eq(learningRuns.userId, userId))
    .orderBy(desc(learningRuns.startedAt));
}

/** Semua run (dashboard staf) — diindeks, bukan scan direktori. */
export async function listRun(): Promise<LearningRun[]> {
  return getDb().select().from(learningRuns).orderBy(desc(learningRuns.startedAt));
}

/* ------------------------------------------------------------------ *
 * Learning events
 * ------------------------------------------------------------------ */

/** Semua event sebuah run, terurut sequence menaik. */
export async function listEventRun(runId: string): Promise<LearningEvent[]> {
  return getDb()
    .select()
    .from(learningEvents)
    .where(eq(learningEvents.learningRunId, runId))
    .orderBy(asc(learningEvents.sequence));
}

/**
 * Catat satu kejadian pada run, dengan sequence `max + 1` yang **tidak bisa
 * dilompati/diulang**.
 *
 * Baris run dikunci (`FOR UPDATE`) di dalam transaksi supaya dua event paralel
 * tidak membaca `max` yang sama; unique `(learning_run_id, sequence)` adalah
 * jaring pengaman terakhir. Run yang tidak `active` ditolak (`null`), sama
 * seperti invariant berkas lama yang menolak menyisipkan event ke run tertutup.
 */
export async function catatKejadianRun(input: {
  runId: string;
  kind: string;
  payloadRedacted?: Record<string, unknown> | null;
}): Promise<LearningEvent | null> {
  return denganTransaksi(async (tx) => {
    const [run] = await tx
      .select({ state: learningRuns.state })
      .from(learningRuns)
      .where(eq(learningRuns.id, input.runId))
      .for("update");
    if (!run || run.state !== "active") return null;

    const [maks] = await tx
      .select({ m: max(learningEvents.sequence) })
      .from(learningEvents)
      .where(eq(learningEvents.learningRunId, input.runId));
    const sequence = (maks?.m ?? 0) + 1;

    const [baris] = await tx
      .insert(learningEvents)
      .values({
        learningRunId: input.runId,
        kind: input.kind,
        sequence,
        payloadRedacted: input.payloadRedacted ?? null,
      })
      .returning();
    return baris ?? null;
  });
}

/* ------------------------------------------------------------------ *
 * Quiz attempts
 * ------------------------------------------------------------------ */

/**
 * Apakah galat ini pelanggaran unique PostgreSQL (`SQLSTATE 23505`)?
 *
 * Drizzle membungkus galat driver, jadi kode bisa berada di `err.code` atau
 * `err.cause.code` — bentuk pemeriksaan yang sama dipakai `petakanGalatUnik`
 * di `src/lib/auth/auth-service.ts`.
 */
function adalahPelanggaranUnique(err: unknown): boolean {
  const kandidat = err as { code?: string; cause?: { code?: string } };
  return (kandidat?.code ?? kandidat?.cause?.code) === "23505";
}

/**
 * Hasil `buatAttemptBerikutnya` — **selalu** hasil terkontrol, tidak pernah
 * galat driver mentah untuk konflik yang sudah diperkirakan.
 */
export type HasilBuatAttempt =
  | { ok: true; attempt: QuizAttempt }
  | { ok: false; sebab: "enrollment_tidak_ditemukan" | "bentrok_attempt" };

/**
 * Buat attempt `in_progress` dengan nomor berikutnya — **atomik**.
 *
 * Pembacaan `max(attempt_number)` dan insert attempt berbagi satu kunci, sebab
 * pola baca-lalu-tulis tanpa kunci membuat dua permintaan serentak membaca
 * `max` yang sama dan mendapat nomor yang sama. Unique
 * `(enrollment_id, quiz_id, attempt_number)` tetap menjadi pertahanan terakhir,
 * tetapi tanpa kunci salah satu permintaan gagal dengan galat constraint —
 * persis gejala yang ditutup fungsi ini.
 *
 * Kunci yang dipakai adalah **baris enrollment induk** (`FOR UPDATE`), bukan
 * baris `quiz_attempts`: baris attempt belum ada saat nomor dihitung, jadi
 * tidak ada baris untuk dikunci. Enrollment selalu ada sebelum attempt pertama
 * dan sudah menjadi target FK `quiz_attempts.enrollment_id`, sehingga
 * menguncinya menyerialkan seluruh penomoran attempt pada enrollment itu —
 * pola yang sama dengan `catatKejadianRun`, yang menyerialkan sequence lewat
 * kunci baris run. Kuncinya sengaja berkisar per-enrollment, bukan per-pasangan
 * `(enrollment, quiz)`: itu berarti dua kuis berbeda pada satu enrollment juga
 * berurutan, sebuah harga yang diterima untuk MVP dibanding menambah tabel kunci
 * baru.
 *
 * Penguncian terjadi di dalam transaksi yang sama dengan insert, jadi kunci
 * bertahan sampai commit: dua permintaan serentak **berurutan**, permintaan
 * kedua menunggu commit pertama lalu membaca `max` yang sudah naik.
 *
 * Bila unique tetap dilanggar (seharusnya tidak terjadi selama kunci terpasang),
 * galat 23505 dipetakan ke `bentrok_attempt` alih-alih dibiarkan bocor; tidak
 * ada retry diam-diam, supaya bug penguncian tidak tersamarkan.
 */
export async function buatAttemptBerikutnya(input: {
  userId: string;
  enrollmentId: string;
  quizId: string;
  assessmentDefinitionVersion: string;
  assessmentSnapshot: Record<string, unknown>;
}): Promise<HasilBuatAttempt> {
  try {
    return await denganTransaksi(async (tx) => {
      // Kunci baris enrollment induk. Baris yang tidak ada mengembalikan nol
      // baris — itu enrollment hilang, bukan izin lanjut tanpa kunci.
      const [enrollment] = await tx
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(eq(enrollments.id, input.enrollmentId))
        .for("update");
      if (!enrollment) return { ok: false, sebab: "enrollment_tidak_ditemukan" } as const;

      // Selama kunci dipegang, `max` tidak bisa berubah oleh transaksi lain.
      const [maks] = await tx
        .select({ m: max(quizAttempts.attemptNumber) })
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.enrollmentId, input.enrollmentId),
            eq(quizAttempts.quizId, input.quizId),
          ),
        );
      const attemptNumber = (maks?.m ?? 0) + 1;

      const [baris] = await tx
        .insert(quizAttempts)
        .values({
          userId: input.userId,
          enrollmentId: input.enrollmentId,
          quizId: input.quizId,
          assessmentDefinitionVersion: input.assessmentDefinitionVersion,
          assessmentSnapshot: input.assessmentSnapshot,
          status: "in_progress",
          attemptNumber,
        })
        .returning();

      if (!baris) return { ok: false, sebab: "bentrok_attempt" } as const;
      return { ok: true, attempt: baris } as const;
    });
  } catch (err) {
    if (adalahPelanggaranUnique(err)) return { ok: false, sebab: "bentrok_attempt" };
    throw err;
  }
}

/** Attempt berdasarkan id. */
export async function ambilAttempt(id: string): Promise<QuizAttempt | null> {
  const [baris] = await getDb().select().from(quizAttempts).where(eq(quizAttempts.id, id));
  return baris ?? null;
}

/** Semua attempt sebuah enrollment, terurut nomor attempt menaik. */
export async function listAttempt(enrollmentId: string): Promise<QuizAttempt[]> {
  return getDb()
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.enrollmentId, enrollmentId))
    .orderBy(asc(quizAttempts.attemptNumber));
}

/** Jawaban sebuah attempt, terurut question_id. */
export async function listJawabanAttempt(attemptId: string): Promise<QuizAttemptAnswer[]> {
  return getDb()
    .select()
    .from(quizAttemptAnswers)
    .where(eq(quizAttemptAnswers.quizAttemptId, attemptId))
    .orderBy(asc(quizAttemptAnswers.questionId));
}

/**
 * Kirim attempt: tulis skor + jawaban dalam **satu transaksi**.
 *
 * `idempotency` dijaga oleh status: attempt yang sudah `submitted` dikembalikan
 * apa adanya (tidak dinilai ulang), sehingga dua submit paralel tidak
 * menghasilkan dua set jawaban atau skor berbeda.
 */
export async function kirimAttempt(input: {
  attemptId: string;
  score: number;
  answers: Array<{
    questionId: string;
    selectedOption: number;
    isCorrect: boolean;
    questionSnapshotRef?: string | null;
  }>;
}): Promise<QuizAttempt | null> {
  return denganTransaksi(async (tx) => {
    const [ada] = await tx
      .select({ status: quizAttempts.status })
      .from(quizAttempts)
      .where(eq(quizAttempts.id, input.attemptId))
      .for("update");
    if (!ada) return null;
    if (ada.status === "submitted") {
      const [lama] = await tx
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.id, input.attemptId));
      return lama ?? null;
    }

    await tx
      .update(quizAttempts)
      .set({ status: "submitted", submittedAt: new Date(), score: input.score })
      .where(eq(quizAttempts.id, input.attemptId));

    if (input.answers.length > 0) {
      await tx
        .insert(quizAttemptAnswers)
        .values(
          input.answers.map((a) => ({
            quizAttemptId: input.attemptId,
            questionId: a.questionId,
            selectedOption: a.selectedOption,
            isCorrect: a.isCorrect,
            questionSnapshotRef: a.questionSnapshotRef ?? null,
          })),
        )
        .onConflictDoNothing({
          target: [quizAttemptAnswers.quizAttemptId, quizAttemptAnswers.questionId],
        });
    }

    const [baris] = await tx
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.id, input.attemptId));
    return baris ?? null;
  });
}

/* ------------------------------------------------------------------ *
 * Pembacaan lintas-pemilik (dashboard staf)
 * ------------------------------------------------------------------ */

import { users } from "@/lib/db/schema";

/** Baris enrollment beserta pemiliknya (nama/email) untuk dashboard staf. */
export interface EnrollmentStaf {
  enrollment: Enrollment;
  user: { userId: string; nama: string; email: string };
}

/**
 * Semua enrollment lintas user, bergabung dengan `users` untuk nama/email.
 *
 * Query terindeks (`enrollments_course_id_idx` + PK); tidak ada scan file.
 */
export async function listEnrollmentStaf(): Promise<EnrollmentStaf[]> {
  const baris = await getDb()
    .select({
      enrollment: enrollments,
      userId: users.id,
      nama: users.displayName,
      email: users.emailNormalized,
    })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .orderBy(asc(users.displayName));

  return baris.map((b) => ({
    enrollment: b.enrollment,
    user: { userId: b.userId, nama: b.nama, email: b.email },
  }));
}

/** Semua baris `module_progress` lintas enrollment (dashboard staf). */
export async function listProgresSemua(): Promise<ModuleProgressRow[]> {
  return getDb().select().from(moduleProgress);
}

/** Semua attempt `submitted` lintas user (dashboard staf). */
export async function listAttemptSemua(): Promise<QuizAttempt[]> {
  return getDb()
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.status, "submitted"));
}

/** Re-export tipe baris untuk pemanggil. */
export type {
  CourseCompletion,
  Enrollment,
  LearningEvent,
  LearningRun,
  ModuleProgressRow,
  QuizAttempt,
  QuizAttemptAnswer,
};
