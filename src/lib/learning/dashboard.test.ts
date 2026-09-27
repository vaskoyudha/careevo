import { describe, expect, it } from "vitest";
import type { LearningEvent, LearningRun, ModuleProgressRow } from "@/lib/db/schema";
import type { EnrollmentStaf } from "@/lib/learning/repository";
import {
  barisPembelajaranDariDb,
  detailPembelajaranDariDb,
  kejadianDariEvent,
  sessionRunDariDb,
  statusRunDari,
  type AttemptDashboard,
} from "./dashboard";

/**
 * Test unit adapter dashboard — **murni, tanpa database**.
 *
 * Yang diuji adalah keputusan yang menentukan angka di laporan: penyebut
 * rata-rata kuis, pemisahan "belum dinilai" dari "nol", dan pemetaan status run.
 * Kesalahan di sini tidak pernah melempar error — ia hanya menampilkan angka
 * yang keliru dengan yakin, jadi invariannya dipatok eksplisit.
 */

const EMAIL_A = "ani@careevo.test";
const EMAIL_B = "budi@careevo.test";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function enrollment(input: {
  id: string;
  userId: string;
  nama: string;
  email: string;
  courseId?: string;
}): EnrollmentStaf {
  return {
    enrollment: {
      id: input.id,
      userId: input.userId,
      courseId: input.courseId ?? "crs-1",
      status: "active",
      enrolledAt: new Date("2026-01-01T00:00:00.000Z"),
      completedAt: null,
      completionPath: null,
    },
    user: { userId: input.userId, nama: input.nama, email: input.email },
  };
}

function progres(
  enrollmentId: string,
  moduleId: string,
  completionPath: "terverifikasi" | "informal" | null = "informal",
  state = "completed",
): ModuleProgressRow {
  return {
    enrollmentId,
    moduleId,
    state,
    completedAt: new Date("2026-01-02T00:00:00.000Z"),
    completionPath,
    evidenceId: null,
  };
}

/** `progres` dengan `evidence_id` yang menunjuk bukti — jalur diturunkan dari situ. */
function progresDenganRun(
  enrollmentId: string,
  moduleId: string,
  completionPath: "terverifikasi" | "informal" | null,
  evidenceId: string | null,
): ModuleProgressRow {
  return { ...progres(enrollmentId, moduleId, completionPath), evidenceId };
}

function attempt(input: {
  enrollmentId: string;
  status: string;
  score: number | null;
  quizId?: string | null;
}): AttemptDashboard {
  return {
    id: `att-${input.enrollmentId}-${input.quizId ?? "q"}`,
    enrollmentId: input.enrollmentId,
    quizId: input.quizId ?? "kuis-1",
    status: input.status,
    score: input.score,
    submittedAt: new Date("2026-01-03T00:00:00.000Z"),
  };
}

