/**
 * Test integrasi application service asesmen terverifikasi — **butuh PostgreSQL**
 * (`npm run test:db`).
 *
 * Berkas ini membuktikan properti ADR 0003 yang tidak bisa dibuktikan test unit,
 * karena hanya muncul saat ada baris attempt yang benar-benar tersimpan:
 *
 * 1. **Snapshot immutable.** Attempt menyimpan definisi kuis saat dibuka; admin
 *    yang mengubah kunci jawaban di bank setelahnya **tidak** mengubah hasil
 *    attempt itu. Amanat plan §7 ("edit/delete quiz tidak boleh mengubah outcome
 *    historis") diuji dengan mengubah bank di tengah jalan, bukan sekadar
 *    memeriksa bentuk snapshot.
 * 2. **Skor dihitung server dari snapshot.** Klien hanya mengirim
 *    `selectedOption`; satu-satunya sumber skor adalah `jawaban_benar` di
 *    snapshot. Tidak ada field skor yang diterima dari input.
 * 3. **Submit idempoten.** Pengiriman kedua tidak menggandakan baris jawaban
 *    (PK komposit `(quiz_attempt_id, question_id)`) dan tidak mengubah skor
 *    historis, walau jawaban yang dikirim berbeda.
 *
 * `npm test` mengecualikan pola `.integration.test.ts`; berkas ini hanya
 * dijalankan `npm run test:db` bersama basis data ephemeral milik config.
 *
 * Store kursus (`@/lib/courses/store`) di-load **dinamis** setelah
 * `CAREEVO_DATA_DIR` diarahkan ke direktori temp: berkas ini memakai
 * `createKuis` sungguhan, dan tanpa pengalihan itu store akan menghidrasi lalu
 * menulis `data/kuis.json` milik mesin pengembang.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { quizAttemptAnswers, quizAttempts } from "@/lib/db/schema";
import { daftarPengguna } from "@/lib/auth/auth-service";
import { daftarEnrollment, listJawabanAttempt } from "@/lib/learning/repository";

let db: KoneksiDb = getDb();
let store: typeof import("@/lib/courses/store");
let svc: typeof import("./assessment-service");

beforeAll(async () => {
  process.env.CAREEVO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "careevo-assessment-"));
  store = await import("@/lib/courses/store");
  svc = await import("./assessment-service");
});

beforeEach(async () => {
  db = getDb();
  await db.execute(
    sql`truncate table
      outbox_events,
      audit_events,
      email_verification_tokens,
      password_reset_tokens,
      sessions,
      staff_invitations,
      user_credentials,
      user_profiles,
      user_roles,
      users,
      courses,
      enrollments,
      module_progress,
      learning_runs,
      learning_events,
      quiz_attempts,
      quiz_attempt_answers,
      course_completions
      cascade`,
  );
});

afterAll(async () => {
  await tutupDb();
});

/** Dua soal dengan kunci awal: q1 → indeks 0, q2 → indeks 1. */
function soalAwal() {
  return [
    { id: "q1", pertanyaan: "Tipe angka di TypeScript?", pilihan: ["number", "string"], jawaban_benar: 0 },
    { id: "q2", pertanyaan: "Kata kunci konstanta?", pilihan: ["var", "let"], jawaban_benar: 1 },
  ];
}

/** Dua soal dengan kunci yang sudah dibalik: q1 → 1, q2 → 0. */
function soalDibalik() {
  return [
    { id: "q1", pertanyaan: "Tipe angka di TypeScript?", pilihan: ["number", "string"], jawaban_benar: 1 },
    { id: "q2", pertanyaan: "Kata kunci konstanta?", pilihan: ["var", "let"], jawaban_benar: 0 },
  ];
}

/** Buat kuis di bank soal in-memory milik direktori temp. */
async function buatKuisBank(judul = "Kuis Asesmen Terverifikasi") {
  return store.createKuis({
    judul,
    deskripsi: "Asesmen untuk test integrasi",
    nilai_lulus: 70,
    soal: soalAwal(),
  });
}

/** User + enrollment siap pakai. */
async function siapkanLearner(suffix: string) {
  const hasil = await daftarPengguna({
    nama: `Learner ${suffix}`,
    username: `learner_${suffix}`,
    email: `learner_${suffix}@contoh.test`,
    password: "rahasia-panjang",
  });
  if (!hasil.ok) throw new Error("gagal buat akun learner");
  const principal = hasil.principal;

  const { enrollment } = await daftarEnrollment({
    userId: principal.userId,
    courseId: `crs-${suffix}`,
    slug: `kursus-${suffix}`,
    title: `Kursus ${suffix}`,
  });

  return { principal, enrollmentId: enrollment.id };
}

