# Laporan Jalur `terverifikasi_kamera` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup dua jurang yang ditinggalkan Task 4 — (1) `wajib_kamera` belum ditegakkan di server, sehingga course yang menuntut kamera masih bisa diselesaikan lewat `selesaikanMateriAction` **maupun** lewat kuis tanpa kamera; dan (2) laporan belum menyatakan apa arti `terverifikasi` pada course `wajib_kamera` dibanding `wajib` biasa.

**Architecture:** Tiga bagian. **A (bug)** — `selesaikanMateriAction` memanggil `putuskanAkses` tanpa `adaBuktiKamera` dan tidak menangani cabang `perlu_kamera`, jadi gerbang Task 4 hanya hidup di UI. Bukti kamera diturunkan dari **run yang sedang diverifikasi** (`bukti.id`) lewat kejadian `kamera_mulai`, bukan dari klaim klien. **B (gerbang kuis)** — `selesaikanModulKuisVerified` menulis `terverifikasi` tanpa memeriksa run; ia kini menolak `perlu_kamera` bila kebijakan kursus `wajib_kamera` tetapi tidak ada run aktif dengan `kamera_mulai`. **C (pengungkapan)** — `completion_path` tetap dua nilai (CHECK constraint), tetapi laporan menurunkan **label** jalurnya dari bukti yang tersimpan. Label punya **empat** nilai, bukan tiga, dan itu bukan embellishment: `module_progress.evidence_id` adalah kolom tunggal yang diisi writer berbeda — jalur materi mengisinya dengan `learning_runs.id` atau `null` (`src/actions/learning.ts:363`), jalur kuis dengan `quiz_attempts.id` (`src/lib/learning/assessment-service.ts:441`). Penyelesaian kuis karena itu **tidak punya run yang bisa ditelusuri**, dan label yang memaksainya menjadi "kamera tidak tercatat" akan berbohong tepat pada baris yang paling perlu jujur: course `wajib_kamera` yang gerbang kuis baru saja memverifikasi kameranya. Keempat nilai dijelaskan di Task C.