describe("barisPembelajaranDariDb", () => {
  it("satu baris per peserta, modul dihitung lintas kursusnya", () => {
    const baris = barisPembelajaranDariDb({
      enrollments: [
        enrollment({ id: "e1", userId: USER_A, nama: "Ani", email: EMAIL_A, courseId: "crs-1" }),
        enrollment({ id: "e2", userId: USER_A, nama: "Ani", email: EMAIL_A, courseId: "crs-2" }),
      ],
      progress: [
        progres("e1", "crs-1-m1", "terverifikasi"),
        progres("e2", "crs-2-m1", "informal"),
      ],
      attempts: [],
    });

    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ owner: EMAIL_A, nama: "Ani", selesai: 2, terverifikasi: 1 });
  });

  it("hanya baris completed yang dihitung, baik untuk selesai maupun terverifikasi", () => {
    const baris = barisPembelajaranDariDb({
      enrollments: [enrollment({ id: "e1", userId: USER_A, nama: "Ani", email: EMAIL_A })],
      progress: [
        progres("e1", "crs-1-m1", "terverifikasi"),
        progres("e1", "crs-1-m2", "terverifikasi", "in_progress"),
        progres("e1", "crs-1-m3", "informal"),
      ],
      attempts: [],
    });

    expect(baris[0].selesai).toBe(2);
    expect(baris[0].terverifikasi).toBe(1);
  });

  it("completion_path null dihitung selesai tetapi tidak terverifikasi", () => {
    const baris = barisPembelajaranDariDb({
      enrollments: [enrollment({ id: "e1", userId: USER_A, nama: "Ani", email: EMAIL_A })],
      progress: [progres("e1", "crs-1-m1", null)],
      attempts: [],
    });

    expect(baris[0].selesai).toBe(1);
    expect(baris[0].terverifikasi).toBe(0);
  });

  it("terverifikasi hanya dari baris yang benar-benar terverifikasi", () => {
    const baris = barisPembelajaranDariDb({
      enrollments: [enrollment({ id: "e1", userId: USER_A, nama: "Ani", email: EMAIL_A })],
      progress: [
        progres("e1", "crs-1-m1", "terverifikasi"),
        progres("e1", "crs-1-m2", "informal"),
        progres("e1", "crs-1-m3", "terverifikasi"),
      ],
      attempts: [],
    });

    expect(baris[0]).toMatchObject({ selesai: 3, terverifikasi: 2 });
  });

  it("rata-rata kuis null bila belum ada attempt submitted", () => {
    const baris = barisPembelajaranDariDb({
      enrollments: [enrollment({ id: "e1", userId: USER_A, nama: "Ani", email: EMAIL_A })],
      progress: [],
      attempts: [attempt({ enrollmentId: "e1", status: "in_progress", score: null })],
    });

    // Bukan 0: "belum dinilai" dan "dinilai nol" adalah dua klaim berbeda.
    expect(baris[0].rataRataKuis).toBeNull();
    expect(baris[0].selesai).toBe(0);
  });

  it("rata-rata hanya dari attempt submitted yang punya skor, dibulatkan", () => {
    const baris = barisPembelajaranDariDb({
      enrollments: [enrollment({ id: "e1", userId: USER_A, nama: "Ani", email: EMAIL_A })],
      progress: [],
      attempts: [
        attempt({ enrollmentId: "e1", status: "submitted", score: 80 }),
        attempt({ enrollmentId: "e1", status: "submitted", score: 75 }),
        // Attempt submitted tanpa skor tidak boleh menarik rata-rata ke bawah.
        attempt({ enrollmentId: "e1", status: "submitted", score: null }),
      ],
    });

    expect(baris[0].rataRataKuis).toBe(78); // (80 + 75) / 2 = 77.5 → 78
  });

  it("nilai nol yang benar-benar tersimpan dihitung nol, bukan 'belum ada'", () => {
    const baris = barisPembelajaranDariDb({
      enrollments: [enrollment({ id: "e1", userId: USER_A, nama: "Ani", email: EMAIL_A })],
      progress: [],
      attempts: [attempt({ enrollmentId: "e1", status: "submitted", score: 0 })],
    });

    expect(baris[0].rataRataKuis).toBe(0);
  });

  it("peserta tanpa satu pun baris tetap muncul dengan angka nol", () => {
    const baris = barisPembelajaranDariDb({
      enrollments: [enrollment({ id: "e1", userId: USER_A, nama: "Ani", email: EMAIL_A })],
      progress: [],
      attempts: [],
    });

    expect(baris).toEqual([
      { owner: EMAIL_A, nama: "Ani", selesai: 0, terverifikasi: 0, rataRataKuis: null },
    ]);
  });

  it("baris yatim (enrollment/progres user lain) tidak bocor ke peserta mana pun", () => {
    const baris = barisPembelajaranDariDb({
      enrollments: [
        enrollment({ id: "e1", userId: USER_A, nama: "Ani", email: EMAIL_A }),
        enrollment({ id: "e2", userId: USER_B, nama: "Budi", email: EMAIL_B }),
      ],
      progress: [
        progres("e1", "crs-1-m1", "terverifikasi"),
        progres("e99", "crs-9-m1", "terverifikasi"), // enrollment tidak ada
      ],
      attempts: [attempt({ enrollmentId: "e99", status: "submitted", score: 100 })],
    });

    expect(baris.find((b) => b.owner === EMAIL_A)).toMatchObject({ selesai: 1, rataRataKuis: null });
    expect(baris.find((b) => b.owner === EMAIL_B)).toMatchObject({ selesai: 0, rataRataKuis: null });
  });

  it("urut menurut nama (locale id)", () => {
    const baris = barisPembelajaranDariDb({
      enrollments: [
        enrollment({ id: "e1", userId: USER_B, nama: "Budi", email: EMAIL_B }),
        enrollment({ id: "e2", userId: USER_A, nama: "Ani", email: EMAIL_A }),
      ],
      progress: [],
      attempts: [],
    });

    expect(baris.map((b) => b.nama)).toEqual(["Ani", "Budi"]);
  });
});