describe("mulaiAttemptVerified — snapshot dibekukan saat attempt dibuka", () => {
  it("menyimpan snapshot + definitionVersion dan tidak membawa kunci jawaban ke pemanggil", async () => {
    const { principal, enrollmentId } = await siapkanLearner("buka");
    const kuis = await buatKuisBank();

    const mulai = await svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id });

    expect(mulai.totalSoal).toBe(2);
    expect(mulai.attempt.status).toBe("in_progress");
    expect(mulai.attempt.attemptNumber).toBe(1);
    expect(mulai.attempt.quizId).toBe(kuis.id);
    // Kunci jawaban tidak boleh ikut ke pemanggil.
    expect(mulai.attempt).not.toHaveProperty("assessmentSnapshot");
    expect(JSON.stringify(mulai)).not.toContain("jawaban_benar");

    const [baris] = await db
      .select()
      .from(quizAttempts)
      .where(sql`${quizAttempts.id} = ${mulai.attempt.id}`);

    const snapshot = baris!.assessmentSnapshot as {
      judul: string;
      nilai_lulus: number;
      soal: Array<{ id: string; jawaban_benar: number }>;
    };
    expect(snapshot.judul).toBe("Kuis Asesmen Terverifikasi");
    expect(snapshot.nilai_lulus).toBe(70);
    expect(snapshot.soal.map((s) => s.id)).toEqual(["q1", "q2"]);
    expect(baris!.assessmentDefinitionVersion).toMatch(/^[0-9a-f]{64}$/);
    expect(baris!.gradingVersion).toBe(1);
    expect(baris!.score).toBeNull();
  });

  it("menaikkan nomor attempt per enrollment", async () => {
    const { principal, enrollmentId } = await siapkanLearner("nomor");
    const kuis = await buatKuisBank();

    const pertama = await svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id });
    const kedua = await svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id });

    expect(pertama.attempt.attemptNumber).toBe(1);
    expect(kedua.attempt.attemptNumber).toBe(2);
  });

  it("menolak kuis yang tidak ada di bank", async () => {
    const { principal, enrollmentId } = await siapkanLearner("hilang");

    await expect(
      svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: "kuis-tidak-ada" }),
    ).rejects.toMatchObject({ kode: "kuis_tidak_ditemukan" });
  });

  it("menolak enrollment milik user lain", async () => {
    const { enrollmentId } = await siapkanLearner("pemilik_a");
    const { principal: lain } = await siapkanLearner("pemilik_b");
    const kuis = await buatKuisBank();

    await expect(
      svc.mulaiAttemptVerified({ principal: lain, enrollmentId, quizId: kuis.id }),
    ).rejects.toMatchObject({ kode: "enrollment_tidak_ditemukan" });
  });
});

describe("kirimAttemptVerified — skor server-side", () => {
  it("semua jawaban benar menghasilkan skor 100 dan lulus", async () => {
    const { principal, enrollmentId } = await siapkanLearner("benar");
    const kuis = await buatKuisBank();
    const { attempt } = await svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id });

    const hasil = await svc.kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 1 },
      ],
    });

    expect(hasil.score).toBe(100);
    expect(hasil.lulus).toBe(true);
    expect(hasil.attempt.status).toBe("submitted");
    expect(hasil.attempt.score).toBe(100);
    expect(hasil.attempt).not.toHaveProperty("assessmentSnapshot");

    const jawaban = await listJawabanAttempt(attempt.id);
    expect(jawaban).toHaveLength(2);
    expect(jawaban.map((j) => j.isCorrect)).toEqual([true, true]);
    expect(jawaban.map((j) => j.questionSnapshotRef)).toEqual(["q1", "q2"]);
  });

  it("sebagian salah menghasilkan skor proporsional dan tidak lulus", async () => {
    const { principal, enrollmentId } = await siapkanLearner("salah");
    const kuis = await buatKuisBank();
    const { attempt } = await svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id });

    const hasil = await svc.kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: [
        { questionId: "q1", selectedOption: 1 }, // salah
        { questionId: "q2", selectedOption: 1 }, // benar
      ],
    });

    expect(hasil.score).toBe(50);
    expect(hasil.lulus).toBe(false);

    const jawaban = await listJawabanAttempt(attempt.id);
    expect(jawaban.map((j) => j.isCorrect)).toEqual([false, true]);
    expect(jawaban.map((j) => j.selectedOption)).toEqual([1, 1]);
  });

  it("selectedOption di luar rentang dihitung salah, bukan dijepit", async () => {
    const { principal, enrollmentId } = await siapkanLearner("luar");
    const kuis = await buatKuisBank();
    const { attempt } = await svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id });

    const hasil = await svc.kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: [
        { questionId: "q1", selectedOption: 99 },
        { questionId: "q2", selectedOption: -1 },
      ],
    });

    expect(hasil.score).toBe(0);
    expect(hasil.lulus).toBe(false);
    expect((await listJawabanAttempt(attempt.id)).every((j) => j.isCorrect === false)).toBe(true);
  });

  it("menolak attempt milik user lain", async () => {
    const { principal, enrollmentId } = await siapkanLearner("korban");
    const { principal: penyusup } = await siapkanLearner("penyusup");
    const kuis = await buatKuisBank();
    const { attempt } = await svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id });

    await expect(
      svc.kirimAttemptVerified({
        principal: penyusup,
        attemptId: attempt.id,
        jawaban: [{ questionId: "q1", selectedOption: 0 }],
      }),
    ).rejects.toMatchObject({ kode: "bukan_pemilik" });

    // Attempt korban tetap in_progress dan tanpa jawaban.
    const [baris] = await db
      .select()
      .from(quizAttempts)
      .where(sql`${quizAttempts.id} = ${attempt.id}`);
    expect(baris!.status).toBe("in_progress");
    expect(await listJawabanAttempt(attempt.id)).toHaveLength(0);
  });
});

