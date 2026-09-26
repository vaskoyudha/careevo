import { beforeEach, describe, expect, it, vi } from "vitest";
import { principalUji } from "@/lib/auth/test-principal";

/**
 * Test unit Server Action asesmen terverifikasi — **tanpa database**.
 *
 * Yang diuji di sini bukan penilaiannya (itu milik
 * `assessment-service.integration.test.ts` dan `assessment-snapshot.test.ts`),
 * melainkan kontrak action yang tipis:
 *
 * 1. Tidak ada jalur yang berjalan tanpa sesi.
 * 2. Kuis yang tidak terpasang di modul tidak bisa dibuka, walau id-nya ada di
 *    bank soal.
 * 3. `score`/`lulus` **selalu** berasal dari service. Test ini sengaja memakai
 *    skor mock yang berbeda dari jawaban yang dikirim: kalau action menghitung
 *    sendiri, hasilnya tidak akan cocok.
 * 4. Penyelesaian modul hanya dipanggil saat attempt lulus, dan versi
 *    kebijakan diturunkan server-side dari kursus — bukan dari argumen.
 * 5. Kunci jawaban/snapshot tidak pernah menyeberang ke pemanggil.
 *
 * `assessment-service` dimock **seluruhnya**, termasuk `GalatAsesmen` sebagai
 * kelas nyata: action memakai `instanceof` untuk memetakan galat domain ke
 * pesan UI, jadi kelas tiruan harus benar-benar ada.
 */

