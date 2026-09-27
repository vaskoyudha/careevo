import { beforeEach, describe, expect, it, vi } from "vitest";
import { principalUji } from "@/lib/auth/test-principal";
import type { SessionPrincipal } from "@/lib/auth/principal";
import type { LearningEvent, LearningRun } from "@/lib/db/schema";

/**
 * Setelah cutover Fase 2, run dan kejadiannya hidup di `learning_runs` /
 * `learning_events` lewat `run-service.ts` + `repository.ts`; cookie dan
 * `.data/sessions/*.json` tidak lagi menjadi penyimpanan otoritatif.
 *
 * Test ini karena itu mem-mock **lapisan service/repository**, bukan berkas
 * sesi: yang diuji adalah keputusan action (urutan gerbang, bentuk balasan,
 * delegasi argumen), sedangkan invariant penyimpanannya (satu run aktif per
 * user+course, sequence anti-replay, kepemilikan) sudah dikunci
 * `run-service.integration.test.ts` di atas Postgres.
 *
 * Yang **tidak** dimock: `@/lib/learning/dashboard` (`sessionRunDariDb`) —
 * ia murni, dan justru itu yang membuktikan action mengembalikan bentuk yang
 * dikenali klien (`kejadian[]`, status `aktif`/`diakhiri`).
 */

/** Toko in-memory yang menirukan baris `learning_runs`/`learning_events`. */
const store = vi.hoisted(() => ({
  runs: new Map<string, LearningRun>(),
  events: new Map<string, LearningEvent[]>(),
  /** `(userId, courseId)` → id modul selesai; menggerakkan aksi idempoten. */
  selesai: new Map<string, string[]>(),
  /** Enrollment yang dianggap ada, per `userId`. */
  terdaftar: new Map<string, Set<string>>(),
  urut: 0,
}));

const { auth } = vi.hoisted(() => ({ auth: { sesi: null as SessionPrincipal | null } }));
const { tandaiModulDb, selesaikanKursusDb } = vi.hoisted(() => ({ tandaiModulDb: vi.fn(), selesaikanKursusDb: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getSession: async () => auth.sesi }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/learning/service", () => ({
  progresKursusDb: async (principal: SessionPrincipal, courseId: string) => {
    const k = `${principal.userId}:${courseId}`;
    if (!store.terdaftar.get(principal.userId)?.has(courseId)) {
      return { enrollment: null, selesai: [] };
    }
    return {
      enrollment: {
        id: `enr-${k}`,
        userId: principal.userId,
        courseId,
        status: "active" as const,
        enrolledAt: new Date("2026-09-01T08:00:00.000Z"),
        completedAt: null,
        completionPath: null,
      },
      selesai: store.selesai.get(k) ?? [],
    };
  },
  tandaiModulDb,
  selesaikanKursusDb,
}));

/**
 * Mock run-service dengan invariant yang sama seperti aslinya, sekaligus
 * memakai HMAC bukti yang **nyata** (`session.ts`) supaya test "bukti tidak
 * sah" benar-benar menguji tanda tangan, bukan string kosong.
 */
