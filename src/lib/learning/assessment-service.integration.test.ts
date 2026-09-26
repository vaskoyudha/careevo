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
import { moduleProgress, quizAttemptAnswers, quizAttempts } from "@/lib/db/schema";
import { daftarPengguna } from "@/lib/auth/auth-service";
import {
  buatAttemptBerikutnya,
  daftarEnrollment,
  listJawabanAttempt,
} from "@/lib/learning/repository";
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

describe("mulaiAttemptVerified — penomoran attempt serentak", () => {
  /**
   * Inti Tahap 3: dua permintaan serentak untuk pasangan enrollment–kuis yang
   * sama harus mendapat nomor attempt berbeda **tanpa** galat constraint.
   *
   * Tanpa kunci pada baris enrollment induk, keduanya bisa membaca `max` yang
   * sama, lalu salah satunya ditolak unique
   * `(enrollment_id, quiz_id, attempt_number)`. Tes ini menuntut kebalikannya:
   * keduanya berhasil, nomornya berurutan {1, 2}, dan tidak ada galat.
   */
  it("dua permintaan serentak menghasilkan nomor berbeda tanpa galat constraint", async () => {
    const { principal, enrollmentId } = await siapkanLearner("serentak");
    const kuis = await buatKuisBank();

    const [a, b] = await Promise.all([
      svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id }),
      svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id }),
    ]);

    const nomor = [a.attempt.attemptNumber, b.attempt.attemptNumber].sort((x, y) => x - y);
    expect(nomor).toEqual([1, 2]);
    expect(a.attempt.id).not.toBe(b.attempt.id);

    // Tepat dua baris tersimpan untuk pasangan itu — tidak lebih, tidak kurang.
    const tersimpan = await db
      .select({ attemptNumber: quizAttempts.attemptNumber })
      .from(quizAttempts)
      .where(sql`${quizAttempts.enrollmentId} = ${enrollmentId}`);
    expect(tersimpan.map((r) => r.attemptNumber).sort((x, y) => x - y)).toEqual([1, 2]);
  });

  /**
   * Kunci berkisar pada satu enrollment: penomoran attempt dimulai dari 1 lagi
   * pada enrollment lain, sehingga penomoran tidak bocor lintas pemilik.
   */
  it("enrollment berbeda punya seri nomor attempt sendiri", async () => {
    const { principal: p1, enrollmentId: e1 } = await siapkanLearner("seri_a");
    const { principal: p2, enrollmentId: e2 } = await siapkanLearner("seri_b");
    const kuis = await buatKuisBank();

    const [a1, a2] = await Promise.all([
      svc.mulaiAttemptVerified({ principal: p1, enrollmentId: e1, quizId: kuis.id }),
      svc.mulaiAttemptVerified({ principal: p2, enrollmentId: e2, quizId: kuis.id }),
    ]);

    // Keduanya nomor 1: kunci per-enrollment tidak menyerialkan lintas enrollment.
    expect(a1.attempt.attemptNumber).toBe(1);
    expect(a2.attempt.attemptNumber).toBe(1);
  });

  /**
   * Jalur gagal-tertutup: enrollment yang tidak ada tidak boleh menghasilkan
   * attempt yatim. `buatAttemptBerikutnya` mengembalikan sebab terkontrol dan
   * service memetakannya ke kode domain yang sama dengan pemeriksaan kepemilikan.
   */
  it("enrollment hilang ditolak terkontrol tanpa membuat attempt", async () => {
    const { principal } = await siapkanLearner("yatim");
    const kuis = await buatKuisBank();
    const enrollmentHilang = "00000000-0000-0000-0000-000000000000";

    await expect(
      svc.mulaiAttemptVerified({ principal, enrollmentId: enrollmentHilang, quizId: kuis.id }),
    ).rejects.toMatchObject({ kode: "enrollment_tidak_ditemukan" });

    expect(await db.select().from(quizAttempts)).toHaveLength(0);
  });
});