describe("detailPembelajaranDariDb", () => {
  it("null bila tidak ada enrollment", () => {
    expect(
      detailPembelajaranDariDb({ enrollments: [], progress: [], attempts: [] }),
    ).toBeNull();
  });

  it("mengelompokkan progres dan attempt per kursus, memakai judul bila ada", () => {
    const detail = detailPembelajaranDariDb({
      enrollments: [
        enrollment({ id: "e1", userId: USER_A, nama: "Ani", email: EMAIL_A, courseId: "crs-1" }),
        enrollment({ id: "e2", userId: USER_A, nama: "Ani", email: EMAIL_A, courseId: "crs-2" }),
      ],
      progress: [progres("e1", "crs-1-m1", "terverifikasi"), progres("e2", "crs-2-m1", "informal")],
      attempts: [
        attempt({ enrollmentId: "e1", status: "submitted", score: 90, quizId: "kuis-1" }),
        attempt({ enrollmentId: "e1", status: "in_progress", score: null, quizId: "kuis-2" }),
      ],
      judul: new Map([["crs-1", "Kursus Satu"]]),
    });

    expect(detail?.owner).toBe(EMAIL_A);
    expect(detail?.nama).toBe("Ani");
    // Kursus tanpa judul di peta jatuh ke course_id apa adanya, bukan kosong.
    expect(detail?.kursus.map((k) => k.judul)).toEqual(["crs-2", "Kursus Satu"]);

    const satu = detail?.kursus.find((k) => k.course_id === "crs-1");
    expect(satu?.selesai).toHaveLength(1);
    expect(satu?.selesai[0]).toMatchObject({ modul_id: "crs-1-m1", sumber: "terverifikasi" });
    // Percobaan belum dikirim tetap tercatat, dengan nilai null — bukan 0.
    expect(satu?.kuis.map((q) => [q.kuis_id, q.nilai])).toEqual([
      ["kuis-1", 90],
      ["kuis-2", null],
    ]);
    // Setiap baris `quiz_attempts` dinilai server dari snapshot attempt.
    expect(satu?.kuis.every((q) => q.skor === "server")).toBe(true);
  });

  it("jalur tak dikenal turun ke informal, tidak pernah naik ke terverifikasi", () => {
    const detail = detailPembelajaranDariDb({
      enrollments: [enrollment({ id: "e1", userId: USER_A, nama: "Ani", email: EMAIL_A })],
      progress: [progres("e1", "crs-1-m1", "entah" as unknown as "informal")],
      attempts: [],
    });

    expect(detail?.kursus[0].selesai[0].sumber).toBe("informal");
  });
});