const mocks = vi.hoisted(() => {
  class GalatAsesmen extends Error {
    readonly kode: string;
    constructor(kode: string, message: string) {
      super(message);
      this.name = "GalatAsesmen";
      this.kode = kode;
    }
  }
  return {
    GalatAsesmen,
    getSession: vi.fn(),
    modulUntuk: vi.fn(),
    getCourseById: vi.fn(),
    progresKursusDb: vi.fn(),
    mulaiAttemptVerified: vi.fn(),
    kirimAttemptVerified: vi.fn(),
    selesaikanModulKuisVerified: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/courses/modul-resolver", () => ({ modulUntuk: mocks.modulUntuk }));
vi.mock("@/lib/courses/store", () => ({ getCourseById: mocks.getCourseById }));
vi.mock("@/lib/learning/service", () => ({ progresKursusDb: mocks.progresKursusDb }));
vi.mock("@/lib/learning/assessment-service", () => ({
  GalatAsesmen: mocks.GalatAsesmen,
  OPSI_TIDAK_DIJAWAB: -1,
  mulaiAttemptVerified: mocks.mulaiAttemptVerified,
  kirimAttemptVerified: mocks.kirimAttemptVerified,
  selesaikanModulKuisVerified: mocks.selesaikanModulKuisVerified,
}));

// Import setelah mock terpasang: ESM hoists `vi.mock`, dan action membaca
// kelas galat dari modul yang sudah dimock.
const { mulaiKuisVerifiedAction, kirimKuisVerifiedAction, kirimDanSelesaikanKuisAction } =
  await import("./assessment");

const KURSUS = "crs-1";
const MODUL = "crs-1-m1";
const KUIS = "kuis-1";
const ATTEMPT = "11111111-1111-4111-8111-111111111111";

const PRINCIPAL = principalUji({
  email: "siswa@careevo.test",
  nama: "Siswa Uji",
  username: "siswa",
  role: "user",
});

/** Modul dengan kuis terpasang — bentuk `ModulKursus` yang sudah diresolusi. */
const MODUL_KUIS = {
  id: MODUL,
  judul: "Modul Kuis",
  ringkasan: "ringkasan",
  durasi_min: 15,
  url: "https://example.test/kursus",
  kuis: [{ id: KUIS, judul: "Kuis", deskripsi: "", soal: [], nilai_lulus: 70 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(PRINCIPAL);
  mocks.modulUntuk.mockResolvedValue([MODUL_KUIS]);
  mocks.getCourseById.mockResolvedValue({
    id: KURSUS,
    slug: "kursus-uji",
    title: "Kursus Uji",
    kebijakan: { versi: 7 },
  });
  mocks.progresKursusDb.mockResolvedValue({
    enrollment: { id: "enr-1", userId: PRINCIPAL.userId, courseId: KURSUS },
    selesai: [],
  });
  mocks.mulaiAttemptVerified.mockResolvedValue({
    // Service sungguhan mengembalikan `AttemptRingkas` (tanpa snapshot); inilah
    // bentuk yang harus dipertahankan action.
    attempt: { id: ATTEMPT, status: "in_progress", quizId: KUIS },
    totalSoal: 3,
  });
  mocks.kirimAttemptVerified.mockResolvedValue({
    attempt: { id: ATTEMPT, status: "submitted", score: 42 },
    score: 42,
    lulus: false,
  });
  mocks.selesaikanModulKuisVerified.mockResolvedValue({
    attempt: { id: ATTEMPT, status: "submitted", score: 42 },
    score: 42,
    modul: { ok: true, aksi: "ditandai" },
    kursus: { selesai: false, selesaiCount: 1, total: 5 },
  });
});

describe("mulaiKuisVerifiedAction", () => {
  it("menolak pemanggil tanpa sesi sebelum menyentuh kurikulum", async () => {
    mocks.getSession.mockResolvedValue(null);

    const hasil = await mulaiKuisVerifiedAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
    });

    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.error).toContain("Masuk");
    // Tanpa principal tidak ada pemilik attempt: membaca kurikulum atau membuat
    // attempt lebih dulu berarti sudah membakar kerja untuk request anonim.
    expect(mocks.modulUntuk).not.toHaveBeenCalled();
    expect(mocks.mulaiAttemptVerified).not.toHaveBeenCalled();
  });

  it("menolak kuis yang tidak terpasang pada modul", async () => {
    mocks.modulUntuk.mockResolvedValue([{ ...MODUL_KUIS, kuis: [] }]);

    const hasil = await mulaiKuisVerifiedAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
    });

    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.error).toContain("tidak terpasang");
    // Bank soal bisa memuat kuis ini, tetapi modul ini tidak memakainya —
    // tanpa gerbang ini peserta bisa membuka attempt kuis mana pun.
    expect(mocks.mulaiAttemptVerified).not.toHaveBeenCalled();
  });

  it("menolak modul yang tidak ada di kurikulum", async () => {
    mocks.modulUntuk.mockResolvedValue([{ ...MODUL_KUIS, id: "modul-lain" }]);

    const hasil = await mulaiKuisVerifiedAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
    });

    expect(hasil.ok).toBe(false);
    expect(mocks.mulaiAttemptVerified).not.toHaveBeenCalled();
  });

  it("menolak peserta yang belum terdaftar di kursus", async () => {
    mocks.progresKursusDb.mockResolvedValue({ enrollment: null, selesai: [] });

    const hasil = await mulaiKuisVerifiedAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
    });

    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.error).toContain("Daftar kursus ini dulu");
    expect(mocks.mulaiAttemptVerified).not.toHaveBeenCalled();
  });

  it("mengembalikan attemptId + totalSoal, tanpa kunci jawaban", async () => {
    const hasil = await mulaiKuisVerifiedAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
    });

    expect(hasil).toEqual({ ok: true, attemptId: ATTEMPT, totalSoal: 3 });

    // enrollmentId diambil dari progres principal, bukan dari input klien.
    expect(mocks.progresKursusDb).toHaveBeenCalledWith(PRINCIPAL, KURSUS);
    expect(mocks.mulaiAttemptVerified).toHaveBeenCalledWith({
      principal: PRINCIPAL,
      enrollmentId: "enr-1",
      quizId: KUIS,
    });

    // Snapshot memuat `jawaban_benar`; ia tidak boleh sampai ke peramban.
    expect(JSON.stringify(hasil)).not.toContain("jawaban_benar");
    expect(JSON.stringify(hasil)).not.toContain("snapshot");
  });

  it("memetakan galat domain menjadi pesan, bukan melempar", async () => {
    mocks.mulaiAttemptVerified.mockRejectedValue(
      new mocks.GalatAsesmen("kuis_tidak_ditemukan", "Kuis tidak ada di bank."),
    );

    const hasil = await mulaiKuisVerifiedAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
    });

    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.error).toContain("bank soal");
  });
});