**Tech Stack:** Next.js 16 App Router (Server Actions), React 19, TypeScript 5, Vitest 5 (node env, tanpa jsdom), Drizzle ORM + PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-27-lapisan-pengawasan-anti-curang-design.md` — §"Kamera tidak menambah nilai `completion_path`" (baris 169–186), §"Batas yang harus tertulis di UI" (baris 188–199), P3 (baris 88–99), P5 (baris 109–118).

---

## Global Constraints

- **Copy berbahasa Indonesia** (`id`); `<html lang>` tetap `id`.
- **Tidak ada kata vonis** (`curang`, `menyalin`, `mencontek`, `penyalahgunaan`, `bersalah`) di label maupun detail laporan. `integritas.test.ts` sudah menjaga `temuanSesi`; aturan yang sama berlaku untuk label jalur di plan ini.
- **`completion_path` tetap dua nilai** (`terverifikasi`, `informal`). CHECK constraint ada di tiga tabel (`src/lib/db/schema.ts:473`). **Jangan** menambah nilai ketiga. Yang dikunci dua hanya **kolomnya** — label turunan di layer laporan boleh punya lebih dari dua nilai (Task C memakai empat), dan itu tidak melanggar spec.
- **`hitungCompletionPath` tidak berubah** (`src/lib/learning/service.ts:168`). Ia membaca `module_progress`, bukan run.
- **Tidak ada migrasi database.** Semua perubahan memakai skema yang sudah ada (`learning_events.kind`, `module_progress.evidence_id`).
- **Tidak ada `dangerouslySetInnerHTML`.**
- **Modul murni tetap murni.** `src/lib/performa/jalur-selesai.ts` dan `src/lib/learning/dashboard.ts` tidak boleh mengimpor `node:fs`/`next/headers`; `akses.ts`/`kebijakan.ts` adalah bundel klien — satu impor `node:fs` menjatuhkan build.
- **Setiap permukaan yang menampilkan sinyal baru wajib membawa batasnya** (spec baris 188–199, P3). Halaman laporan yang mulai menampilkan label kamera harus ikut menampilkan `BATAS_SINYAL.kamera` (Task D Step 6).
- **Ikuti langkah merah→hijau per task.** Kalau sebuah mutasi tidak membuat test merah, test itu tidak menutup logikanya. Mutation check wajib di setiap task kode (A, B, C, D).
- **Gate per task:** `npm run check` (`typecheck` → `lint` → `skills:check` → `test`). Task yang menyentuh halaman server-rendered (`src/app`) juga menjalankan `npm run build`.
- **Test integrasi tidak bisa dijalankan di environment ini.** `npm run test:db` gagal di config load — masalah lama yang tidak terkait plan ini. `./**/*.integration.test.ts` tetap **`tsc`-checked** (tsconfig `include: ["**/*.ts"]`), jadi signature yang berubah harus tetap dikompilasi di sana; hanya menjalankannya yang tertunda.
- **Commit lokal saja, jangan `push`** tanpa izin eksplisit.

---

# BAGIAN A — Menegakkan `wajib_kamera` di `selesaikanMateriAction` (perbaikan bug)

## Task A: `adaBuktiKamera` di `selesaikanMateriAction`

**Files:**
- Modify: `src/actions/learning.ts:80` (sisipkan helper), `src/actions/learning.ts:262-274` (pemanggilan `putuskanAkses` + cabang `perlu_kamera`)
- Modify: `src/actions/learning.test.ts` (tambah describe baru setelah `describe("selesaikanMateriAction — penyimpanan progres terverifikasi", ...)`)

**Interfaces:**
- Consumes: `putuskanAkses` (varians `perlu_kamera` sudah ada sejak Task 4, `src/lib/learning/akses.ts:121-143`), `listEventRun` (sudah diimpor di `src/actions/learning.ts:13` — jangan tambahkan import baru).
- Produces: `selesaikanMateriAction` menolak `perlu_kamera`; helper modul-level `kameraMenyalaPadaRun(runId: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing tests**

`src/actions/learning.test.ts` sudah punya `store.events` + mock `listEventRun` (baris 23–31, 201–204), dan `catatKejadianAction` **sudah** didestructure di baris 206 — jangan menambahkannya lagi. `tandaiModulDb` sudah di-`vi.hoisted` (baris 34). Tambahkan describe baru:

```ts
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
```

> `setWajibKamera` memakai `updateCourse`, yang menulis ke `coursesState` in-memory. `beforeEach` sudah memanggil `resetCourses()` (menyalakan `pakaiDisk = false`), jadi tidak ada yang menyentuh `data/courses.json`. Action membaca kembali lewat `getCourseById`, jadi perubahan terlihat. `aturan_pengawasan: "wajib_kamera"` sudah sah di `CourseKebijakanInput` sejak Task 4.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/actions/learning.test.ts`
Expected: FAIL — gerbang belum ada, jadi test pertama mendapat `hasil.ok === true` (test mengharapkan `false`) dan `tandaiModulDb` terpanggil.

> Kalau test **hijau** sebelum implementasi, hentikan dan laporkan: gerbang sudah ada di tempat lain dan plan ini salah paham.

- [ ] **Step 3: Implement the gate**

Sisipkan helper modul-level setelah `kebijakanKursus` (baris 80), sebelum `mulaiSesiAction` (baris 91):

```ts
/**
 * Apakah run yang sedang diverifikasi punya bukti kamera menyala.
 *
 * **Diturunkan dari run, bukan dari klaim pemanggil.** `kamera_mulai` ditulis
 * ke `learning_events` hanya lewat `catatKejadianDb` pada run aktif milik
 * pemanggil, dan run itu sudah dibaca server di `buktikanSesiDb` — jadi ini
 * bukti yang bisa diaudit, bukan parameter yang bisa diisi `true` oleh klien.
 * Run yang tidak bisa dibaca menghasilkan `false` (gagal-tertutup): bukti yang
 * tidak bisa diperiksa tidak boleh dianggap memenuhi syarat.
 */
async function kameraMenyalaPadaRun(runId: string): Promise<boolean> {
  const kejadian = await listEventRun(runId);
  return kejadian.some((k) => k.kind === "kamera_mulai");
}
```

Lalu ganti blok pemanggilan `putuskanAkses` (baris 262–274) dengan:

```ts
  // Pemanggil tidak menyaring berdasarkan ada/tidaknya bukti: keputusannya
  // serahkan ke `putuskanAkses` di sini. `keputusan.tipe` selalu `bebas` untuk
  // course `opsional` (lihat `wajibSesiTerverifikasi`), jadi rute klien yang
  // mengirim permintaan ini pada course `opsional` tidak ikut ditolak.
  //
  // Bukti kamera dibaca dari run **setelah** `bukti` terverifikasi: tanpa run
  // yang sah tidak ada catatan yang bisa diperiksa, dan course `wajib` biasa
  // tidak membayar query kejadian yang sia-sia.
  const kameraMenyala = bukti ? await kameraMenyalaPadaRun(bukti.id) : false;

  const keputusan = putuskanAkses({
    jenisKegiatan: "materi",
    kebijakan,
    adaBuktiSesi: Boolean(bukti),
    adaBuktiKamera: kameraMenyala,
  });
  // Pesan keputusan dipakai apa adanya agar copy tidak menyimpang dari mesin
  // akses: `perlu_sesi`/`perlu_kamera` untuk syarat yang belum terpenuhi,
  // `ditolak` untuk larangan.
  if (keputusan.tipe === "perlu_sesi") return { ok: false, error: keputusan.pesan };
  if (keputusan.tipe === "perlu_kamera") return { ok: false, error: keputusan.pesan };
  if (keputusan.tipe === "ditolak") return { ok: false, error: keputusan.pesan };
```

> `if (keputusan.tipe === "perlu_kamera")` — **itu inti Task A**. Tanpa baris ini, `putuskanAkses` mengembalikan `perlu_kamera` tetapi action mengabaikannya dan tetap menulis progres `terverifikasi` — persis bug yang ada hari ini.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/actions/learning.test.ts`
Expected: PASS — tiga test baru hijau, tidak ada test lama yang berubah.

- [ ] **Step 5: Mutation check (wajib)**

Dua mutasi; keduanya harus membuat test "menolak penyelesaian pada course wajib_kamera tanpa kamera menyala" jadi **merah**, lalu dikembalikan:

1. `const kameraMenyala = bukti ? await kameraMenyalaPadaRun(bukti.id) : false;` → `const kameraMenyala = true;`
2. Hapus baris `if (keputusan.tipe === "perlu_kamera") return { ok: false, error: keputusan.pesan };`

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: semuanya hijau.

- [ ] **Step 7: Commit**

```bash
git add src/actions/learning.ts src/actions/learning.test.ts
git commit -m "fix(learning): tegakkan gerbang wajib_kamera di selesaikanMateriAction"
```

---

# BAGIAN B — Menegakkan `wajib_kamera` pada jalur kuis terverifikasi

## Task B: Gerbang kamera di `selesaikanModulKuisVerified`

**Files:**
- Create: `src/lib/learning/assessment-service.test.ts`
- Modify: `src/lib/learning/assessment-service.ts:44-51` (import repository), `:90-109` (`KodeGalatAsesmen`), `:338-347` (signature + destructure), `:400-404` (sisipkan gerbang)
- Modify: `src/lib/learning/assessment-service.integration.test.ts:595, 627, 680, 716` (empat call site wajib compile)
- Modify: `src/actions/assessment.ts:5` (import `butuhKamera`), `:97-114` (`pesanGalatAsesmen`), `:273-284` (turunkan `wajibKamera`)
- Modify: `src/actions/assessment.test.ts:352-361` (ekspektasi) + dua test baru

**Interfaces:**
- Consumes: `ambilRunAktif(userId, courseId): Promise<LearningRun | null>` (`repository.ts:336`), `listEventRun(runId): Promise<LearningEvent[]>` (`repository.ts:383`), `butuhKamera(kebijakan): boolean` (`akses.ts:89`).
- Produces: `selesaikanModulKuisVerified(input)` menerima `wajibKamera: boolean` (**wajib**, bukan opsional); `KodeGalatAsesmen` bertambah `"perlu_kamera"`; `pesanGalatAsesmen` memetakan kode itu; action menurunkan `wajibKamera` server-side dari kebijakan kursus.

> **Kenapa `wajibKamera` wajib (bukan opsional) dan kenapa ada test service baru.** `assessment.test.ts` memock service **seluruhnya**, jadi logika gerbang di dalam `selesaikanModulKuisVerified` tidak terjangkau di sana. Test integrasi sedang tidak bisa dijalankan (`npm run test:db` gagal di config load — masalah lama, bukan bagian plan ini). Karena itu gerbang diuji unit dengan pola `run-service.test.ts`: mock `./repository` + `./service` + `@/lib/courses/modul-resolver` + `@/lib/courses/store`, lalu import service sungguhan. Parameter-nya **wajib** supaya ada tepat satu jalur yang bisa melupakannya; konsekuensinya, empat call site di `assessment-service.integration.test.ts` harus ikut diperbarui (Step 5) karena `tsc` tetap meng-typecheck berkas `.integration.test.ts` walau `npm test` mengecualikannya.

- [ ] **Step 1: Write the failing service test**

Buat `src/lib/learning/assessment-service.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/learning/assessment-service.test.ts`
Expected: FAIL — `wajibKamera` belum ada di input service, jadi `selesaikan(true)` mengabaikannya dan berhasil menulis progres, sedangkan test mengharapkan rejection `perlu_kamera`.

- [ ] **Step 3: Implement the service gate**

Di `src/lib/learning/assessment-service.ts`:

(a) Import repository (baris 44–51) — tambah `ambilRunAktif` dan `listEventRun`:

```ts
import {
  ambilAttempt,
  ambilEnrollmentById,
  ambilRunAktif,
  buatAttemptBerikutnya,
  kirimAttempt,
  listEventRun,
  type Enrollment,
  type QuizAttempt,
} from "@/lib/learning/repository";
```

(b) `KodeGalatAsesmen` (baris 90–109) — tambahkan di ujung union:

```ts
  // `selesaikanModulKuisVerified`: course `wajib_kamera` menuntut run aktif
  // dengan kejadian `kamera_mulai`; kelulusan kuis saja tidak cukup.
  | "perlu_kamera";
```

(c) Signature + destructure (baris 338–347):

```ts
export async function selesaikanModulKuisVerified(input: {
  principal: SessionPrincipal;
  courseId: string;
  modulId: string;
  /** Kuis yang dipasang di modul; dicocokkan dengan `attempt.quizId`. */
  quizId: string;
  attemptId: string;
  policyVersion: number;
  /**
   * Apakah kebijakan kursus menuntut kamera (`aturan_pengawasan ===
   * "wajib_kamera"`). Diturunkan server-side oleh pemanggil action — jangan
   * pernah dari input klien.
   */
  wajibKamera: boolean;
}): Promise<HasilSelesaikanModulKuis> {
  const { principal, courseId, modulId, quizId, attemptId, policyVersion, wajibKamera } =
    input;
```

(d) Sisipkan gerbang **setelah** pemeriksaan kuis terpasang di modul (setelah baris 402, sebelum `const modul = await tandaiModulDb({`):

```ts
  // Gerbang kamera (spec 2026-09-27, P5): kelulusan kuis bukan bukti kamera.
  // Course `wajib_kamera` menuntut run aktif dengan `kamera_mulai`; run dibaca
  // dari database untuk (user, course) ini — bukan dari argumen — dan run yang
  // tidak bisa dibaca dihitung gagal (gagal-tertutup).
  if (wajibKamera) {
    const runAktif = await ambilRunAktif(principal.userId, courseId);
    const kejadian = runAktif ? await listEventRun(runAktif.id) : [];
    if (!runAktif || !kejadian.some((k) => k.kind === "kamera_mulai")) {
      throw new GalatAsesmen(
        "perlu_kamera",
        "Course ini menuntut kamera menyala untuk menyelesaikan kuis.",
      );
    }
  }
```

> Urutan sengaja setelah pemeriksaan kuis/modul: dua pemeriksaan itu murah dan tidak membaca run, jadi gerbang kamera baru menyentuh database bila semua syarat lain sudah lolos.

- [ ] **Step 4: Run the service test to verify it passes**

Run: `npx vitest run src/lib/learning/assessment-service.test.ts`
Expected: PASS — 4 test hijau.

- [ ] **Step 5: Perbaiki empat call site integrasi agar `tsc` tetap hijau**

`wajibKamera` adalah parameter wajib, jadi `npm run typecheck` akan gagal di `src/lib/learning/assessment-service.integration.test.ts`. Tambahkan `wajibKamera: false` tepat setelah `policyVersion: 1` pada **keempat** call site (baris 595, 627, 680, 716):

```ts
        policyVersion: 1,
        // Kursus uji di berkas ini memakai kebijakan default `wajib`, jadi
        // gerbang kamera tidak berlaku dan perilaku test tidak berubah.
        wajibKamera: false,
```

Lalu jalankan `npm run typecheck` — harus hijau. **Jangan** menjalankan `npm run test:db` untuk memverifikasi langkah ini; suite itu sedang rusak di config load secara terpisah.

- [ ] **Step 6: Write the failing action tests**

Di `src/actions/assessment.test.ts`, perbarui ekspektasi test "menyelesaikan modul saat lulus, dengan policyVersion dari kursus server" (baris 352–361) menjadi:

```ts
    expect(mocks.selesaikanModulKuisVerified).toHaveBeenCalledWith({
      principal: PRINCIPAL,
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
      attemptId: ATTEMPT,
      // 7 dari `getCourseById(...).kebijakan.versi` — tidak ada tempat di
      // signature action untuk versi dari klien.
      policyVersion: 7,
      // Kursus uji tidak menyebut `aturan_pengawasan`, jadi bukan `wajib_kamera`.
      wajibKamera: false,
    });
```

Tambahkan dua test di describe yang sama:

```ts
  it("meneruskan wajibKamera dari kebijakan kursus, bukan dari klien", async () => {
    mocks.kirimAttemptVerified.mockResolvedValue({
      attempt: { id: ATTEMPT, status: "submitted", score: 100 },
      score: 100,
      lulus: true,
    });
    mocks.getCourseById.mockResolvedValue({
      id: KURSUS,
      slug: "kursus-uji",
      title: "Kursus Uji",
      kebijakan: { versi: 9, aturan_pengawasan: "wajib_kamera" },
    });

    await kirimDanSelesaikanKuisAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
      attemptId: ATTEMPT,
      jawaban: [{ questionId: "q1", selectedOption: 0 }],
    });

    expect(mocks.selesaikanModulKuisVerified).toHaveBeenCalledWith(
      expect.objectContaining({ policyVersion: 9, wajibKamera: true }),
    );
  });

  it("memetakan galat perlu_kamera menjadi pesan kamera, bukan melempar", async () => {
    mocks.kirimAttemptVerified.mockResolvedValue({
      attempt: { id: ATTEMPT, status: "submitted", score: 100 },
      score: 100,
      lulus: true,
    });
    mocks.selesaikanModulKuisVerified.mockRejectedValue(
      new mocks.GalatAsesmen("perlu_kamera", "Course ini menuntut kamera menyala."),
    );

    const hasil = await kirimDanSelesaikanKuisAction({
      courseId: KURSUS,
      modulId: MODUL,
      quizId: KUIS,
      attemptId: ATTEMPT,
      jawaban: [{ questionId: "q1", selectedOption: 0 }],
    });

    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.error.toLowerCase()).toContain("kamera");
  });
```

- [ ] **Step 7: Run action test to verify it fails**

Run: `npx vitest run src/actions/assessment.test.ts`
Expected: FAIL — action belum mengirim `wajibKamera`, jadi `toHaveBeenCalledWith({ ..., wajibKamera: false })` gagal.

- [ ] **Step 8: Implement the action changes**

Di `src/actions/assessment.ts`:

(a) Tambah import setelah baris 5:

```ts
import { butuhKamera } from "@/lib/learning/akses";
```

(b) `pesanGalatAsesmen` (baris 97–114) — tambah entri di peta:

```ts
      modul_tidak_ditemukan: "Modul tidak ditemukan pada kursus ini.",
      perlu_kamera:
        "Course ini menuntut kamera menyala untuk menyelesaikan kuis. Mulai sesi baru dengan kamera menyala.",
```

(c) Ganti blok `const kursus = await getCourseById(input.courseId); ...` (baris 273–284) dengan:

```ts
    const kursus = await getCourseById(input.courseId);
    const kebijakan = kursus?.kebijakan ?? kebijakanDefault();
    const selesai = await selesaikanModulKuisVerified({
      principal: auth.principal,
      courseId: input.courseId,
      modulId: input.modulId,
      quizId: input.quizId,
      attemptId: input.attemptId,
      // Fallback `kebijakanDefault()` sama dengan pemanggil lain: kursus tanpa
      // kebijakan tersimpan tetap memakai default aman, bukan "tanpa kebijakan".
      policyVersion: kebijakan.versi,
      // Diturunkan server-side dari kebijakan kursus — bukan dari input klien.
      wajibKamera: butuhKamera(kebijakan),
    });
```

> `baris 286` masih memakai `kursus?.slug` untuk revalidasi; biarkan apa adanya.

- [ ] **Step 9: Run both test files to verify they pass**

Run: `npx vitest run src/lib/learning/assessment-service.test.ts src/actions/assessment.test.ts`
Expected: PASS — keduanya hijau.

- [ ] **Step 10: Mutation check (wajib)**

Hapus blok `if (wajibKamera) { ... }` di service dan konfirmasi test "menolak run aktif yang tidak punya kamera_mulai" jadi **merah**. Ubah `wajibKamera: butuhKamera(kebijakan)` di action menjadi `wajibKamera: false` dan konfirmasi test "meneruskan wajibKamera dari kebijakan kursus" jadi **merah**. Kembalikan keduanya.

- [ ] **Step 11: Run the gate**

Run: `npm run check`
Expected: semuanya hijau.

- [ ] **Step 12: Commit**

```bash
git add src/lib/learning/assessment-service.ts src/lib/learning/assessment-service.test.ts src/lib/learning/assessment-service.integration.test.ts src/actions/assessment.ts src/actions/assessment.test.ts
git commit -m "feat(assessment): gerbang wajib_kamera pada penyelesaian kuis terverifikasi"
```

---

# BAGIAN C — Menyatakan arti jalur di laporan

Bagian ini **tidak** menambah nilai `completion_path`. Ia menurunkan label tampilan dari bukti yang tersimpan.

## Task C: Fungsi turunan `jalurDariBukti`

**Files:**
- Create: `src/lib/performa/jalur-selesai.ts`
- Create: `src/lib/performa/jalur-selesai.test.ts`

**Interfaces:**
- Consumes: tidak ada (modul murni, tanpa impor runtime).
- Produces:
  - `type JalurTerlihat = "terverifikasi_kamera" | "terverifikasi" | "terverifikasi_tanpa_bukti_kamera" | "informal"`
  - `function jalurDariBukti(input: { completionPath: string | null; evidenceId: string | null; kameraMulai?: ReadonlyMap<string, boolean> }): JalurTerlihat`
  - `const LABEL_JALUR: Record<JalurTerlihat, string>`

> **Kenapa empat nilai, bukan tiga.** `module_progress.evidence_id` diisi oleh writer berbeda dengan dua jenis id (plus `null`): `selesaikanMateriAction` mengisinya dengan `learning_runs.id`, atau `null` pada course `opsional` yang memang tidak punya run (`src/actions/learning.ts:363`), dan `selesaikanModulKuisVerified` dengan `quiz_attempts.id` (`src/lib/learning/assessment-service.ts:441`). Skema memang menyebutnya begitu — "referensi **lunak** ke `quiz_attempts.id` **atau** `learning_runs.id`" (`src/lib/db/schema.ts:524-526`) — jadi tidak ada satu pun yang boleh mengarang run untuk baris kuis. Akibatnya pelaporan punya **tiga** situasi faktual, bukan dua:
>
> 1. bukti = run, run punya `kamera_mulai` → kamera terbukti menyala;
> 2. bukti = run, run tidak punya `kamera_mulai` → kamera tidak tercatat;
> 3. bukti = attempt (atau tidak ada bukti) → **tidak ada run yang bisa ditelusuri**.
>
> Situasi 3 paling penting untuk kejujuran: setelah Task B, penyelesaian kuis pada course `wajib_kamera` **hanya bisa terjadi** dengan kamera menyala — tapi laporan tidak boleh menyatakan itu, karena run-nya tidak tercatat di mana pun. Menyimpulkan "lewat sesi terverifikasi" akan mengarang sesi; menyimpulkannya "kamera tidak tercatat" akan menyatakan sebaliknya. Yang benar adalah menyatakan situasinya sendiri.

- [ ] **Step 1: Write the failing test**

`src/lib/performa/jalur-selesai.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LABEL_JALUR, jalurDariBukti } from "./jalur-selesai";

/** Peta `run id` → apakah run itu punya `kamera_mulai`. */
const peta = (...pasangan: Array<[string, boolean]>): ReadonlyMap<string, boolean> =>
  new Map(pasangan);

describe("jalurDariBukti", () => {
  it("menandai jalur terverifikasi yang ditopang kamera", () => {
    // Inilah makna `terverifikasi` pada course `wajib_kamera` lewat jalur materi:
    // bukan sekadar "ada sesi", tapi "ada sesi DAN kamera menyala".
    expect(
      jalurDariBukti({
        completionPath: "terverifikasi",
        evidenceId: "run-1",
        kameraMulai: peta(["run-1", true]),
      }),
    ).toBe("terverifikasi_kamera");
  });

  it("menandai jalur terverifikasi tanpa kamera sebagai terverifikasi biasa", () => {
    // Course `wajib` biasa: jalur ini tidak membuktikan apa pun soal kamera.
    expect(
      jalurDariBukti({
        completionPath: "terverifikasi",
        evidenceId: "run-1",
        kameraMulai: peta(["run-1", false]),
      }),
    ).toBe("terverifikasi");
  });

  it("tidak pernah menaikkan jalur yang tidak menyatakan dirinya terverifikasi", () => {
    // Fail-closed: `informal`, `null`, dan nilai tak dikenal tidak boleh
    // menjadi `terverifikasi*` apa pun, walaupun kameranya kebetulan menyala.
    for (const completionPath of ["informal", null, "", "terverifikasi_kamera"]) {
      expect(
        jalurDariBukti({
          completionPath,
          evidenceId: "run-1",
          kameraMulai: peta(["run-1", true]),
        }),
      ).toBe("informal");
      expect(
        jalurDariBukti({
          completionPath,
          evidenceId: "run-1",
          kameraMulai: peta(["run-1", false]),
        }),
      ).toBe("informal");
    }
  });

  it("berhenti pada bukti yang bukan run yang bisa ditelusuri", () => {
    // Jalur kuis menyimpan `quiz_attempts.id` di `evidence_id`, jadi id itu tidak
    // akan pernah muncul di peta run — meski kameranya jelas menyala. Menarik
    // label `terverifikasi` di sini akan menyatakan "kamera tidak tercatat"
    // untuk tepat baris yang paling perlu jujur.
    expect(
      jalurDariBukti({
        completionPath: "terverifikasi",
        evidenceId: "att-1",
        kameraMulai: peta(["run-1", true]),
      }),
    ).toBe("terverifikasi_tanpa_bukti_kamera");
  });

  it("menganggap bukti yang tidak ada sebagai jalur tanpa bukti kamera", () => {
    // Baris lama tanpa `evidence_id` juga tidak punya run yang bisa ditelusuri.
    expect(
      jalurDariBukti({
        completionPath: "terverifikasi",
        evidenceId: null,
        kameraMulai: peta(["run-1", true]),
      }),
    ).toBe("terverifikasi_tanpa_bukti_kamera");
  });

  it("tidak pernah mengklaim kamera saat pemanggil tidak menyertakan peta", () => {
    // Tanpa peta, `terverifikasi` berarti "tidak ada bukti kamera yang tersedia"
    // — bukan "kamera pasti tidak menyala". Menurunkannya ke jalur terverifikasi
    // biasa membuat pemanggil yang lupa mengirim peta tidak diam-diam mengubah
    // arti laporan.
    const tanpaPeta = { completionPath: "terverifikasi", evidenceId: "run-1" };
    expect(jalurDariBukti(tanpaPeta)).toBe("terverifikasi");
    expect(jalurDariBukti({ ...tanpaPeta, evidenceId: "att-1" })).toBe("terverifikasi");
    // `informal` tetap gagal-tertutup walau tidak ada peta sama sekali.
    expect(jalurDariBukti({ completionPath: "informal", evidenceId: "att-1" })).toBe("informal");
  });

  it("tidak memakai kata vonis di labelnya", () => {
    for (const label of Object.values(LABEL_JALUR)) {
      for (const kata of ["curang", "menyalin", "mencontek", "penyalahgunaan", "bersalah"]) {
        expect(label.toLowerCase()).not.toContain(kata);
      }
    }
  });

  it("membedakan keempat jalurnya dengan kalimat yang berbeda", () => {
    // Empat label harus **semuanya berbeda**, dan ketiga label terverifikasi
    // harus menyebut kamera: seluruh gunanya adalah memberi tahu pembaca bahwa
    // "terverifikasi" bukan satu klaim tunggal. Label yang tumpang tindih berarti
    // salah satu perbedaan di atas hilang.
    const semua = Object.values(LABEL_JALUR);
    expect(new Set(semua).size).toBe(semua.length);
    for (const nilai of [
      "terverifikasi_kamera",
      "terverifikasi",
      "terverifikasi_tanpa_bukti_kamera",
    ] as const) {
      expect(LABEL_JALUR[nilai].toLowerCase()).toContain("kamera");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/performa/jalur-selesai.test.ts`
Expected: FAIL — module belum ada.

- [ ] **Step 3: Implement**

`src/lib/performa/jalur-selesai.ts`:

```ts
/**
 * Jalur penyelesaian **yang terlihat di laporan** — diturunkan, bukan disimpan.
 *
 * Kolom `completion_path` tetap dua nilai karena punya CHECK constraint di tiga
 * tabel (`src/lib/db/schema.ts:473`), dan menambah nilai berarti migrasi yang
 * menyentuh setiap pembaca (`normalisasiJalur`, `hitungCompletionPath`,
 * `LABEL_SUMBER`, laporan). Yang ditambahkan di sini adalah **label**, bukan
 * nilai: label bisa menyatakan lebih dari yang bisa disimpan kolom.
 *
 * Keempat label, dan fakta yang masing-masing nyatakan:
 *
 * - `terverifikasi_kamera` — bukti adalah run, dan run itu punya
 *   `kamera_mulai`. Hanya mungkin pada course `wajib_kamera`, karena course
 *   `wajib` tidak pernah menolak penyelesaian tanpa kamera.
 * - `terverifikasi` — bukti adalah run, dan run itu **tidak** punya
 *   `kamera_mulai`. Ketiadaan kejadian inilah yang diketahui, bukan "kamera
 *   pasti mati": `kamera_mulai` adalah sinyal yang dilaporkan peramban
 *   (`ASAL_SINYAL.kamera`), jadi tidak adanya laporan bukan bukti negatif.
 * - `terverifikasi_tanpa_bukti_kamera` — `evidence_id` bukan id run (jalur kuis
 *   menyimpannya sebagai `quiz_attempts.id`) atau tidak ada sama sekali.
 *   Jalurnya sah, tetapi **tidak ada run yang bisa ditelusuri** untuk bicara apa
 *   pun soal kamera. Label ini sengaja tidak menyebut "kamera menyala"
 *   walaupun `wajib_kamera` membuat kamera wajib: yang terverifikasi saat
 *   penyelesaian adalah kelulusan asesmen, bukan kehadiran kamera, dan laporan
 *   hanya boleh menyatakan yang ada di baris yang tersimpan.
 * - `informal` — tidak ada bukti sesi yang sah. Tidak pernah dinaikkan, apa pun
 *   yang terjadi di run.
 *
 * Fungsi ini **tidak** mengembalikan skor, tingkat bahaya, atau vonis. Ia hanya
 * menyatakan bukti apa yang ada di depan pembaca.
 *
 * Modul ini **murni** — tidak boleh mengimpor `node:fs` atau `next/headers`;
 * ia dirender dari halaman server sekaligus bisa dipakai modul murni lain.
 */

export type JalurTerlihat =
  | "terverifikasi_kamera"
  | "terverifikasi"
  | "terverifikasi_tanpa_bukti_kamera"
  | "informal";

/**
 * Kalimat yang dipakai laporan untuk menyebut masing-masing jalur.
 *
 * `LABEL_SUMBER` yang sudah ada (`src/lib/performa/store.ts:36`) **tidak**
 * disentuh: ia menggambarkan bentuk data yang tersimpan di `.data/performa`,
 * yang tetap dua nilai. Kosakata label tampilan hidup di sini, bukan di sana.
 */
export const LABEL_JALUR: Record<JalurTerlihat, string> = {
  terverifikasi_kamera: "lewat sesi terverifikasi dengan kamera menyala",
  terverifikasi: "lewat sesi terverifikasi, kamera tidak tercatat",
  terverifikasi_tanpa_bukti_kamera: "jalur terverifikasi, kamera tidak bisa ditelusuri ke run",
  informal: "tanpa sesi terverifikasi",
};

export function jalurDariBukti(input: {
  completionPath: string | null;
  /** `module_progress.evidence_id`: id run **atau** id attempt, atau `null`. */
  evidenceId: string | null;
  /** `run id` → apakah run itu punya `kamera_mulai`. */
  kameraMulai?: ReadonlyMap<string, boolean>;
}): JalurTerlihat {
  // Fail-closed: hanya `terverifikasi` yang eksak boleh dinaikkan. Nilai lain —
  // termasuk `null` dari baris lama dan nilai yang tidak dikenal — turun ke
  // `informal`, karena bukti yang tidak menyatakan dirinya terverifikasi tidak
  // boleh diangkat.
  if (input.completionPath !== "terverifikasi") return "informal";

  // Tanpa peta, tidak ada yang bisa disalahkan atas kamera: turun ke jalur
  // terverifikasi biasa (kamera tidak tercatat) alih-alih menebak.
  if (!input.kameraMulai) return "terverifikasi";

  // Bukti yang tidak ada di peta run adalah bukti attempt, atau run yang tidak
  // ada di tangan pemanggil. Keduanya berarti "tidak bisa ditelusuri".
  if (!input.evidenceId || !input.kameraMulai.has(input.evidenceId)) {
    return "terverifikasi_tanpa_bukti_kamera";
  }

  return input.kameraMulai.get(input.evidenceId) ? "terverifikasi_kamera" : "terverifikasi";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/performa/jalur-selesai.test.ts`
Expected: PASS — 8 test.

- [ ] **Step 5: Mutation check (wajib)**

Tiga mutasi; masing-masing harus membuat satu test merah, lalu dikembalikan:

1. `if (input.completionPath !== "terverifikasi") return "informal";` → `return "terverifikasi";` — harus membuat merah test "tidak pernah menaikkan jalur yang tidak menyatakan dirinya terverifikasi".
2. Hapus blok `if (!input.evidenceId || !input.kameraMulai.has(input.evidenceId))` — harus membuat merah test "berhenti pada bukti yang bukan run yang bisa ditelusuri" dan "menganggap bukti yang tidak ada sebagai jalur tanpa bukti kamera".
3. `if (!input.kameraMulai) return "terverifikasi";` → `if (!input.kameraMulai) return "terverifikasi_kamera";` — harus membuat merah test "tidak pernah mengklaim kamera saat pemanggil tidak menyertakan peta".

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: semuanya hijau.

- [ ] **Step 7: Commit**

```bash
git add src/lib/performa/jalur-selesai.ts src/lib/performa/jalur-selesai.test.ts
git commit -m "feat(performa): label jalur selesai diturunkan dari bukti (bukan kolom)"
```

---

## Task D: Bawa bukti kamera ke laporan per-kursus

**Files:**
- Modify: `src/lib/learning/dashboard.ts:145-150` (`BarisSelesaiModul`), `:198-203` (signature `detailPembelajaranDariDb`), `:220-229` (loop progres)
- Modify: `src/lib/learning/dashboard.test.ts:48-62` (tambah helper `progresDenganRun`) + describe baru
- Modify: `src/lib/learning/run-service.ts` (tambah `petaKameraMulaiPemilik` + import `listEventRun`)
- Modify: `src/app/(verifikator)/performa/[owner]/page.tsx:7-14` (import), `:45` (peta kamera), `:69` (batas sinyal kamera), `:86` (render label)

**Interfaces:**
- Consumes: `jalurDariBukti`, `LABEL_JALUR` (Task C); `listRunStaf(): Promise<LearningRun[]>` (`run-service.ts:284`); `listEventRun` (`repository.ts:383`); `BATAS_SINYAL.kamera` (`src/lib/learning/sumber-sinyal.ts:42`).
- Produces: `BarisSelesaiModul` bertambah `jalur: JalurTerlihat`; `detailPembelajaranDariDb` menerima `kameraMulai?: ReadonlyMap<string, boolean>` (runId → ada `kamera_mulai`); `run-service.ts` exports `petaKameraMulaiPemilik(userId: string): Promise<Map<string, boolean>>`.

- [ ] **Step 1: Write the failing test**

Di `src/lib/learning/dashboard.test.ts`, helper `progres` (baris 48–62) selalu memakai `evidenceId: null`. Tambahkan helper di dekatnya:

```ts
/** `progres` dengan `evidence_id` yang menunjuk bukti — jalur diturunkan dari situ. */
function progresDenganRun(
  enrollmentId: string,
  moduleId: string,
  completionPath: "terverifikasi" | "informal" | null,
  evidenceId: string | null,
): ModuleProgressRow {
  return { ...progres(enrollmentId, moduleId, completionPath), evidenceId };
}
```

Tambahkan describe baru setelah `describe("detailPembelajaranDariDb", ...)`:

```ts
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
```

> `EMAIL_A`/`USER_A` sudah ada (baris 22–25); `enrollment(...)` menerima **satu objek**, jangan memanggilnya dengan argumen posisional.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/learning/dashboard.test.ts`
Expected: FAIL — `jalur` belum ada di `BarisSelesaiModul`, jadi `hasil?.kursus[0]?.selesai[0]?.jalur` adalah `undefined`.

- [ ] **Step 3: Implement di `dashboard.ts`**

(a) Tambah import di blok import atas (setelah baris 41):

```ts
import { jalurDariBukti, type JalurTerlihat } from "@/lib/performa/jalur-selesai";
```

(b) Ubah `BarisSelesaiModul` (baris 145–150):

```ts
/** Satu baris progres modul, dalam kosakata yang dirender (`sumber`/`at`). */
export interface BarisSelesaiModul {
  modul_id: string;
  /** Jalur tak dikenal turun ke "informal" — klaim tidak dinaikkan. */
  sumber: "terverifikasi" | "informal";
  /**
   * Jalur **yang terlihat di laporan** — diturunkan dari `completion_path` plus
   * `evidence_id` dan peta kamera. Tidak pernah lebih kuat dari `sumber`:
   * `jalurDariBukti` menurunkan apa pun yang bukan `terverifikasi` ke
   * `informal`, dan `evidence_id` yang bukan id run menghasilkan
   * `terverifikasi_tanpa_bukti_kamera`, bukan klaim kamera apa pun.
   */
  jalur: JalurTerlihat;
  at: string;
}
```

(c) Ubah signature `detailPembelajaranDariDb` (baris 198–203):

```ts
export function detailPembelajaranDariDb(input: {
  enrollments: EnrollmentStaf[];
  progress: ModuleProgressRow[];
  attempts: AttemptDashboard[];
  judul?: ReadonlyMap<string, string>;
  /**
   * `run id` → apakah run itu punya kejadian `kamera_mulai`.
   *
   * Opsional supaya pemanggil yang tidak punya akses ke kejadian run tetap
   * bekerja: tanpa peta ini, `terverifikasi` berarti "tidak ada bukti kamera
   * yang tersedia" — bukan "kamera pasti tidak menyala", dan bukan pula
   * "kamera menyala". Pemanggil yang lupa mengirim peta tidak boleh diam-diam
   * mengubah arti laporan.
   */
  kameraMulai?: ReadonlyMap<string, boolean>;
}): DetailPembelajaran | null {
```

(d) Ubah loop progres (baris 220–229):

```ts
  for (const baris of input.progress) {
    if (baris.state !== "completed") continue;
    const courseId = courseDariEnrollment.get(baris.enrollmentId);
    if (!courseId) continue;
    const sumber = baris.completionPath === "terverifikasi" ? "terverifikasi" : "informal";
    perKursus.get(courseId)?.selesai.push({
      modul_id: baris.moduleId,
      sumber,
      // `evidence_id` diteruskan apa adanya: ia bisa id run (jalur materi) atau
      // id attempt (jalur kuis), dan `jalurDariBukti` yang membedakan.
      jalur: jalurDariBukti({
        completionPath: baris.completionPath,
        evidenceId: baris.evidenceId,
        kameraMulai: input.kameraMulai,
      }),
      at: iso(baris.completedAt),
    });
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/learning/dashboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Mutation check (wajib)**

Task ini tidak punya logika sendiri — keputusannya sudah diuji di Task C — tapi **wiring**-nya justru tempat bug yang lolos review. Dua mutasi, masing-masing harus membuat test merah, lalu dikembalikan:

1. Di loop progres, ganti `evidenceId: baris.evidenceId` dengan `evidenceId: null` — harus membuat merah test **"menandai jalur terverifikasi yang ditopang kamera"**. Test kuis ("…penyelesaian kuis sebagai jalur tanpa bukti kamera…") **tetap hijau secara struktural**, dan itu memang begitu: `jalurDariBukti` memperlakukan `evidenceId` null dan id yang tidak tertelusuri lewat cabang yang sama, jadi baris kuis merender `terverifikasi_tanpa_bukti_kamera` baik dengan maupun tanpa mutasi. Jangan mengejar test kuis untuk redden di sini — kekebalannya adalah sifat yang benar, bukan celah.
2. Ganti `kameraMulai: input.kameraMulai` dengan `kameraMulai: undefined` — harus membuat merah test "menandai jalur terverifikasi yang ditopang kamera".

Kalau mutasi 1 tidak membuat test kamera merah, berarti `evidence_id` tidak benar-benar diteruskan dari baris progres ke adapter — dan seluruh Task C jadi tidak terverifikasi di lapis laporan.

> **Nama yang dilarang di berkas halaman:** guard memindai berkas sebagai teks, jadi tiga substring ini dilarang muncul di `performa/[owner]/page.tsx` — termasuk **di dalam komentar**: `listRun` (jadi jangan pernah memanggil `listRunStaf` dari halaman; `petaKameraMulaiPemilik` menggantikannya), `kejadian`, dan `ringkasIntegritasByOwner`. `run-service.ts` tidak berada dalam daftar berkas yang dipindai, jadi di sana `listRunStaf` dan `listEventRun` boleh dipakai.

- [ ] **Step 6: Show it in the report UI**

> **PUTUSAN (2026-09-27, setelah cacat plan ditemukan saat eksekusi) — persempit sambungannya, JANGAN ubah guard-nya.** Versi awal langkah ini meminta halaman memanggil `listRunStaf()` dan `listEventRun()` sendiri. Itu menabrak guard keamanan yang disengaja di `src/lib/learning/security.test.ts:230-240`, yang berasal dari commit `4e1acdd` ("pisahkan laporan belajar dari laporan integritas"), dan komentarnya sendiri berbunyi *"Pemisahan ini bukan aturan tampilan: kalau halaman belajar masih mengimpor `listRun`, datanya bisa bocor kembali ke sana."* Guard itu melarang tiga substring — `listRun`, `kejadian`, `ringkasIntegritasByOwner` — di `performa/page.tsx`, `performa/[owner]/page.tsx`, dan `performa-belajar.tsx`. Kode lama menabrak dua dari ketiganya (`listRunStaf` memuat `listRun`; sebuah variabel lokal bernama `kejadian`). Guard itu merepresentasikan keputusan nyata, jadi ia tetap. Baca prasyarat peta di `jalur-selesai.ts:66-91` sebelum menulis kode halaman.

(a) Tambah aksesor sempit di `src/lib/learning/run-service.ts` — file ini sudah mengimpor dari `./repository` dan tidak ada dalam daftar berkas yang dijaga guard:

```ts
/**
 * `run id` → apakah run itu punya kejadian `kamera_mulai`, untuk satu pemilik.
 *
 * **Aksesor sempit, bukan tabel run.** Halaman laporan belajar tidak boleh
 * membaca data sesi sama sekali; itu dipisah oleh guard di
 * `src/lib/learning/security.test.ts` ("laporan belajar dan laporan integritas
 * tidak bercampur"), yang melarang `listRun`, `kejadian`, dan
 * `ringkasIntegritasByOwner` muncul di halaman-halaman itu. Yang halaman itu
 * butuhkan hanyalah satu bit per run: apakah kamera tercatat menyala.
 *
 * Peta ini **penuh** untuk pemilik tersebut — bukan hanya run aktif, bukan satu
 * periode, dan bukan hanya run yang dirujuk baris progres. Peta yang lebih
 * sempit membuat run yang sebenarnya bisa ditelusuri tampil sebagai
 * `terverifikasi_tanpa_bukti_kamera`, dan kalimat itu terbaca seperti temuan
 * tentang orangnya, bukan seperti data yang tidak ada.
 */
export async function petaKameraMulaiPemilik(userId: string): Promise<Map<string, boolean>> {
  const peta = new Map<string, boolean>();
  for (const run of (await listRunStaf()).filter((r) => r.userId === userId)) {
    const isi = await listEventRun(run.id);
    peta.set(run.id, isi.some((k) => k.kind === "kamera_mulai"));
  }
  return peta;
}
```

Tambahkan `listEventRun` ke impor `./repository` di file itu.

(b) Di `src/app/(verifikator)/performa/[owner]/page.tsx`, ganti blok import (baris 7–14) dengan:

```tsx
import { LABEL_JALUR } from "@/lib/performa/jalur-selesai";
import {
  listAttemptSemua,
  listEnrollmentStaf,
  listProgresSemua,
} from "@/lib/learning/repository";
import { detailPembelajaranDariDb } from "@/lib/learning/dashboard";
import { petaKameraMulaiPemilik } from "@/lib/learning/run-service";
import { BATAS_SINYAL } from "@/lib/learning/sumber-sinyal";
```

(c) Ganti baris `const record = detailPembelajaranDariDb({ ... })` (sekitar baris 45) dengan:

```tsx
  // Peta kamera dihitung lewat aksesor sempit, bukan di halaman ini: halaman
  // laporan belajar dijaga agar tidak pernah membaca baris run maupun isi
  // kejadiannya (lihat `security.test.ts`). `EnrollmentStaf` sudah membawa
  // `user.userId`, jadi pemilik diambil langsung dari enrollment yang tadi sudah
  // difilter email — tidak perlu mencocokkan email dengan run.
  const petaKamera =
    enrollments.length > 0 ? await petaKameraMulaiPemilik(enrollments[0].user.userId) : new Map<string, boolean>();

  const record = detailPembelajaranDariDb({
    enrollments,
    progress,
    attempts,
    kameraMulai: petaKamera,
  });
```

> `enrollments.length > 0` dijaga karena `detailPembelajaranDariDb` mengembalikan `null` untuk enrollment kosong dan pemanggil sudah `notFound()` pada kasus itu — tetapi aksesor dipanggil lebih dulu, jadi jangan biarkan ia membaca run untuk halaman yang memang tidak memuat peserta.

Lalu ubah baris label (baris 86):

```tsx
                        selesai {LABEL_JALUR[s.jalur]} · {s.at}
```

**Wajib: halaman ini sekarang menampilkan sinyal kamera, jadi ia wajib membawa batasnya.** Spec §"Batas yang harus tertulis di UI" (baris 188–199) dan P3 (baris 88–99) mensyaratkan setiap permukaan yang menampilkan sinyal baru memuat label kebocoran asal sinyalnya — untuk kamera: "model bisa salah; tidak mengidentifikasi orang". Halaman ini sekarang hanya memuat `PeringatanPembelajaran`, yang isinya **hanya** baris peringatan skor kuis; tidak ada satu pun kalimat soal kamera. Tambahkan batas itu tepat setelah `<PeringatanPembelajaran />` (baris 69), memakai teks yang **sudah ada** — jangan menyalin kalimat baru:

```tsx
                {/* Label jalur di bawah berasal dari `kamera_mulai`, jadi batas
                    asal sinyalnya wajib ikut tampil di halaman yang sama — spec
                    P3/§"Batas yang harus tertulis di UI". Teksnya bukan kalimat
                    baru: `BATAS_SINYAL` sudah mengunci satu batas per asal, dan
                    `sumber-sinyal.test.ts` menjaganya. */}
                <p className="mt-2 text-xs text-muted-foreground">{BATAS_SINYAL.kamera}</p>
```

> **Jangan** taruh baris ini di `PERINGATAN_PEMBELAJARAN` (`performa-belajar.tsx:16`): array itu ikut dirender oleh `/performa` (daftar peserta, baris 44), yang **tidak** menampilkan label kamera. Spec minta batas muncul di permukaan yang memuat sinyal; menambahkannya di halaman yang tidak memuat sinyal adalah kesalahan yang lebih mahal daripada yang dihindari.

> Test render komponen tidak mungkin di repo ini: `vitest.config.mts` hanya `include` `src/**/*.test.ts` dengan `environment: "node"` tanpa jsdom, jadi `.test.tsx` tidak pernah dijalankan. Yang bisa dikunci sudah dikunci: **teks** batasnya diuji `sumber-sinyal.test.ts:58-60` ("bisa salah" + "tidak mengidentifikasi"); yang tersisa — bahwa halaman benar-benar merendernya — masuk ke verifikasi manual.

> `performa-belajar.tsx` (daftar peserta) **tidak** diubah: `BarisPembelajaran` hanya punya hitungan `terverifikasi`, bukan daftar modul, jadi tidak ada run yang bisa dipetakan tanpa mengubah bentuk datanya. Catatannya ada di Task E, bukan lisensi untuk mengarang.

- [ ] **Step 7: Run the gate**

Run: `npm run check && npm run build`
Expected: semuanya hijau. `npm run build` wajib di sini — perubahan server-rendering yang menyentuh pemanggilan DB dan import modul.

- [ ] **Step 8: Commit**

```bash
git add src/lib/learning/dashboard.ts src/lib/learning/dashboard.test.ts "src/app/(verifikator)/performa/[owner]/page.tsx"
git commit -m "feat(performa): laporan menyatakan arti jalur terverifikasi (kamera atau tidak)"
```

---

# BAGIAN D — Dokumentasi

## Task E: Perbarui catatan di spec & AGENTS.md

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-lapisan-pengawasan-anti-curang-design.md` (§"Kamera tidak menambah nilai `completion_path`", setelah baris 186)
- Modify: `AGENTS.md` (bagian `## Architecture`, baris 66–68 — saat ini kosong)

- [ ] **Step 1: Record the decided rule**

Di spec, setelah paragraf terakhir §"Kamera tidak menambah nilai `completion_path`" (baris 186), tambahkan:

```markdown
**Status implementasi (2026-09-27):** konsekuensi di atas sudah ditegakkan.
`completion_path` tetap dua nilai; label jalur diturunkan di
`src/lib/performa/jalur-selesai.ts` (`jalurDariBukti` + `LABEL_JALUR`).
Gerbang `wajib_kamera` ditegakkan server di dua jalur: `selesaikanMateriAction`
dan `selesaikanModulKuisVerified`, keduanya membaca `kamera_mulai` dari run —
bukan dari klaim klien.

**Pelusan spec ini.** Paragraf di atas menyebut label `terverifikasi` atau
`terverifikasi_kamera` "dari run yang mendasarinya", dan itu belum cukup lengkap.
`module_progress.evidence_id` diisi oleh writer berbeda: jalur materi menyimpannya
sebagai `learning_runs.id` — atau `null` pada course `opsional` yang memang tidak
punya run — dan jalur kuis sebagai `quiz_attempts.id` (`schema.ts:524-526`).
Keduanya **tidak punya run yang bisa ditelusuri**, dan label untuk keduanya adalah
`terverifikasi_tanpa_bukti_kamera` — "jalur terverifikasi, kamera
tidak bisa ditelusuri ke run". Itu **bukan** nilai `completion_path` keempat:
kolomnya tetap dua nilai, dan label turunan boleh lebih dari dua.

Tiga hal yang **sengaja tidak** dikerjakan dan tidak boleh dianggap terlewat:

1. `performa-belajar.tsx` (daftar peserta) tetap menampilkan
   `LABEL_SUMBER.terverifikasi` yang generik. `BarisPembelajaran` hanya punya
   **hitungan**, bukan daftar modul, jadi tidak ada run yang bisa dipetakan
   tanpa mengubah bentuk datanya lebih dulu.
2. `SumberPenyelesaian` di `src/lib/performa/store.ts` tidak mendapat nilai
   baru. Tipe itu adalah bentuk data **yang tersimpan** (`.data/performa`), bukan
   bentuk tampilan; menambah nilainya mengubah kontrak JSON yang sudah punya
   pembaca.
3. `evidence_id` tidak diubah, dan tidak ada kolom kedua untuk run kuis.
   Menambahkannya berarti migrasi; label `terverifikasi_tanpa_bukti_kamera`
   menyatakan batas bukti apa adanya, yang justru lebih jujur daripada menyimpan
   run tebakan.
```

Di `AGENTS.md`, bagian `## Architecture` (baris 66–68) saat ini kosong. Isi dengan:

```markdown
## Architecture

- **Label jalur di laporan diturunkan, bukan disimpan.** `completion_path` tetap
  dua nilai (`terverifikasi`/`informal`, CHECK di `schema.ts:473`); label empat
  nilai dihitung di `src/lib/performa/jalur-selesai.ts`. Jangan
  "menyederhanakan" dengan menambah nilai kolom baru.
- **`wajib_kamera` ditegakkan server dari `kamera_mulai`, bukan dari boolean
  klien.** Dua gerbang: `selesaikanMateriAction` (cabang `perlu_kamera` dari
  `putuskanAkses`) dan `selesaikanModulKuisVerified` (kode `perlu_kamera`).
- **`module_progress.evidence_id` berisi dua jenis id, plus `null`.** Jalur materi
  mengisi `learning_runs.id`, atau `null` pada course `opsional` yang memang tidak
  punya run; jalur kuis mengisi `quiz_attempts.id`. Apa pun yang memetakan bukti
  ke run harus memeriksa jenisnya lebih dulu, bukan menganggap id yang tidak
  ditemukan di peta run berarti "tidak ada kamera".
```

- [ ] **Step 2: Run the gate**

Run: `npm run check`
Expected: hijau. `skills:check` memvalidasi `.agents/skills/`; dokumen ini bukan skill, jadi yang diperiksa adalah `tsc`/`eslint`/test tetap hijau.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md docs/superpowers/specs/2026-09-27-lapisan-pengawasan-anti-curang-design.md
git commit -m "docs: catat aturan label jalur terverifikasi dan gerbang wajib_kamera"
```

---

## Yang TIDAK dikerjakan di plan ini (sengaja)

- **`completion_path` tidak menjadi tiga nilai.** CHECK constraint di tiga tabel; label turunan cukup — dan label turunan boleh punya lebih dari dua nilai (lihat Task C).
- **`hitungCompletionPath` tidak diubah.** Ia membaca `module_progress`, bukan run; logikanya sudah benar dan sudah diuji.
- **`evidence_id` tidak diubah dan tidak ada kolom kedua untuk run kuis.** Itu yang membuat `terverifikasi_tanpa_bukti_kamera` perlu ada, dan mengubahnya berarti migrasi.
- **Tidak ada pemeriksaan `integrityVersion` run di gerbang kuis.** Gerbang kuis memeriksa keberadaan run aktif + `kamera_mulai` saja. Rekonsiliasi versi run terhadap kebijakan adalah pekerjaan jalur bukti sesi (`buktikanSesiDb`), bukan gerbang kamera.
- **Tidak ada skor/bahaya/reputasi baru.** Aturan repo: sinyal integritas tidak pernah menurunkan skor.
- **Tidak ada bandingan human-review** — spec terpisah (`2026-09-25-temuan-integritas-dan-banding-design.md`), belum diimplementasikan.
- **Tidak ada nilai baru di `SumberPenyelesaian`.** Tipe itu adalah bentuk data yang tersimpan (`.data/performa`), bukan tampilan.
- **Tidak ada test integrasi baru untuk gerbang kuis.** `npm run test:db` sedang rusak di config load secara terpisah; gerbang diuji unit di `assessment-service.test.ts`. Saat `test:db` diperbaiki, tambahkan kasus `wajib_kamera` dengan run sungguhan.

## Verifikasi manual (wajib, bersama `careevo-browser-verify`)

Lima klaim di sini **harus** diukur di browser, bukan dibaca:

1. `/performa/<email>`, modul yang diselesaikan lewat **materi** pada run dengan `kamera_mulai` → label memuat "dengan kamera menyala".
2. Modul yang diselesaikan lewat **materi** pada run **tanpa** `kamera_mulai` → label memuat "kamera tidak tercatat".
3. Modul yang diselesaikan lewat **kuis** (jadi `evidence_id` = `quiz_attempts.id`) → label memuat "tidak bisa ditelusuri ke run", **bukan** "kamera tidak tercatat". Ini klaim yang paling mudah salah dan paling jarang dilihat.
4. Halaman `/performa/<email>` memuat **batas sinyal kamera** ("bisa salah" / "tidak mengidentifikasi") di bawah peringatan yang sudah ada — dan `/performa` (daftar peserta) **tidak** memuatnya, karena halaman itu tidak menampilkan label kamera.
5. Course `wajib_kamera`: menyelesaikan modul dengan sesi sah tapi tanpa `kamera_mulai` → **ditolak** dengan pesan kamera, dan `tandaiModulDb` tidak menulis. Hal yang sama untuk jalur kuis yang lulus.

Kalau harness browser tidak tersedia di environment itu, nyatakan terus terang di laporan bahwa kelima klaim itu **belum diverifikasi** — jangan menulis "sudah dites" untuk yang hanya dibaca. Klaim 3 dan 4 khususnya bisa lolos seluruh test otomatis: `jalur-selesai.test.ts` dan `dashboard.test.ts` mengujinya dengan id `"att-1"` buatan, bukan id attempt sungguhan, dan teks batasnya sudah diuji di `sumber-sinyal.test.ts` tanpa pernah merender halaman.