vi.mock("@/lib/learning/run-service", async () => {
  const { buktiBaru, verifikasiBuktiSesi } = await vi.importActual<
    typeof import("@/lib/learning/session")
  >("@/lib/learning/session");
  const { JENIS_KEJADIAN_SAH, klasifikasiKejadian } = await vi.importActual<
    typeof import("@/lib/learning/akses")
  >("@/lib/learning/akses");

  const buktiUntuk = (courseId: string, userId: string, policyVersion: number) =>
    buktiBaru({ courseId, owner: userId.trim().toLowerCase(), policyVersion });

  function kedaluwarsa(run: LearningRun, now = Date.now()): boolean {
    const akhir = run.expiresAt instanceof Date ? run.expiresAt.getTime() : Number.NaN;
    if (!Number.isFinite(akhir)) return true;
    return now >= akhir;
  }

  function aktif(userId: string, courseId: string): LearningRun | undefined {
    return [...store.runs.values()].find(
      (run) => run.userId === userId && run.courseId === courseId && run.state === "active",
    );
  }

  function catat(run: LearningRun, kind: string, payloadRedacted: object | null): LearningEvent {
    const daftar = store.events.get(run.id) ?? [];
    const baris: LearningEvent = {
      id: `evt-${(store.urut += 1)}`,
      learningRunId: run.id,
      kind,
      sequence: daftar.length + 1,
      occurredAt: new Date(),
      payloadRedacted,
    };
    store.events.set(run.id, [...daftar, baris]);
    return baris;
  }

  return {
    mulaiRunDb: async (input: {
      principal: SessionPrincipal;
      enrollmentId: string;
      courseId: string;
      moduleId?: string | null;
      policyVersion: number;
      batasMenit?: number;
    }) => {
      const userId = input.principal.userId;
      const ada = aktif(userId, input.courseId);
      if (ada && !kedaluwarsa(ada)) {
        return {
          run: ada,
          bukti: buktiUntuk(input.courseId, userId, input.policyVersion),
        };
      }
      if (ada) store.runs.set(ada.id, { ...ada, state: "expired", completedAt: new Date() });

      const batasMenit =
        Number.isFinite(input.batasMenit) && (input.batasMenit as number) >= 0
          ? (input.batasMenit as number)
          : 30;
      const run: LearningRun = {
        id: `run-${(store.urut += 1)}`,
        userId,
        enrollmentId: input.enrollmentId,
        courseId: input.courseId,
        moduleId: input.moduleId ?? null,
        state: "active",
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + batasMenit * 60_000),
        completedAt: null,
        integrityVersion: input.policyVersion,
        metadataRedacted: null,
      };
      store.runs.set(run.id, run);
      return { run, bukti: buktiUntuk(input.courseId, userId, input.policyVersion) };
    },

    catatKejadianDb: async (input: {
      principal: SessionPrincipal;
      runId: string;
      jenis: string;
      visibilitas: "visible" | "hidden" | null;
      detail?: string;
    }) => {
      if (!(JENIS_KEJADIAN_SAH as readonly string[]).includes(input.jenis)) return null;
      const run = store.runs.get(input.runId);
      if (!run) return null;
      if (run.userId !== input.principal.userId) return null;
      if (run.state !== "active") return null;
      return catat(run, input.jenis, {
        jenis_klasifikasi: klasifikasiKejadian(
          input.jenis as (typeof JENIS_KEJADIAN_SAH)[number],
          input.visibilitas,
        ),
        visibilitas: input.visibilitas,
        ...(input.detail ? { detail: input.detail.slice(0, 300) } : {}),
      });
    },

    akhiriRunDb: async (input: { principal: SessionPrincipal; runId: string; alasan: string }) => {
      const run = store.runs.get(input.runId);
      if (!run) return null;
      if (run.userId !== input.principal.userId) return null;
      if (run.state !== "active") return run;
      const ditutup: LearningRun = { ...run, state: "completed", completedAt: new Date() };
      store.runs.set(run.id, ditutup);
      return ditutup;
    },

    buktikanSesiDb: async (input: {
      userId: string;
      courseId: string;
      policyVersion: number;
      token: string;
    }) => {
      const bukti = verifikasiBuktiSesi(input.token, {
        courseId: input.courseId,
        owner: input.userId.trim().toLowerCase(),
        policyVersion: input.policyVersion,
      });
      if (!bukti) return null;
      const run = aktif(input.userId, input.courseId);
      if (!run) return null;
      if (kedaluwarsa(run)) {
        store.runs.set(run.id, { ...run, state: "expired", completedAt: new Date() });
        return null;
      }
      if (run.integrityVersion !== input.policyVersion) return null;
      return run;
    },
  };
});

vi.mock("@/lib/learning/repository", () => ({
  ambilRun: async (id: string) => store.runs.get(id) ?? null,
  listEventRun: async (runId: string) => store.events.get(runId) ?? [],
}));

const { mulaiSesiAction, catatKejadianAction, selesaikanMateriAction, akhiriSesiAction } =
  await import("./learning");
const { createModul, resetCourses } = await import("@/lib/courses/store");

const sesi = principalUji({
  email: "siswa@careevo.test",
  nama: "Siswa",
  username: "siswa",
  role: "user",
});

/** Daftarkan principal sebagai peserta sebuah kursus (sebelum action dipanggil). */
function seedTerdaftar(courseId: string, principal: SessionPrincipal = sesi): void {
  const daftar = store.terdaftar.get(principal.userId) ?? new Set<string>();
  daftar.add(courseId);
  store.terdaftar.set(principal.userId, daftar);
}