describe("kirimKuisVerifiedAction", () => {
  it("memakai skor dari service, bukan menghitung sendiri", async () => {
    // Jawaban terlihat sempurna, tetapi service (mock) menjawab 42/tidak lulus.
    // Kalau action menghitung skor dari `jawaban`, angka ini tidak akan cocok.
    mocks.kirimAttemptVerified.mockResolvedValue({
      attempt: { id: ATTEMPT, status: "submitted", score: 42 },
      score: 42,
      lulus: false,
    });

    const hasil = await kirimKuisVerifiedAction({
      attemptId: ATTEMPT,
      jawaban: [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 1 },
      ],
    });

    expect(hasil).toEqual({ ok: true, score: 42, lulus: false });
    expect(mocks.kirimAttemptVerified).toHaveBeenCalledWith({
      principal: PRINCIPAL,
      attemptId: ATTEMPT,
      jawaban: [
        { questionId: "q1", selectedOption: 0 },
        { questionId: "q2", selectedOption: 1 },
      ],
    });
  });

  it("tidak meneruskan score/isCorrect dari klien ke service", async () => {
    // Payload "kotor" seperti yang bisa datang dari wire: field yang tidak
    // dikenal diselipkan bersama jawaban sah.
    const jawabanKotor = [
      { questionId: "q1", selectedOption: 1, isCorrect: true, score: 100 },
    ] as unknown as Array<{ questionId: string; selectedOption: number }>;

    await kirimKuisVerifiedAction({ attemptId: ATTEMPT, jawaban: jawabanKotor });

    const argumen = mocks.kirimAttemptVerified.mock.calls[0]?.[0] as {
      jawaban: Array<Record<string, unknown>>;
    };
    expect(argumen.jawaban).toEqual([{ questionId: "q1", selectedOption: 1 }]);
    expect(argumen.jawaban[0]).not.toHaveProperty("isCorrect");
    expect(argumen.jawaban[0]).not.toHaveProperty("score");
  });

  it("memetakan selectedOption yang tidak sah ke OPSI_TIDAK_DIJAWAB", async () => {
    await kirimKuisVerifiedAction({
      attemptId: ATTEMPT,
      jawaban: [
        { questionId: "q1", selectedOption: 1.5 },
        { questionId: "q2", selectedOption: "0" as unknown as number },
        { questionId: "", selectedOption: 0 },
      ],
    });

    const argumen = mocks.kirimAttemptVerified.mock.calls[0]?.[0] as {
      jawaban: Array<{ questionId: string; selectedOption: number }>;
    };
    // `1.5` dan `"0"` bukan indeks yang sah; keduanya dinilai salah, bukan
    // menjatuhkan action dengan galat kolom integer.
    expect(argumen.jawaban).toEqual([
      { questionId: "q1", selectedOption: -1 },
      { questionId: "q2", selectedOption: -1 },
    ]);
  });

  it("menolak tanpa sesi tanpa memanggil service", async () => {
    mocks.getSession.mockResolvedValue(null);

    const hasil = await kirimKuisVerifiedAction({
      attemptId: ATTEMPT,
      jawaban: [{ questionId: "q1", selectedOption: 0 }],
    });

    expect(hasil.ok).toBe(false);
    expect(mocks.kirimAttemptVerified).not.toHaveBeenCalled();
  });

  it("memetakan galat kepemilikan menjadi pesan", async () => {
    mocks.kirimAttemptVerified.mockRejectedValue(
      new mocks.GalatAsesmen("bukan_pemilik", "Attempt ini bukan milik Anda."),
    );

    const hasil = await kirimKuisVerifiedAction({
      attemptId: ATTEMPT,
      jawaban: [{ questionId: "q1", selectedOption: 0 }],
    });

    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.error).toContain("bukan milik Anda");
  });
});