describe("kirimAttemptVerified — snapshot immutable terhadap perubahan bank", () => {
  it("kunci jawaban yang diubah setelah attempt dibuka tidak mengubah skor", async () => {
    const { principal, enrollmentId } = await siapkanLearner("immutable");
    const kuis = await buatKuisBank();

    const { attempt } = await svc.mulaiAttemptVerified({
      principal,
      enrollmentId,
      quizId: kuis.id,
    });

    // Admin membalik kunci jawaban di bank SETELAH attempt dibuka.
    await store.updateKuis(kuis.id, { soal: soalDibalik() });

    const versiBankSekarang = (await store.getKuis(kuis.id))!;
    expect(versiBankSekarang.soal[0].jawaban_benar).toBe(1);

    // Jawaban yang benar menurut snapshot LAMA (q1 → 0, q2 → 1), salah menurut bank baru.
    const hasil = await svc.kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 1 },
      ],
    });

    expect(hasil.score).toBe(100);
    expect(hasil.lulus).toBe(true);

    // Snapshot tersimpan masih memegang kunci lama, dan `assessment_definition_version`
    // menunjuk definisi yang dinilai — bukan bank yang sudah berubah.
    const [baris] = await db
      .select()
      .from(quizAttempts)
      .where(sql`${quizAttempts.id} = ${attempt.id}`);
    const snapshot = baris!.assessmentSnapshot as {
      soal: Array<{ id: string; jawaban_benar: number }>;
    };
    expect(snapshot.soal.map((s) => s.jawaban_benar)).toEqual([0, 1]);
    expect(baris!.assessmentDefinitionVersion).toMatch(/^[0-9a-f]{64}$/);
  });

  it("nilai_lulus yang diubah di bank tidak mengubah kelulusan attempt lama", async () => {
    const { principal, enrollmentId } = await siapkanLearner("lulus");
    const kuis = await buatKuisBank();
    const { attempt } = await svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id });

    // Naikkan ambang lulus di bank dari 70 menjadi 100 setelah attempt dibuka.
    await store.updateKuis(kuis.id, { nilai_lulus: 100 });

    // Skor 50: tidak lulus terhadap snapshot (70), dan tetap tidak lulus bila
    // ambang bank yang dipakai — tetapi nilainya harus berasal dari snapshot.
    const hasil = await svc.kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 0 },
      ],
    });

    expect(hasil.score).toBe(50);
    expect(hasil.lulus).toBe(false);

    const [baris] = await db
      .select()
      .from(quizAttempts)
      .where(sql`${quizAttempts.id} = ${attempt.id}`);
    expect((baris!.assessmentSnapshot as { nilai_lulus: number }).nilai_lulus).toBe(70);
  });
});

describe("kirimAttemptVerified — idempoten", () => {
  it("pengiriman kedua tidak menggandakan jawaban dan memakai skor tersimpan", async () => {
    const { principal, enrollmentId } = await siapkanLearner("ulang");
    const kuis = await buatKuisBank();
    const { attempt } = await svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id });

    const pertama = await svc.kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 1 },
      ],
    });
    expect(pertama.score).toBe(100);

    // Submit ulang dengan jawaban berbeda: baris jawaban tidak boleh bertambah,
    // dan skor historis tidak boleh berubah.
    const kedua = await svc.kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: [
        { questionId: "q1", selectedOption: 1 },
        { questionId: "q2", selectedOption: 0 },
      ],
    });

    expect(kedua.score).toBe(100);
    expect(kedua.lulus).toBe(true);

    const jawaban = await listJawabanAttempt(attempt.id);
    expect(jawaban).toHaveLength(2);
    expect(jawaban.map((j) => j.selectedOption)).toEqual([0, 1]);

    const baris = await db.select().from(quizAttemptAnswers);
    expect(baris).toHaveLength(2);

    const [attemptTersimpan] = await db
      .select()
      .from(quizAttempts)
      .where(sql`${quizAttempts.id} = ${attempt.id}`);
    expect(attemptTersimpan!.score).toBe(100);
    expect(attemptTersimpan!.status).toBe("submitted");
  });
});