/**
 * Mundurkan `startedAt` sebuah run supaya batas waktu bisa diuji tanpa menunggu.
 *
 * Sama seperti versi berkas dulu: `expiresAt` **tidak** ikut mundur, sehingga
 * perbedaan antara "sesi masih berlaku" dan "batas modul terlampaui" tetap
 * bisa dipisahkan — persis dua mekanisme yang berbeda.
 */
function mundurkanRun(runId: string, milidetik: number): void {
  const run = store.runs.get(runId);
  if (!run) throw new Error(`Run ${runId} tidak ada`);
  store.runs.set(runId, {
    ...run,
    startedAt: new Date(run.startedAt.getTime() - milidetik),
  });
}

beforeEach(() => {
  resetCourses();
  store.runs.clear();
  store.events.clear();
  store.selesai.clear();
  store.terdaftar.clear();
  store.urut = 0;
  auth.sesi = sesi;
  vi.clearAllMocks();
  seedTerdaftar("crs-1");
  seedTerdaftar("crs-2");
  seedTerdaftar("crs-3");
  selesaikanKursusDb.mockResolvedValue({ selesai: false, selesaiCount: 1, total: 5 });
  tandaiModulDb.mockImplementation(
    async (input: { principal: SessionPrincipal; courseId: string; modulId: string }) => {
      const k = `${input.principal.userId}:${input.courseId}`;
      const daftar = store.selesai.get(k) ?? [];
      store.selesai.set(k, daftar.includes(input.modulId) ? daftar : [...daftar, input.modulId]);
      return { ok: true, aksi: "ditandai" };
    },
  );
});

describe("mulaiSesiAction", () => {
  it("creates a session and returns a proof token", async () => {
    const hasil = await mulaiSesiAction("crs-1");
    expect(hasil.ok).toBe(true);
    expect(hasil.bukti).toBeTruthy();
    // Pemilik otoritatif run sekarang `users.id` (uuid), bukan email: itulah
    // kunci kepemilikan yang dipakai `learning_runs.user_id`.
    expect(hasil.run?.owner).toBe(sesi.userId);
    expect(hasil.run?.status).toBe("aktif");
    // Kejadian `sesi_dimulai` ditulis sekali oleh action setelah run pasti ada.
    expect(hasil.run?.kejadian.map((k) => k.jenis)).toEqual(["sesi_dimulai"]);
  });

  it("rejects a course the caller is not enrolled in", async () => {
    // `crs-1` ada dan published, tetapi pemanggil tidak terdaftar di test ini.
    store.terdaftar.delete(sesi.userId);
    const hasil = await mulaiSesiAction("crs-1");
    expect(hasil.ok).toBe(false);
    // Pesan implementasi memakai huruf besar ("Daftar kursus ini dulu..."),
    // jadi pencocokan dilakukan tanpa peduli huruf besar/kecil.
    expect(hasil.error?.toLowerCase()).toContain("daftar");
  });

  it("melanjutkan run yang masih aktif, bukan membuat run kedua", async () => {
    const pertama = await mulaiSesiAction("crs-1");
    const kedua = await mulaiSesiAction("crs-1");
    expect(pertama.ok).toBe(true);
    expect(kedua.ok).toBe(true);
    // Run ganda muncul dari alur normal: status sesi hanya hidup di state
    // React, jadi memuat ulang halaman kursus membuat "Mulai sesi" tampil lagi
    // — dan mengkliknya melahirkan run kedua.
    expect(kedua.runId).toBe(pertama.runId);
    // Kejadian `sesi_dimulai` tidak ikut digandakan oleh run yang dilanjutkan.
    expect(kedua.run?.kejadian).toHaveLength(1);
    expect(store.runs.size).toBe(1);
  });
});