describe("detailPembelajaranDariDb — jalur terlihat", () => {
  const ENR = { id: "enr-1", userId: USER_A, nama: "Ani", email: EMAIL_A };

  it("menandai jalur terverifikasi yang ditopang kamera", () => {
    const hasil = detailPembelajaranDariDb({
      enrollments: [enrollment(ENR)],
      progress: [progresDenganRun(ENR.id, "crs-1-m1", "terverifikasi", "run-1")],
      attempts: [],
      kameraMulai: new Map([["run-1", true]]),
    });
    expect(hasil?.kursus[0]?.selesai[0]?.jalur).toBe("terverifikasi_kamera");
  });

  it("menandai jalur terverifikasi tanpa kamera sebagai terverifikasi biasa", () => {
    const hasil = detailPembelajaranDariDb({
      enrollments: [enrollment(ENR)],
      progress: [progresDenganRun(ENR.id, "crs-1-m1", "terverifikasi", "run-1")],
      attempts: [],
      kameraMulai: new Map([["run-1", false]]),
    });
    expect(hasil?.kursus[0]?.selesai[0]?.jalur).toBe("terverifikasi");
  });

  it("menandai penyelesaian kuis sebagai jalur tanpa bukti kamera yang bisa ditelusuri", () => {
    // Jalur kuis menyimpan `quiz_attempts.id` di `evidence_id`. Id itu tidak
    // akan pernah ada di peta run, dan memang tidak boleh dipaksa jadi run:
    // labelnya harus menyatakan "tidak bisa ditelusuri", bukan "kamera mati".
    const hasil = detailPembelajaranDariDb({
      enrollments: [enrollment(ENR)],
      progress: [progresDenganRun(ENR.id, "crs-1-m1", "terverifikasi", "att-1")],
      attempts: [],
      kameraMulai: new Map([["run-1", true]]),
    });
    expect(hasil?.kursus[0]?.selesai[0]?.jalur).toBe("terverifikasi_tanpa_bukti_kamera");
  });

  it("menandai progres tanpa evidence_id sebagai jalur tanpa bukti kamera", () => {
    const hasil = detailPembelajaranDariDb({
      enrollments: [enrollment(ENR)],
      progress: [progresDenganRun(ENR.id, "crs-1-m1", "terverifikasi", null)],
      attempts: [],
      kameraMulai: new Map([["run-1", true]]),
    });
    expect(hasil?.kursus[0]?.selesai[0]?.jalur).toBe("terverifikasi_tanpa_bukti_kamera");
  });

  it("progres tanpa peta kamera tidak pernah mengklaim kamera", () => {
    // Halaman yang tidak mengirim peta harus tetap benar — bukan melempar, dan
    // bukan mengarang bukti kamera.
    const hasil = detailPembelajaranDariDb({
      enrollments: [enrollment(ENR)],
      progress: [progresDenganRun(ENR.id, "crs-1-m1", "terverifikasi", "run-1")],
      attempts: [],
    });
    expect(hasil?.kursus[0]?.selesai[0]?.jalur).toBe("terverifikasi");
  });
});

describe("statusRunDari", () => {
  it("memetakan ketiga state ke kosakata UI", () => {
    expect(statusRunDari({ state: "active" })).toBe("aktif");
    expect(statusRunDari({ state: "completed" })).toBe("diakhiri");
    expect(statusRunDari({ state: "expired" })).toBe("kedaluwarsa");
  });

  it("state tak dikenal gagal-tertutup menjadi kedaluwarsa, bukan aktif", () => {
    expect(statusRunDari({ state: "entah" })).toBe("kedaluwarsa");
  });
});

