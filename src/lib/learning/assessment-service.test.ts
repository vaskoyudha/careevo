import { beforeEach, describe, expect, it, vi } from "vitest";
import { principalUji } from "@/lib/auth/test-principal";
import type { Enrollment, LearningEvent, LearningRun, QuizAttempt } from "@/lib/db/schema";

/**
 * Test unit gerbang kamera `selesaikanModulKuisVerified` — tanpa database.
 *
 * Yang diuji: kelulusan kuis saja tidak cukup pada course `wajib_kamera`; run
 * aktif dengan kejadian `kamera_mulai` harus ada, dan bukti kamera dibaca dari
 * repository — bukan dari argumen. Penilaian snapshot di-mock karena sudah
 * diuji di `assessment-snapshot.test.ts`.
 */

const mocks = vi.hoisted(() => ({
  ambilAttempt: vi.fn(),
  ambilEnrollmentById: vi.fn(),
  ambilRunAktif: vi.fn(),
  listEventRun: vi.fn(),
  tandaiModulDb: vi.fn(),
  selesaikanKursusDb: vi.fn(),
  modulUntuk: vi.fn(),
}));

vi.mock("@/lib/learning/repository", () => ({
  ambilAttempt: mocks.ambilAttempt,
  ambilEnrollmentById: mocks.ambilEnrollmentById,
  ambilRunAktif: mocks.ambilRunAktif,
  listEventRun: mocks.listEventRun,
  buatAttemptBerikutnya: vi.fn(),
  kirimAttempt: vi.fn(),
}));

vi.mock("@/lib/learning/service", () => ({
  tandaiModulDb: mocks.tandaiModulDb,
  selesaikanKursusDb: mocks.selesaikanKursusDb,
}));

vi.mock("@/lib/courses/modul-resolver", () => ({ modulUntuk: mocks.modulUntuk }));
vi.mock("@/lib/courses/store", () => ({ getKuis: vi.fn() }));
vi.mock("./assessment-snapshot", () => ({
  hitungSkorSnapshot: vi.fn(),
  lulusSnapshot: vi.fn(() => true),
  snapshotKuis: vi.fn(),
}));

import { selesaikanModulKuisVerified } from "./assessment-service";

const PRINCIPAL = principalUji({ email: "siswa@careevo.test", nama: "Siswa Uji" });
const KURSUS = "crs-1";
const MODUL = "mod-1";
const KUIS = "kuis-1";

function attempt(partial: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    id: "att-1",
    userId: PRINCIPAL.userId,
    enrollmentId: "enr-1",
    quizId: KUIS,
    assessmentDefinitionVersion: "v1",
    assessmentSnapshot: { judul: "K", nilai_lulus: 70, soal: [] },
    status: "submitted",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    submittedAt: new Date("2026-01-01T00:10:00.000Z"),
    score: 90,
    gradingVersion: 1,
    attemptNumber: 1,
    ...partial,
  };
}

function enrollment(): Enrollment {
  return {
    id: "enr-1",
    userId: PRINCIPAL.userId,
    courseId: KURSUS,
    status: "active",
    enrolledAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: null,
    completionPath: null,
  };
}

function run(partial: Partial<LearningRun> = {}): LearningRun {
  return {
    id: "run-1",
    userId: PRINCIPAL.userId,
    enrollmentId: "enr-1",
    courseId: KURSUS,
    moduleId: null,
    state: "active",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2026-01-01T00:30:00.000Z"),
    completedAt: null,
    integrityVersion: 1,
    metadataRedacted: null,
    ...partial,
  };
}

function event(kind: string, sequence = 1): LearningEvent {
  return {
    id: `evt-${sequence}`,
    learningRunId: "run-1",
    kind,
    sequence,
    occurredAt: new Date("2026-01-01T00:01:00.000Z"),
    payloadRedacted: null,
  };
}

function selesaikan(wajibKamera: boolean) {
  return selesaikanModulKuisVerified({
    principal: PRINCIPAL,
    courseId: KURSUS,
    modulId: MODUL,
    quizId: KUIS,
    attemptId: "att-1",
    policyVersion: 1,
    wajibKamera,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ambilAttempt.mockResolvedValue(attempt());
  mocks.ambilEnrollmentById.mockResolvedValue(enrollment());
  mocks.modulUntuk.mockResolvedValue([{ id: MODUL, kuis: [{ id: KUIS }] }]);
  mocks.tandaiModulDb.mockResolvedValue({ ok: true, aksi: "ditandai" });
  mocks.selesaikanKursusDb.mockResolvedValue({ selesai: false, selesaiCount: 1, total: 5 });
  mocks.ambilRunAktif.mockResolvedValue(null);
  mocks.listEventRun.mockResolvedValue([]);
});

describe("selesaikanModulKuisVerified — gerbang wajib_kamera", () => {
  it("menolak penyelesaian tanpa run aktif", async () => {
    mocks.ambilRunAktif.mockResolvedValue(null);

    await expect(selesaikan(true)).rejects.toMatchObject({ kode: "perlu_kamera" });
    expect(mocks.tandaiModulDb).not.toHaveBeenCalled();
  });

  it("menolak run aktif yang tidak punya kamera_mulai", async () => {
    mocks.ambilRunAktif.mockResolvedValue(run());
    mocks.listEventRun.mockResolvedValue([event("sesi_dimulai")]);

    await expect(selesaikan(true)).rejects.toMatchObject({ kode: "perlu_kamera" });
    expect(mocks.tandaiModulDb).not.toHaveBeenCalled();
  });

  it("menerima run aktif dengan kamera_mulai", async () => {
    mocks.ambilRunAktif.mockResolvedValue(run());
    mocks.listEventRun.mockResolvedValue([event("sesi_dimulai"), event("kamera_mulai", 2)]);

    const hasil = await selesaikan(true);

    // Lingkup run harus terikat pada **course yang sedang diselesaikan**:
    // `ambilRunAktif` di sini di-mock tanpa memeriksa argumen, jadi tanpa
    // patokan ini `courseId` bisa hilang tanpa satu pun test merah — dan run
    // berkamera milik course lain akan melepas gerbang kuis course ini.
    expect(mocks.ambilRunAktif).toHaveBeenCalledWith(PRINCIPAL.userId, KURSUS);
    expect(hasil.modul.ok).toBe(true);
    expect(mocks.tandaiModulDb).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: KURSUS, modulId: MODUL, sumber: "terverifikasi" }),
    );
  });

  it("tidak menuntut kamera pada course wajib biasa", async () => {
    // `wajibKamera: false`: run aktif pun tidak perlu dibaca — inilah yang
    // menjaga jalur kuis `wajib` biasa tetap bebas kamera.
    const hasil = await selesaikan(false);

    expect(hasil.modul.ok).toBe(true);
    expect(mocks.ambilRunAktif).not.toHaveBeenCalled();
    expect(mocks.tandaiModulDb).toHaveBeenCalled();
  });
});