describe("selesaikanMateriAction", () => {
  it("rejects a missing session proof", async () => {
    const hasil = await selesaikanMateriAction({ courseId: "crs-1", modulId: "crs-1-m1", bukti: "" });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("sesi");
    expect(tandaiModulDb).not.toHaveBeenCalled();
  });

  it("menolak bukti sesi yang tidak sah", async () => {
    // Yang dibuktikan di sini adalah verifikasi bukti, bukan pendaftaran:
    // bukti palsu tidak punya tanda tangan HMAC yang sah, jadi keputusannya
    // `perlu_sesi` dan tidak ada modul yang ditulis.
    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: "bukti-palsu",
    });
    expect(hasil.ok).toBe(false);
    expect(tandaiModulDb).not.toHaveBeenCalled();
  });

  it("rejects a module whose checkpoint is not `materi`", async () => {
    // Modul tersimpan dengan checkpoint kuis: menyelesaikannya lewat penandaan
    // materi harus ditolak, sebab kelulusannya hanya sah dari kuis.
    const modulKuis = await createModul("crs-3", {
      judul: "Kuis Keamanan Dasar",
      ringkasan: "Uji pemahaman dasar OWASP lewat kuis tersimpan.",
      durasi_min: 20,
      checkpoint: { mode: "kuis", batas_waktu_menit: 20 },
    });
    expect(modulKuis).not.toBeNull();

    const mulai = await mulaiSesiAction("crs-3");
    expect(mulai.ok).toBe(true);
    const hasil = await selesaikanMateriAction({
      courseId: "crs-3",
      modulId: modulKuis!.id,
      bukti: mulai.bukti ?? "",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("kuis");
    expect(tandaiModulDb).not.toHaveBeenCalled();
  });

  it("accepts a valid proof for a required-proctoring course", async () => {
    const mulai = await mulaiSesiAction("crs-2");
    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: mulai.bukti ?? "",
    });
    expect(hasil.ok).toBe(true);
  });

  it("menolak penyelesaian yang sudah melewati batas waktu checkpoint", async () => {
    // Dua modul dengan batas berbeda adalah syarat test ini. Batas sesi memakai
    // **maksimum** course (60 menit), sedangkan batas modul target 5 menit.
    // Memundurkan 10 menit membuat sesi masih sah tetapi modul target sudah
    // lewat — persis perbedaan antara dua mekanisme yang harus dibuktikan.
    //
    // Kalau course hanya punya modul turunan, keduanya sama-sama 30 menit dan
    // test ini tidak bisa memisahkannya: `startedAt` yang dimundurkan ikut
    // membuat sesi kedaluwarsa, sehingga aksi menolak dengan pesan "perlu sesi"
    // alih-alih "batas waktu".
    const cepat = await createModul("crs-2", {
      judul: "Modul Cepat",
      ringkasan: "Batas 5 menit.",
      durasi_min: 5,
      checkpoint: { mode: "materi", batas_waktu_menit: 5 },
    });
    await createModul("crs-2", {
      judul: "Modul Panjang",
      ringkasan: "Batas 60 menit.",
      durasi_min: 60,
      checkpoint: { mode: "materi", batas_waktu_menit: 60 },
    });

    const mulai = await mulaiSesiAction("crs-2");
    mundurkanRun(mulai.runId!, 10 * 60_000);

    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: cepat!.id,
      bukti: mulai.bukti ?? "",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("batas waktu");
    // Penolakan tidak boleh menulis apa pun.
    expect(tandaiModulDb).not.toHaveBeenCalled();
  });
});

/**
 * Kelengkapan terverifikasi: gerbangnya sudah benar sejak awal, tetapi
 * sebelum ini jalur terverifikasi hanya me-revalidasi dan tidak pernah
 * menulis progres, sehingga centang "terverifikasi" hidup hanya di
 * state klien dan hilang begitu halaman dimuat ulang. Test di blok ini menuntut
 * **keadaan tersimpan**, bukan nilai balik action.
 */