describe("kejadianDariEvent", () => {
  function event(kind: string, payload: unknown): LearningEvent {
    return {
      id: "ev-1",
      learningRunId: "run-1",
      kind,
      sequence: 1,
      occurredAt: new Date("2026-01-04T00:00:00.000Z"),
      payloadRedacted: payload as LearningEvent["payloadRedacted"],
    };
  }

  it("membaca klasifikasi dan visibilitas dari payload yang sudah ditetapkan server", () => {
    const hasil = kejadianDariEvent(
      event("pindah_tab", { jenis_klasifikasi: "celah", visibilitas: "visible", detail: "ke dokumen" }),
    );

    expect(hasil).toMatchObject({
      jenis: "pindah_tab",
      jenis_klasifikasi: "celah",
      visibilitas: "visible",
      detail: "ke dokumen",
      at: "2026-01-04T00:00:00.000Z",
    });
  });

  it("menghitung ulang klasifikasi bila payload lama tidak menyimpannya", () => {
    // `kamera_gagal` selalu celah; tanpa cabang ini, kejadian itu tampil sebagai
    // kejadian biasa dan temuan pengawasan hilang dari laporan.
    const hasil = kejadianDariEvent(event("kamera_gagal", { visibilitas: null }));

    expect(hasil?.jenis_klasifikasi).toBe("celah");
    expect(hasil?.visibilitas).toBeNull();
  });

  it("membuang jenis di luar JENIS_KEJADIAN_SAH", () => {
    expect(kejadianDariEvent(event("entah_apa", null))).toBeNull();
  });

  it("payload kosong tidak menggagalkan pembacaan", () => {
    const hasil = kejadianDariEvent(event("sesi_dimulai", null));

    expect(hasil).toMatchObject({ jenis: "sesi_dimulai", jenis_klasifikasi: "kejadian" });
    expect(hasil?.detail).toBeUndefined();
  });
});

describe("sessionRunDariDb", () => {
  function run(partial: Partial<LearningRun> = {}): LearningRun {
    return {
      id: "run-1",
      userId: USER_A,
      enrollmentId: "e1",
      courseId: "crs-1",
      moduleId: null,
      state: "active",
      startedAt: new Date("2026-01-05T00:00:00.000Z"),
      expiresAt: new Date("2026-01-05T00:30:00.000Z"),
      completedAt: null,
      integrityVersion: 2,
      metadataRedacted: null,
      ...partial,
    };
  }

  it("memetakan run aktif ke SessionRun dengan berakhir_at null", () => {
    const sesi = sessionRunDariDb(run(), []);

    expect(sesi).toMatchObject({
      id: "run-1",
      course_id: "crs-1",
      owner: USER_A,
      policy_version: 2,
      status: "aktif",
      mulai_at: "2026-01-05T00:00:00.000Z",
      berlaku_hingga: "2026-01-05T00:30:00.000Z",
      berakhir_at: null,
    });
    expect(sesi.kejadian).toEqual([]);
  });

  it("run yang diakhiri membawa berakhir_at, run kedaluwarsa tanpa completedAt tetap valid", () => {
    const diakhiri = sessionRunDariDb(
      run({ state: "completed", completedAt: new Date("2026-01-05T00:20:00.000Z") }),
      [],
    );
    expect(diakhiri.status).toBe("diakhiri");
    expect(diakhiri.berakhir_at).toBe("2026-01-05T00:20:00.000Z");

    const kedaluwarsa = sessionRunDariDb(run({ state: "expired", completedAt: null }), []);
    expect(kedaluwarsa.status).toBe("kedaluwarsa");
    expect(kedaluwarsa.berakhir_at).toBeNull();
  });

  it("hanya kejadian sah yang diteruskan ke lini masa", () => {
    const sesi = sessionRunDariDb(run(), [
      {
        id: "ev-1",
        learningRunId: "run-1",
        kind: "kamera_gagal",
        sequence: 1,
        occurredAt: new Date("2026-01-05T00:01:00.000Z"),
        payloadRedacted: { jenis_klasifikasi: "celah", visibilitas: null },
      },
      {
        id: "ev-2",
        learningRunId: "run-1",
        kind: "entah",
        sequence: 2,
        occurredAt: new Date("2026-01-05T00:02:00.000Z"),
        payloadRedacted: null,
      },
    ]);

    expect(sesi.kejadian.map((k) => k.jenis)).toEqual(["kamera_gagal"]);
  });
});