describe("kirimDanSelesaikanKuisAction", () => {
  it("tidak menyelesaikan modul saat attempt belum lulus", async () => {
    mocks.kirimAttemptVerified.mockResolvedValue({
      attempt: { id: ATTEMPT, status: "submitted", score: 10 },
      score: 10,
      lulus: false,
    });

    const hasil = await kirimDanSelesaikanKuisAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
      attemptId: ATTEMPT,
      jawaban: [{ questionId: "q1", selectedOption: 1 }],
    });

    expect(hasil).toEqual({ ok: true, attemptId: ATTEMPT, score: 10, lulus: false });
    // Ini properti yang paling penting: belum lulus tidak boleh menulis progres.
    expect(mocks.selesaikanModulKuisVerified).not.toHaveBeenCalled();
    expect(mocks.getCourseById).not.toHaveBeenCalled();
  });

  it("menyelesaikan modul saat lulus, dengan policyVersion dari kursus server", async () => {
    mocks.kirimAttemptVerified.mockResolvedValue({
      attempt: { id: ATTEMPT, status: "submitted", score: 100 },
      score: 100,
      lulus: true,
    });

    const hasil = await kirimDanSelesaikanKuisAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
      attemptId: ATTEMPT,
      jawaban: [{ questionId: "q1", selectedOption: 0 }],
    });

    expect(mocks.selesaikanModulKuisVerified).toHaveBeenCalledTimes(1);
    expect(mocks.selesaikanModulKuisVerified).toHaveBeenCalledWith({
      principal: PRINCIPAL,
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
      attemptId: ATTEMPT,
      // 7 dari `getCourseById(...).kebijakan.versi` — tidak ada tempat di
      // signature action untuk versi dari klien.
      policyVersion: 7,
    });

    expect(hasil).toMatchObject({
      ok: true,
      attemptId: ATTEMPT,
      score: 100,
      lulus: true,
      kursus: { selesai: false },
      modul: { ok: true, aksi: "ditandai" },
    });
  });

  it("memakai kebijakan default bila kursus tidak membawa kebijakan", async () => {
    mocks.kirimAttemptVerified.mockResolvedValue({
      attempt: { id: ATTEMPT, status: "submitted", score: 100 },
      score: 100,
      lulus: true,
    });
    mocks.getCourseById.mockResolvedValue({ id: KURSUS, slug: "kursus-uji", title: "Kursus Uji" });

    await kirimDanSelesaikanKuisAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
      attemptId: ATTEMPT,
      jawaban: [{ questionId: "q1", selectedOption: 0 }],
    });

    const argumen = mocks.selesaikanModulKuisVerified.mock.calls[0]?.[0] as {
      policyVersion: number;
    };
    expect(argumen.policyVersion).toBe(1); // `kebijakanDefault().versi`
  });

  it("memetakan galat penyelesaian menjadi state, bukan melempar", async () => {
    mocks.kirimAttemptVerified.mockResolvedValue({
      attempt: { id: ATTEMPT, status: "submitted", score: 100 },
      score: 100,
      lulus: true,
    });
    mocks.selesaikanModulKuisVerified.mockRejectedValue(
      new mocks.GalatAsesmen("attempt_belum_lulus", "Attempt ini belum lulus."),
    );

    const hasil = await kirimDanSelesaikanKuisAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
      attemptId: ATTEMPT,
      jawaban: [{ questionId: "q1", selectedOption: 0 }],
    });

    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.error).toContain("belum lulus");
  });

  it("menolak tanpa sesi sebelum mengirim apa pun", async () => {
    mocks.getSession.mockResolvedValue(null);

    const hasil = await kirimDanSelesaikanKuisAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
      attemptId: ATTEMPT,
      jawaban: [{ questionId: "q1", selectedOption: 0 }],
    });

    expect(hasil.ok).toBe(false);
    expect(mocks.kirimAttemptVerified).not.toHaveBeenCalled();
    expect(mocks.selesaikanModulKuisVerified).not.toHaveBeenCalled();
  });
});