describe("selesaikanMateriAction — penyimpanan progres terverifikasi", () => {
  it("mencatat completion setelah modul terverifikasi diselesaikan", async () => {
    selesaikanKursusDb.mockResolvedValueOnce({ selesai: true, completion: { id: "completion-1" }, baru: true });
    const mulai = await mulaiSesiAction("crs-2");
    const hasil = await selesaikanMateriAction({
      courseId: "crs-2", modulId: "crs-2-m1", bukti: mulai.bukti ?? "",
    });
    expect(hasil.ok).toBe(true);
    expect(selesaikanKursusDb).toHaveBeenCalledWith({
      principal: sesi, courseId: "crs-2", policyVersion: 1,
    });
    expect((await import("next/cache")).revalidatePath).toHaveBeenCalledWith(`/belajar/membangun-rest-api-modern-dengan-nodejs/karya`);
  });

  it("menyimpan modul selesai di kursus wajib yang terverifikasi", async () => {
    const mulai = await mulaiSesiAction("crs-2");

    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: mulai.bukti ?? "",
    });

    expect(hasil.ok).toBe(true);
    // Bukti penyimpanan: progres ditulis lewat service dengan jalur
    // `terverifikasi`, dan bukti sesi diikatkan sebagai `evidenceId`.
    expect(tandaiModulDb).toHaveBeenCalledWith({
      principal: sesi,
      courseId: "crs-2",
      modulId: "crs-2-m1",
      sumber: "terverifikasi",
      nama: sesi.nama,
      evidenceId: mulai.runId,
    });
    expect(store.selesai.get(`${sesi.userId}:crs-2`)).toEqual(["crs-2-m1"]);
    // Revalidasi disamakan dengan jalur informal supaya daftar dan halaman
    // belajar tidak menyajikan progres basi.
    const cacheModule = await import("next/cache");
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith("/belajar");
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(
      "/belajar/membangun-rest-api-modern-dengan-nodejs",
    );
  });

  it("idempoten: pemanggilan kedua tidak membatalkan tanda selesai", async () => {
    // Progres adalah toggle di jalur informal; jalur terverifikasi hanya boleh
    // **menambah**. Peserta yang mengeklik dua kali (atau menyelesaikan ulang
    // modul yang sudah pernah tuntas) tidak boleh kehilangan centangnya.
    const mulai = await mulaiSesiAction("crs-2");
    const argumen = { courseId: "crs-2", modulId: "crs-2-m1", bukti: mulai.bukti ?? "" };

    const pertama = await selesaikanMateriAction(argumen);
    expect(pertama.ok).toBe(true);
    expect(store.selesai.get(`${sesi.userId}:crs-2`)).toEqual(["crs-2-m1"]);

    const kedua = await selesaikanMateriAction(argumen);

    expect(kedua.ok).toBe(true);
    expect(store.selesai.get(`${sesi.userId}:crs-2`)).toEqual(["crs-2-m1"]);
    // Modul yang sudah tercatat tidak ditulis ulang sama sekali.
    expect(tandaiModulDb).toHaveBeenCalledTimes(1);
  });

  it("tidak menulis apa pun saat bukti sesi hilang", async () => {
    await mulaiSesiAction("crs-2");

    const hasil = await selesaikanMateriAction({ courseId: "crs-2", modulId: "crs-2-m1", bukti: "" });

    expect(hasil.ok).toBe(false);
    expect(tandaiModulDb).not.toHaveBeenCalled();
    expect((await import("next/cache")).revalidatePath).not.toHaveBeenCalled();
  });

  it("tidak menulis apa pun saat bukti sesi tidak sah", async () => {
    await mulaiSesiAction("crs-2");

    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: "bukti-palsu",
    });

    expect(hasil.ok).toBe(false);
    expect(tandaiModulDb).not.toHaveBeenCalled();
    expect((await import("next/cache")).revalidatePath).not.toHaveBeenCalled();
  });

  it("tidak menulis saat modul checkpoint kuis/proyek", async () => {
    const modulKuis = await createModul("crs-3", {
      judul: "Kuis Keamanan Lanjutan",
      ringkasan: "Kuis tersimpan untuk uji gerbang checkpoint.",
      durasi_min: 20,
      checkpoint: { mode: "kuis", batas_waktu_menit: 20 },
    });
    expect(modulKuis).not.toBeNull();
    const mulai = await mulaiSesiAction("crs-3");
    expect(mulai.ok).toBe(true);

    const hasil = await selesaikanMateriAction({
      courseId: "crs-3",
      modulId: modulKuis!.id,
      bukti: mulai.bukti ?? "",
    });

    expect(hasil.ok).toBe(false);
    expect(tandaiModulDb).not.toHaveBeenCalled();
    expect((await import("next/cache")).revalidatePath).not.toHaveBeenCalled();
  });

  it("tidak menulis saat pemanggil belum masuk", async () => {
    const mulai = await mulaiSesiAction("crs-2");
    // Sesi dicabut setelah bukti sah didapat: bukti yang sah pun tidak boleh
    // dihormati tanpa identitas pemanggil.
    auth.sesi = null;

    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: mulai.bukti ?? "",
    });

    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("Masuk");
    expect(tandaiModulDb).not.toHaveBeenCalled();
  });

  it("tidak menulis saat kursus tidak ada", async () => {
    const hasil = await selesaikanMateriAction({
      courseId: "tidak-ada",
      modulId: "crs-2-m1",
      bukti: "bukti-palsu",
    });

    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("tidak ditemukan");
    expect(tandaiModulDb).not.toHaveBeenCalled();
  });

  it("menyimpan penyelesaian modul kursus seed berkebijakan default (wajib)", async () => {
    // Sifat yang memotivasi perbaikan ini: kursus seed `INITIAL_COURSES` tidak
    // menyimpan `kebijakan`, sehingga `kebijakanDefault()` (`wajib`) berlaku dan
    // jalur informal menolaknya. Modul turunan tanpa checkpoint juga default
    // `materi`. Dulu jalur terverifikasi satu-satunya yang menerima — tetapi
    // tidak menyimpan apa pun, jadi tidak ada modul kursus bawaan yang bisa
    // tuntas. Sekarang penyelesaiannya harus bertahan sebagai baris progres.
    const mulai = await mulaiSesiAction("crs-1");
    expect(mulai.ok).toBe(true);

    const hasil = await selesaikanMateriAction({
      courseId: "crs-1",
      modulId: "crs-1-m1",
      bukti: mulai.bukti ?? "",
    });

    expect(hasil.ok).toBe(true);
    expect(store.selesai.get(`${sesi.userId}:crs-1`)).toEqual(["crs-1-m1"]);
    expect(tandaiModulDb).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: "crs-1", modulId: "crs-1-m1", sumber: "terverifikasi" }),
    );
    expect((await import("next/cache")).revalidatePath).toHaveBeenCalledWith(
      "/belajar/fullstack-web-development-nextjs-15-react-19",
    );
  });
});