describe("buatAttemptBerikutnya — kontrak repository", () => {
  /**
   * `mulaiAttemptVerified` memeriksa kepemilikan sebelum memanggil repository,
   * jadi cabang "enrollment hilang" di repository hanya bisa dijangkau langsung.
   * Tes ini menguncinya: baris kunci yang tidak ada mengembalikan sebab
   * terkontrol dan **tidak** menulis attempt tanpa induk.
   */
  it("enrollment tidak ada dikembalikan sebagai sebab terkontrol, bukan galat", async () => {
    const { principal } = await siapkanLearner("repo_yatim");

    const hasil = await buatAttemptBerikutnya({
      userId: principal.userId,
      enrollmentId: "00000000-0000-0000-0000-000000000000",
      quizId: "kuis-apa-saja",
      assessmentDefinitionVersion: "v1",
      assessmentSnapshot: { judul: "x", nilai_lulus: 70, soal: [] },
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) throw new Error("tidak boleh berhasil");
    expect(hasil.sebab).toBe("enrollment_tidak_ditemukan");
    expect(await db.select().from(quizAttempts)).toHaveLength(0);
  });

  /**
   * Dua panggilan repository serentak pada pasangan yang sama: keduanya sukses
   * dan unique `(enrollment_id, quiz_id, attempt_number)` **tidak** dilanggar.
   */
  it("dua panggilan serentak sukses dengan nomor berbeda", async () => {
    const { principal, enrollmentId } = await siapkanLearner("repo_serentak");

    const args = {
      userId: principal.userId,
      enrollmentId,
      quizId: "kuis-serentak",
      assessmentDefinitionVersion: "v1",
      assessmentSnapshot: { judul: "x", nilai_lulus: 70, soal: [] },
    };
    const [a, b] = await Promise.all([
      buatAttemptBerikutnya(args),
      buatAttemptBerikutnya(args),
    ]);

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error("kedua panggilan harus berhasil");
    const nomor = [a.attempt.attemptNumber, b.attempt.attemptNumber].sort((x, y) => x - y);
    expect(nomor).toEqual([1, 2]);
  });
});

describe("selesaikanModulKuisVerified — kuis harus benar-benar terpasang di modul", () => {
  /**
   * Menyiapkan kursus tersimpan dengan dua modul: kuis hanya dipasang di modul
   * pertama. Dipakai untuk membuktikan attempt yang lulus pada kuis itu tidak
   * bisa menandai modul kedua.
   */
  async function siapkanKursusDuaModul(suffix: string) {
    const { principal } = await siapkanLearner(suffix);
    const kuis = await buatKuisBank(`Kuis modul satu ${suffix}`);

    const kursus = await store.createCourse({
      title: `Kursus Dua Modul ${suffix}`,
      description: "kursus uji pemasangan kuis",
      provider: "Careevo",
      url: "https://contoh.test/kursus",
      duration_min: 60,
    });
    const modulA = await store.createModul(kursus.id, {
      judul: "Modul A",
      ringkasan: "modul dengan kuis",
      durasi_min: 30,
    });
    const modulB = await store.createModul(kursus.id, {
      judul: "Modul B",
      ringkasan: "modul tanpa kuis",
      durasi_min: 30,
    });
    if (!modulA || !modulB) throw new Error("gagal membuat modul");
    // Pemasangan lewat API store — satu-satunya sumber `Modul.kuis`.
    const dipasang = await store.pasangKuis(kursus.id, modulA.id, kuis.id);
    if (!dipasang) throw new Error("gagal memasang kuis ke modul A");

    // Enrollment harus menunjuk courseId kursus nyata agar resolver menemukan
    // modul tersimpan; `siapkanLearner` memakai courseId sintetis, jadi daftar ulang.
    const { enrollment: enrollmentNyata } = await daftarEnrollment({
      userId: principal.userId,
      courseId: kursus.id,
      slug: kursus.slug,
      title: kursus.title,
    });

    return { principal, enrollmentId: enrollmentNyata.id, kuis, kursus, modulA, modulB };
  }

  it("menolak modul yang tidak memasang kuis attempt, tanpa menulis progres", async () => {
    const { principal, enrollmentId, kuis, kursus, modulB } =
      await siapkanKursusDuaModul("pasang");

    // Attempt lulus dibuka & dinilai terhadap kuis yang terpasang di modul A.
    const { attempt } = await svc.mulaiAttemptVerified({
      principal,
      enrollmentId,
      quizId: kuis.id,
    });
    const kirim = await svc.kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 1 },
      ],
    });
    expect(kirim.lulus).toBe(true);

    // Klaim modul B — attempt lulus untuk kuis yang TIDAK dipasang di sana.
    await expect(
      svc.selesaikanModulKuisVerified({
        principal,
        courseId: kursus.id,
        modulId: modulB.id,
        quizId: kuis.id,
        attemptId: attempt.id,
        policyVersion: 1,
      }),
    ).rejects.toMatchObject({ kode: "kuis_tidak_cocok" });

    // Tidak ada progres terverifikasi yang menempel pada modul B (atau A).
    expect(await db.select().from(moduleProgress)).toHaveLength(0);
  });

  it("menerima modul yang benar-benar memasang kuis attempt", async () => {
    const { principal, enrollmentId, kuis, kursus, modulA } =
      await siapkanKursusDuaModul("pasang_benar");

    const { attempt } = await svc.mulaiAttemptVerified({
      principal,
      enrollmentId,
      quizId: kuis.id,
    });
    await svc.kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 1 },
      ],
    });

    const hasil = await svc.selesaikanModulKuisVerified({
      principal,
      courseId: kursus.id,
      modulId: modulA.id,
      quizId: kuis.id,
      attemptId: attempt.id,
      policyVersion: 1,
    });

    expect(hasil.modul.ok).toBe(true);
    expect(hasil.attempt.attemptNumber).toBe(1);

    const progres = await db.select().from(moduleProgress);
    expect(progres).toHaveLength(1);
    expect(progres[0]!.moduleId).toBe(modulA.id);
    expect(progres[0]!.completionPath).toBe("terverifikasi");
    expect(progres[0]!.evidenceId).toBe(attempt.id);
  });

  /**
   * Gagal-tertutup untuk kursus yang tidak bisa di-resolve: daftar modul kosong
   * **tidak** boleh menjadi izin menandai modul arbitrer. Attempt yang lulus
   * tetap tidak bisa menulis progres terverifikasi bila kurikulumnya tak dikenal
   * — membedakan jalur ini dari `tandaiModulDb` yang menerima id apa adanya.
   */
  it("menolak attempt dari kursus lain sebelum menulis progres", async () => {
    const { principal, enrollmentId, kuis, modulA } =
      await siapkanKursusDuaModul("lintas_kursus");
    const kursusLain = await store.createCourse({
      title: "Kursus Lain lintas_kursus",
      description: "kursus lain",
      provider: "Careevo",
      url: "https://contoh.test/lain",
      duration_min: 30,
    });
    const modulLain = await store.createModul(kursusLain.id, {
      judul: "Modul Lain",
      ringkasan: "modul lain",
      durasi_min: 30,
    });
    if (!modulLain) throw new Error("gagal membuat modul lain");

    const { attempt } = await svc.mulaiAttemptVerified({ principal, enrollmentId, quizId: kuis.id });
    await svc.kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 1 },
      ],
    });

    await expect(
      svc.selesaikanModulKuisVerified({
        principal,
        courseId: kursusLain.id,
        modulId: modulLain.id,
        quizId: kuis.id,
        attemptId: attempt.id,
        policyVersion: 1,
      }),
    ).rejects.toMatchObject({ kode: "kuis_tidak_cocok" });
    expect(await db.select().from(moduleProgress)).toHaveLength(0);

    // Kursus asal tetap valid; guard hanya menolak mismatch relasi attempt↔course.
    expect(modulA.id).not.toBe(modulLain.id);
  });

  it("menolak kursus tak dikenal (daftar modul kosong) alih-alih menandai modul arbitrer", async () => {
    const { principal, enrollmentId } = await siapkanLearner("kursus_tak_dikenal");
    const kuis = await buatKuisBank("Kuis tanpa kursus nyata");

    const { attempt } = await svc.mulaiAttemptVerified({
      principal,
      enrollmentId,
      quizId: kuis.id,
    });
    await svc.kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 1 },
      ],
    });

    // courseId sintetis dari `siapkanLearner` tidak ada di store, jadi resolver
    // mengembalikan daftar kosong. Penyelesaian harus ditolak, bukan dilewati.
    await expect(
      svc.selesaikanModulKuisVerified({
        principal,
        courseId: "crs-kursus_tak_dikenal",
        modulId: "mod-arbitrer",
        quizId: kuis.id,
        attemptId: attempt.id,
        policyVersion: 1,
      }),
    ).rejects.toMatchObject({ kode: "modul_tidak_ditemukan" });

    expect(await db.select().from(moduleProgress)).toHaveLength(0);
  });
});