describe("selesaikanMateriAction — gerbang wajib_kamera", () => {
  /** Course `wajib_kamera`: kebijakan benar-benar tersimpan, bukan default. */
  async function setWajibKamera(courseId: string): Promise<void> {
    const { updateCourse } = await import("@/lib/courses/store");
    await updateCourse(courseId, {
      kebijakan: { aturan_bantuan: "bertutor", aturan_pengawasan: "wajib_kamera" },
    });
  }

  it("menolak penyelesaian pada course wajib_kamera tanpa kamera menyala", async () => {
    await setWajibKamera("crs-2");
    const mulai = await mulaiSesiAction("crs-2");
    expect(mulai.ok).toBe(true);

    // Tidak ada `kamera_mulai` di run: gerbang harus menahan, dan TIDAK boleh
    // menulis progres apa pun.
    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: mulai.bukti ?? "",
    });

    expect(hasil.ok).toBe(false);
    expect(hasil.error?.toLowerCase()).toContain("kamera");
    expect(tandaiModulDb).not.toHaveBeenCalled();
  });

  it("melepas gerbang setelah kamera menyala tercatat di run", async () => {
    await setWajibKamera("crs-2");
    const mulai = await mulaiSesiAction("crs-2");
    // Bukti kamera diturunkan dari **run**: yang diperiksa adalah kejadian
    // `kamera_mulai` pada run itu — bukan boolean yang dikirim klien.
    await catatKejadianAction({
      runId: mulai.runId ?? "",
      jenis: "kamera_mulai",
      visibilitas: "visible",
      asal: "kamera",
    });

    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: mulai.bukti ?? "",
    });

    expect(hasil.ok).toBe(true);
    expect(tandaiModulDb).toHaveBeenCalled();
  });

  it("tidak menuntut kamera pada course wajib biasa", async () => {
    // `wajib` (bukan `wajib_kamera`) tidak boleh ikut tertahan: inilah yang
    // menjaga `wajib` tetap berarti "wajib" dan bukan "wajib kamera".
    const mulai = await mulaiSesiAction("crs-2");
    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: mulai.bukti ?? "",
    });
    expect(hasil.ok).toBe(true);
  });
});

describe("catatKejadianAction", () => {
  it("records an event for an active run", async () => {
    const mulai = await mulaiSesiAction("crs-3");
    const hasil = await catatKejadianAction({
      runId: mulai.runId ?? "",
      jenis: "pindah_tab",
      visibilitas: "hidden",
    });
    expect(hasil.ok).toBe(true);
    // Kejadian pertama selalu `sesi_dimulai` dari `mulaiSesiAction`; yang
    // diuji di sini adalah kejadian terbaru yang baru saja dicatat.
    expect(hasil.run?.kejadian.at(-1)?.jenis).toBe("pindah_tab");
  });

  it("refuses an unknown run", async () => {
    const hasil = await catatKejadianAction({
      runId: "sesi-palsu",
      jenis: "pindah_tab",
      visibilitas: "hidden",
    });
    expect(hasil.ok).toBe(false);
  });

  it("menolak kejadian pada sesi milik pengguna lain", async () => {
    // Sesi nyata milik orang lain: tanpa pemeriksaan `run.userId`, kejadian
    // pemanggil akan masuk ke catatan integritas peserta lain.
    const penyusup = principalUji({ email: "orang-lain@careevo.test" });
    seedTerdaftar("crs-1", penyusup);
    const sebelumnya = auth.sesi;
    auth.sesi = penyusup;
    const asing = await mulaiSesiAction("crs-1");
    auth.sesi = sebelumnya;

    const hasil = await catatKejadianAction({
      runId: asing.runId ?? "",
      jenis: "pindah_tab",
      visibilitas: "hidden",
    });
    expect(hasil.ok).toBe(false);
    // Bukti bahwa tidak ada yang tercatat: sesi asing tetap hanya berisi
    // `sesi_dimulai`.
    expect(store.events.get(asing.runId ?? "")).toHaveLength(1);
  });

  it("menolak jenis kejadian di luar daftar sah", async () => {
    const mulai = await mulaiSesiAction("crs-3");
    const hasil = await catatKejadianAction({
      runId: mulai.runId ?? "",
      // Klien bisa mengirim string apa pun; yang belum dikenal harus ditolak
      // di server, bukan dianggap kejadian biasa.
      jenis: "kamera_berhenti_palsu" as never,
      visibilitas: "hidden",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("Jenis kejadian");
    // Tidak ada kejadian baru yang masuk — validasi terjadi sebelum delegasi.
    expect(store.events.get(mulai.runId ?? "")).toHaveLength(1);
  });

  it("menolak visibilitas di luar visible/hidden/null", async () => {
    const mulai = await mulaiSesiAction("crs-3");
    const hasil = await catatKejadianAction({
      runId: mulai.runId ?? "",
      jenis: "pindah_tab",
      visibilitas: "diam-diam" as never,
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("Jenis kejadian");
    expect(store.events.get(mulai.runId ?? "")).toHaveLength(1);
  });
});

describe("akhiriSesiAction", () => {
  it("menutup sesi yang aktif", async () => {
    const mulai = await mulaiSesiAction("crs-1");
    const hasil = await akhiriSesiAction(mulai.runId ?? "");
    expect(hasil.ok).toBe(true);
    expect(hasil.run?.status).toBe("diakhiri");
  });

  it("menolak sesi yang bukan milik pemanggil", async () => {
    const hasil = await akhiriSesiAction("sesi-palsu");
    expect(hasil.ok).toBe(false);
  });

  it("menolak mengakhiri sesi milik pengguna lain", async () => {
    // Sesi nyata milik orang lain: tanpa pemeriksaan kepemilikan, pemanggil
    // bisa menutup sesi peserta lain dan merusak bukti pengerjaannya.
    const penyusup = principalUji({ email: "orang-lain@careevo.test" });
    seedTerdaftar("crs-1", penyusup);
    const sebelumnya = auth.sesi;
    auth.sesi = penyusup;
    const asing = await mulaiSesiAction("crs-1");
    auth.sesi = sebelumnya;

    const hasil = await akhiriSesiAction(asing.runId ?? "");
    expect(hasil.ok).toBe(false);
    // Sesi asing harus tetap aktif: penolakan bukan sekadar balasan `ok: false`.
    expect(store.runs.get(asing.runId ?? "")?.state).toBe("active");
  });
});
