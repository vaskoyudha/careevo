# Anti-Curang Course & Sesi Ujian (Paket C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat pengerjaan kegiatan course hanya bisa diselesaikan di dalam sesi terverifikasi, dengan aturan yang ditentukan ahli, verifikasi server, dan pencatatan kejadian integritas yang tidak menghukum otomatis.

**Architecture:** Sesi belajar menjadi entitas tersimpan (`CourseRun`) berisi kebijakan versi dan bukti sesi bertanda tangan HMAC. Kamus aturan murni (`kebijakan.ts`, `akses.ts`) menjadi sumber tunggal keputusan "boleh dikerjakan tanpa bukti / perlu sesi / ditolak". Komponen klien (`CourseSessionProvider`) memicu sesi, mencatat kejadian `visibilitychange`/fokus, dan menyediakan bukti untuk aksi; server tetap memvalidasi bukti, kebijakan, dan prasyarat di setiap action.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod 4, Vitest 5 (node env), Tailwind v4, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-02-14-anti-curang-course-design.md`

## Global Constraints

- Business-logic function names are Indonesian; infra/UI code English. Match surrounding file language.
- User-facing copy and `<html lang>` are Indonesian (`id`).
- Vitest `include` is exactly `src/**/*.test.ts` — no `.test.tsx`, no jsdom. Test pure logic only.
- `@/` alias maps to `src/` in both `tsconfig.json` and `vitest.config.mts`.
- Stores in `src/lib/courses/` must stay server-only when they touch `node:fs`; client-imported modules (`kurikulum.ts`, `kebijakan.ts`, `akses.ts`) must stay pure.
- HMAC uses a keyed `createHmac("sha256", secret)` with `timingSafeEqual` on equal-length buffers, same pattern as `src/lib/courses/enrollment.ts`.
- Every Server Action must be gated (`getSession()` / `gateStaff()`) and must not trust client-supplied policy output.
- Never emit `jawaban_benar` to client components.
- Tests must not write to the repo's real `data/` or `.data/`: set `CAREEVO_DATA_DIR` (courses) before importing the store.
- Do NOT delete `.data/` or `data/` wholesale; it holds resume/course demo data.
- Run `npm run check` (typecheck → lint → skills:check → test) before each commit that closes a task group.
- The extended camera-based proctoring, extension detection via companion extension, and AI-text detection are explicitly out of scope for this plan.

---

## File Structure

**Create:**
- `src/lib/courses/kebijakan.ts` — pure policy vocabulary + `kebijakanDefault()` + labels (client-safe).
- `src/lib/courses/kebijakan.test.ts` — tests for defaults/labels.
- `src/lib/learning/akses.ts` — pure activity-access decision engine + event classifiers.
- `src/lib/learning/akses.test.ts` — tests for access decisions and event classification.
- `src/lib/learning/session.ts` — server-only session store (`.data/sessions/`): create/read/close/record-event, HMAC session proof.
- `src/lib/learning/session.test.ts` — tests for session lifecycle and proof validation.
- `src/lib/learning/security.test.ts` — static source scan: no `jawaban_benar` leak, gates present.
- `src/components/features/learning/course-session.tsx` — `CourseSessionProvider` + `useCourseSession()` + `CourseSessionGate` + indicator.
- `src/components/features/learning/kejadian-panel.tsx` — integrity-event list + "Laporkan gangguan" + reveal-permission UI.
- `src/actions/learning.ts` — `mulaiSesiAction`, `catatKejadianAction`, `selesaikanMateriAction`.

**Modify:**
- `src/types/course.ts` — add `KebijakanCourse`, `AturanBantuan`, `AturanPengawasan`, `CheckpointMateri`; add `checkpoint?` to `Modul`; update `CreateModulInput`/`UpdateModulInput`.
- `src/lib/validation/modul.ts` — accept + validate `checkpoint`.
- `src/lib/courses/store.ts` — create default checkpoint on `createModul`; persist checkpoint on `updateModul`.
- `src/lib/courses/katalog.ts` — carry `checkpoint` through the derived `ModulKursus` mapping.
- `src/components/features/learning/detail-kursus.tsx` — wrap in session provider; gate "Buka materi"/kuis via access engine; render indicator + report control.
- `src/app/(app)/belajar/[slug]/page.tsx` — pass policy and owner into `DetailKursus`; refresh existing `CourseRun` from DB-payload-free `getRun` read.
- `src/components/features/admin/courses/kursus-detail.tsx` — policy form (aturan bantuan, aturan pengawasan, versi kebijakan).
- `src/components/features/admin/courses/modul-editor.tsx` — checkpoint editor per module.
- `scripts/smoke.mjs` — add `/ujian` and `/ujian/demo` routes.

---

## Task 1: Policy vocabulary + types (pure, client-safe)

**Files:**
- Modify: `src/types/course.ts`
- Modify: `src/lib/validation/modul.ts`
- Create: `src/lib/courses/kebijakan.ts`
- Create: `src/lib/courses/kebijakan.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AturanBantuan`, `AturanPengawasan`, `KebijakanCourse`, `CheckpointMateri` types; `kebijakanDefault(): KebijakanCourse`; `LABEL_ATURAN_BANTUAN: Record<AturanBantuan,string>`; `LABEL_ATURAN_PENGAWASAN: Record<AturanPengawasan,string>`; `PESAN_POLICY: Record<AturanPengawasan,string>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/courses/kebijakan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  LABEL_ATURAN_BANTUAN,
  LABEL_ATURAN_PENGAWASAN,
  PESAN_POLICY,
  kebijakanDefault,
} from "./kebijakan";

describe("kebijakanDefault", () => {
  it("defaults to session-required proctoring", () => {
    const k = kebijakanDefault();
    expect(k.aturan_bantuan).toBe("bertutor");
    expect(k.aturan_pengawasan).toBe("wajib");
    expect(k.versi).toBe(1);
    expect(k.aturan_pengawasan_sejak).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("labels", () => {
  it("has an Indonesian label for every help rule", () => {
    expect(LABEL_ATURAN_BANTUAN.bebas).toContain("diizinkan");
    expect(LABEL_ATURAN_BANTUAN.tanpa_ai).toContain("AI");
  });

  it("has an Indonesian label and gate message for every proctoring rule", () => {
    expect(LABEL_ATURAN_PENGAWASAN.wajib).toContain("kamera");
    expect(PESAN_POLICY.wajib.length).toBeGreaterThan(20);
    expect(PESAN_POLICY.opsional.length).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/courses/kebijakan.test.ts`
Expected: FAIL — "Cannot find module './kebijakan'".

- [ ] **Step 3: Add types to `src/types/course.ts`**

Append after the `UpdateModulInput` block:

```ts
export type AturanBantuan = "bebas" | "bertutor" | "tanpa_ai";
export type AturanPengawasan = "wajib" | "opsional";

export interface KebijakanCourse {
  aturan_bantuan: AturanBantuan;
  aturan_pengawasan: AturanPengawasan;
  /** Naik setiap kali ahli menyimpan perubahan kebijakan. */
  versi: number;
  aturan_pengawasan_sejak: string;
}

export type ModeCheckpoint = "materi" | "kuis" | "proyek";

export interface CheckpointMateri {
  /** Batas waktu mengerjakan/menyelesaikan, dalam menit. */
  batas_waktu_menit: number;
  /**
   * Materi = cek pemahaman; kuis/proyek menautkan lampiran yang sudah ada.
   * `ref` adalah id materi `kuis` di modul yang sama, atau id tugas (challenge).
   */
  mode: ModeCheckpoint;
  ref?: string;
}
```

Then add to `Modul` (after `halaman?`):

```ts
  /** Aturan pengerjaan modul ini. Absen = kebijakan default kursus. */
  checkpoint?: CheckpointMateri;
```

- [ ] **Step 4: Create `src/lib/courses/kebijakan.ts`**

```ts
import type { AturanBantuan, AturanPengawasan, KebijakanCourse } from "@/types/course";

/**
 * Kosakata kebijakan course — **murni dan aman untuk komponen klien**, sama
 * seperti `kurikulum.ts`. Jangan menambahkan impor store/`node:fs` di sini;
 * import seperti itu menjatuhkan build Turbopack produksi.
 */

export const LABEL_ATURAN_BANTUAN: Record<AturanBantuan, string> = {
  bebas: "Sumber eksternal diizinkan",
  bertutor: "Tutor Careevo boleh; AI eksternal wajib diungkap",
  tanpa_ai: "Tanpa AI dan tanpa tutor saat asesmen",
};

export const LABEL_ATURAN_PENGAWASAN: Record<AturanPengawasan, string> = {
  wajib: "Pengerjaan wajib di dalam sesi terverifikasi (kamera)",
  opsional: "Sesi terverifikasi opsional",
};

export const PESAN_POLICY: Record<AturanPengawasan, string> = {
  wajib:
    "Pengerjaan kegiatan ini hanya bisa diselesaikan di dalam sesi terverifikasi. Kamera dan pencatatan kejadian aktif selama sesi, sesuai persetujuanmu.",
  opsional:
    "Kamu boleh mengerjakan tanpa sesi terverifikasi, tetapi hasilnya tidak dihitung sebagai bukti kompetensi terverifikasi.",
};

/**
 * Kebijakan awal sebuah course.
 *
 * `wajib` dipilih supaya course baru aman secara default: tanpa ini, course
 * baru akan langsung bisa diselesaikan di luar sesi dan buktinya tidak sah.
 */
export function kebijakanDefault(): KebijakanCourse {
  return {
    aturan_bantuan: "bertutor",
    aturan_pengawasan: "wajib",
    versi: 1,
    aturan_pengawasan_sejak: new Date().toISOString(),
  };
}

export const MODE_CHECKPOINT_LABEL: Record<"materi" | "kuis" | "proyek", string> = {
  materi: "Cek pemahaman materi",
  kuis: "Kuis tersimpan",
  proyek: "Proyek/tugas",
};
```

- [ ] **Step 5: Validate checkpoint in `src/lib/validation/modul.ts`**

Add a checkpoint schema and include it in the module schema (read the file first; the module schema currently has `judul`, `ringkasan`, `durasi_min`, and optionally `jumlah_halaman`):

```ts
const checkpointSchema = z.object({
  batas_waktu_menit: z.coerce
    .number()
    .int("Batas waktu harus bilangan bulat")
    .min(1, "Batas waktu minimal 1 menit")
    .max(600, "Batas waktu maksimal 600 menit"),
  mode: z.enum(["materi", "kuis", "proyek"]),
  ref: z.string().trim().max(120, "Referensi maksimal 120 karakter").optional(),
});
```

Then add `checkpoint: checkpointSchema.optional()` to the modul schema object. Keep the field out of `jumlah_halaman` handling.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/lib/courses/kebijakan.test.ts src/lib/validation/modul.test.ts`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add src/types/course.ts src/lib/courses/kebijakan.ts src/lib/courses/kebijakan.test.ts src/lib/validation/modul.ts
git commit -m "feat(learning): kebijakan course + checkpoint materi (pure types)"
```

---

## Task 2: Access decision engine + event classifiers (pure)

**Files:**
- Create: `src/lib/learning/akses.ts`
- Create: `src/lib/learning/akses.test.ts`

**Interfaces:**
- Consumes: `AturanBantuan`, `AturanPengawasan`, `CheckpointMateri` (Task 1).
- Produces: `KonteksAkses`; `KeputusanAkses` = `{ tipe: "bebas" } | { tipe: "perlu_sesi"; pesan: string } | { tipe: "ditolak"; pesan: string }`; `checkpointEfektif(modul, kebijakan): CheckpointMateri`; `putuskanAkses(konteks): KeputusanAkses`; `KATEGORI_TUTOR_BLOKIR: string[]`; `kategoriDiblokir(kategori, kebijakan): boolean`; `KJenisKejadian`; `klasifikasiKejadian(jenis, visibilitas): "kejadian" | "celah"`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/learning/akses.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import type { CheckpointMateri, KebijakanCourse } from "@/types/course";
import { checkpointEfektif, kategoriDiblokir, klasifikasiKejadian, putuskanAkses } from "./akses";

const MODUL = { id: "m1", checkpoint: { batas_waktu_menit: 20, mode: "kuis", ref: "mat-1" } as CheckpointMateri };
const kebijakan = (p: Partial<KebijakanCourse> = {}): KebijakanCourse => ({ ...kebijakanDefault(), ...p });

describe("checkpointEfektif", () => {
  it("returns the default checkpoint when the module has none", () => {
    const hasil = checkpointEfektif({ id: "m2" }, kebijakan());
    expect(hasil.mode).toBe("materi");
    expect(hasil.batas_waktu_menit).toBe(30);
  });

  it("prefers the module checkpoint and falls back if it is malformed", () => {
    expect(checkpointEfektif(MODUL, kebijakan()).mode).toBe("kuis");
    const rusak = checkpointEfektif({ id: "m3", checkpoint: { mode: "kuis" } as CheckpointMateri }, kebijakan());
    expect(rusak.mode).toBe("materi");
  });
});

describe("putuskanAkses", () => {
  it("allows free exploration when proctoring is optional", () => {
    const hasil = putuskanAkses({ jenisKegiatan: "materi", kebijakan: kebijakan({ aturan_pengawasan: "opsional" }), adaBuktiSesi: false });
    expect(hasil.tipe).toBe("bebas");
  });

  it("requires a session for required proctoring", () => {
    const hasil = putuskanAkses({ jenisKegiatan: "materi", kebijakan: kebijakan(), adaBuktiSesi: false });
    expect(hasil.tipe).toBe("perlu_sesi");
    if (hasil.tipe === "perlu_sesi") expect(hasil.pesan).toContain("sesi terverifikasi");
  });

  it("allows required activity once a session proof exists", () => {
    expect(putuskanAkses({ jenisKegiatan: "kuis", kebijakan: kebijakan(), adaBuktiSesi: true }).tipe).toBe("bebas");
  });

  it("rejects academic chatbot help under the no-AI rule", () => {
    const hasil = putuskanAkses({ jenisKegiatan: "bantuan_akademik", kebijakan: kebijakan({ aturan_bantuan: "tanpa_ai" }), adaBuktiSesi: true });
    expect(hasil.tipe).toBe("ditolak");
  });

  it("allows tutor help under the tutor rule", () => {
    expect(putuskanAkses({ jenisKegiatan: "bantuan_akademik", kebijakan: kebijakan({ aturan_bantuan: "bertutor" }), adaBuktiSesi: false }).tipe).toBe("bebas");
  });
});

describe("kategoriDiblokir", () => {
  it("blocks solution-request tutor categories when AI is banned", () => {
    expect(kategoriDiblokir("minta_solusi", kebijakan({ aturan_bantuan: "tanpa_ai" }))).toBe(true);
    expect(kategoriDiblokir("tanya_konsep", kebijakan({ aturan_bantuan: "bertutor" }))).toBe(false);
  });
});

describe("klasifikasiKejadian", () => {
  it("treats a hidden page as an event and a lost stream as a gap", () => {
    expect(klasifikasiKejadian("pindah_tab", "hidden")).toBe("kejadian");
    expect(klasifikasiKejadian("kamera_berhenti", null)).toBe("celah");
    expect(klasifikasiKejadian("fokus_hilang", "visible")).toBe("kejadian");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/learning/akses.test.ts`
Expected: FAIL — "Cannot find module './akses'".

- [ ] **Step 3: Create `src/lib/learning/akses.ts`**

```ts
import { PESAN_POLICY } from "@/lib/courses/kebijakan";
import type { AturanBantuan, CheckpointMateri, KebijakanCourse } from "@/types/course";

/**
 * Mesin keputusan akses kegiatan belajar — **murni**, dipakai klien (untuk
 * pesan/gerbang UI) dan server (sebagai pemeriksaan otoritatif).
 *
 * Satu fungsi, satu keputusan: klien tidak boleh menyimpulkan sendiri. Pesan
 * yang dikembalikan dipakai apa adanya oleh UI supaya copy tidak menyimpang.
 */

export type JenisKegiatan = "materi" | "kuis" | "proyek" | "bantuan_akademik" | "pembelaan";

export interface KonteksAkses {
  jenisKegiatan: JenisKegiatan;
  kebijakan: KebijakanCourse;
  /** True bila ada bukti sesi yang valid & cocok dengan kebijakan saat ini. */
  adaBuktiSesi: boolean;
}

export type KeputusanAkses =
  | { tipe: "bebas" }
  | { tipe: "perlu_sesi"; pesan: string }
  | { tipe: "ditolak"; pesan: string };

const CHECKPOINT_DEFAULT: CheckpointMateri = { batas_waktu_menit: 30, mode: "materi" };

/** Checkpoint efektif sebuah modul: tersimpan bila lengkap, selain itu default. */
export function checkpointEfektif(
  modul: { checkpoint?: CheckpointMateri },
  _kebijakan: KebijakanCourse,
): CheckpointMateri {
  const c = modul.checkpoint;
  if (!c || typeof c.batas_waktu_menit !== "number" || !["materi", "kuis", "proyek"].includes(c.mode)) {
    return { ...CHECKPOINT_DEFAULT };
  }
  return { ...c };
}

export function putuskanAkses({ jenisKegiatan, kebijakan, adaBuktiSesi }: KonteksAkses): KeputusanAkses {
  // Asesmen tanpa AI selalu menutup bantuan akademik, terlepas dari sesi.
  if (jenisKegiatan === "bantuan_akademik" && kebijakan.aturan_bantuan === "tanpa_ai") {
    return {
      tipe: "ditolak",
      pesan: "Aturan course ini melarang bantuan AI saat asesmen. Bantuan akademik tidak tersedia untuk sesi ini.",
    };
  }
  if (jenisKegiatan === "bantuan_akademik") return { tipe: "bebas" };

  if (kebijakan.aturan_pengawasan === "opsional") return { tipe: "bebas" };

  if (!adaBuktiSesi) {
    return { tipe: "perlu_sesi", pesan: PESAN_POLICY.wajib };
  }
  return { tipe: "bebas" };
}

/** Kategori bantuan akademik yang ditutup saat aturan `tanpa_ai`. */
export const KATEGORI_TUTOR_BLOKIR = ["minta_solusi", "minta_jawaban", "kerjakan_tugas"] as const;

export function kategoriDiblokir(kategori: string, kebijakan: KebijakanCourse): boolean {
  if (kebijakan.aturan_bantuan !== "tanpa_ai") return false;
  return (KATEGORI_TUTOR_BLOKIR as readonly string[]).includes(kategori);
}

export type KJenisKejadian =
  | "pindah_tab"
  | "fokus_hilang"
  | "kamera_mulai"
  | "kamera_berhenti"
  | "kamera_gagal"
  | "sesi_dimulai"
  | "sesi_diakhiri";

export type JenisKejadian = "kejadian" | "celah";

/**
 * Pisahkan "kejadian" dari "celah pengawasan".
 *
 * Kejadian = sesuatu yang teramati tetapi ambigu (pindah tab bisa berarti
 * dokumentasi yang diizinkan). Celah = pengawasan benar-benar berhenti,
 * sehingga bukti kegiatan menjadi tidak lengkap dan perlu klarifikasi.
 */
export function klasifikasiKejadian(jenis: KJenisKejadian, visibilitas: "visible" | "hidden" | null): JenisKejadian {
  if (jenis === "kamera_berhenti" || jenis === "kamera_gagal") return "celah";
  if (jenis === "pindah_tab") return visibilitas === "hidden" ? "kejadian" : "celah";
  return "kejadian";
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/learning/akses.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/learning/akses.ts src/lib/learning/akses.test.ts
git commit -m "feat(learning): mesin keputusan akses kegiatan + klasifikasi kejadian"
```

---

## Task 3: Session store (server-only, file-based) + session proof

**Files:**
- Create: `src/lib/learning/session.ts`
- Create: `src/lib/learning/session.test.ts`

**Interfaces:**
- Consumes: `KebijakanCourse` (Task 1).
- Produces: `SessionRun`, `KejadianIntegritas`; `tempatSesi(): string`; `buatBuktiSesi(input): string`; `verifikasiBuktiSesi(token, harapan): BuktiSesi | null`; `mulaiRun(input): Promise<SessionRun>`; `ambilRun(id): Promise<SessionRun | null>`; `catatKejadian(input): Promise<SessionRun | null>`; `akhiriRun(id, alasan): Promise<SessionRun | null>`; `buktikanSesi({courseId, owner, policyVersion, token}): Promise<SessionRun | null>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/learning/session.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DIR = mkdtempSync(path.join(tmpdir(), "careevo-sesi-"));
process.env.CAREERS_SESSION_DIR = DIR;

const mod = await import("./session");

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe("bukti sesi", () => {
  it("verifies a proof minted for the same course, owner, and policy version", () => {
    const token = mod.buktiBaru({ courseId: "crs-1", owner: "a@b.test", policyVersion: 2 });
    const hasil = mod.verifikasiBuktiSesi(token, { courseId: "crs-1", owner: "a@b.test", policyVersion: 2 });
    expect(hasil?.courseId).toBe("crs-1");
  });

  it("rejects a proof whose policy version is stale", () => {
    const token = mod.buktiBaru({ courseId: "crs-1", owner: "a@b.test", policyVersion: 1 });
    expect(mod.verifikasiBuktiSesi(token, { courseId: "crs-1", owner: "a@b.test", policyVersion: 2 })).toBeNull();
  });

  it("rejects a tampered proof", () => {
    const token = mod.buktiBaru({ courseId: "crs-1", owner: "a@b.test", policyVersion: 1 });
    expect(mod.verifikasiBuktiSesi(`${token}x`, { courseId: "crs-1", owner: "a@b.test", policyVersion: 1 })).toBeNull();
  });
});

describe("siklus hidup run", () => {
  it("starts a run in status aktif and ends it", async () => {
    const run = await mod.mulaiRun({ courseId: "crs-1", owner: "a@b.test", policyVersion: 1 });
    expect(run.status).toBe("aktif");
    const diakhiri = await mod.akhiriRun(run.id, "peserta_akhiri");
    expect(diakhiri?.status).toBe("diakhiri");
    expect(await mod.ambilRun("sesi-tidak-ada")).toBeNull();
  });

  it("records integrity events with a gap classification", async () => {
    const run = await mod.mulaiRun({ courseId: "crs-1", owner: "a@b.test", policyVersion: 1 });
    const setelah = await mod.catatKejadian({
      runId: run.id,
      jenis: "kamera_berhenti",
      visibilitas: null,
      detail: "stream berhenti",
    });
    expect(setelah?.kejadian).toHaveLength(1);
    expect(setelah?.kejadian[0].jenis_klasifikasi).toBe("celah");
  });

  it("refuses to record events on a closed run", async () => {
    const run = await mod.mulaiRun({ courseId: "crs-1", owner: "a@b.test", policyVersion: 1 });
    await mod.akhiriRun(run.id, "peserta_akhiri");
    expect(await mod.catatKejadian({ runId: run.id, jenis: "pindah_tab", visibilitas: "hidden" })).toBeNull();
  });
});

describe("buktikanSesi", () => {
  it("returns the run only when owner, course, and policy version all match", async () => {
    const run = await mod.mulaiRun({ courseId: "crs-9", owner: "c@d.test", policyVersion: 3 });
    const token = mod.buktiBaru({ courseId: "crs-9", owner: "c@d.test", policyVersion: 3 });
    expect((await mod.buktikanSesi({ courseId: "crs-9", owner: "c@d.test", policyVersion: 3, token }))?.id).toBe(run.id);
    expect(await mod.buktikanSesi({ courseId: "crs-9", owner: "lain@d.test", policyVersion: 3, token })).toBeNull();
    expect(await mod.buktikanSesi({ courseId: "crs-9", owner: "c@d.test", policyVersion: 4, token })).toBeNull();
  });

  it("refuses a closed run", async () => {
    const run = await mod.mulaiRun({ courseId: "crs-10", owner: "e@f.test", policyVersion: 1 });
    const token = mod.buktiBaru({ courseId: "crs-10", owner: "e@f.test", policyVersion: 1 });
    await mod.akhiriRun(run.id, "peserta_akhiri");
    expect(await mod.buktikanSesi({ courseId: "crs-10", owner: "e@f.test", policyVersion: 1, token })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/learning/session.test.ts`
Expected: FAIL — "Cannot find module './session'".

- [ ] **Step 3: Create `src/lib/learning/session.ts`**

```ts
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { klasifikasiKejadian, type KJenisKejadian } from "./akses";

/**
 * Penyimpanan sesi belajar — **server-only**.
 *
 * Sesi harus hidup di server, bukan di cookie: kelulusan dan status integritas
 * hanya boleh berasal dari catatan yang tidak bisa diubah peserta. Cookie
 * (seperti `ls_enroll`) tetap dipakai untuk progres informal, tetapi tidak
 * pernah menjadi bukti sesi.
 *
 * Direktori bisa dialihkan lewat `CAREERS_SESSION_DIR` supaya test tidak
 * menyentuh `.data/` milik repo.
 */

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-session-secret-careevo";

export function tempatSesi(): string {
  return process.env.CAREERS_SESSION_DIR ?? path.join(process.cwd(), ".data", "sessions");
}

export interface KejadianIntegritas {
  at: string;
  jenis: KJenisKejadian;
  jenis_klasifikasi: "kejadian" | "celah";
  visibilitas: "visible" | "hidden" | null;
  detail?: string;
}

export type StatusRun = "aktif" | "diakhiri" | "kedaluwarsa";

export interface SessionRun {
  id: string;
  course_id: string;
  owner: string;
  policy_version: number;
  status: StatusRun;
  mulai_at: string;
  berakhir_at: string | null;
  alasan_akhir?: string;
  kejadian: KejadianIntegritas[];
}

export interface BuktiSesi {
  courseId: string;
  owner: string;
  policyVersion: number;
}

function tanda(isi: string): string {
  return createHmac("sha256", SESSION_SECRET).update(isi).digest("base64url");
}

function samakan(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isRun(value: unknown): value is SessionRun {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.course_id === "string" &&
    typeof c.owner === "string" &&
    typeof c.policy_version === "number" &&
    typeof c.status === "string" &&
    typeof c.mulai_at === "string" &&
    Array.isArray(c.kejadian)
  );
}

/** Bukti sesi: tanda tangan atas (courseId, owner, policyVersion). */
export function buktiBaru(input: BuktiSesi): string {
  const isi = [input.courseId, input.owner, input.policyVersion].join("\u0001");
  return `${Buffer.from(isi, "utf8").toString("base64url")}.${tanda(isi)}`;
}

export function verifikasiBuktiSesi(token: string, harapan: BuktiSesi): BuktiSesi | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  let isi: string;
  try {
    isi = Buffer.from(body, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!samakan(signature, tanda(isi))) return null;
  const [courseId, owner, versi] = isi.split("\u0001");
  if (!courseId || !owner) return null;
  const policyVersion = Number(versi);
  if (!Number.isInteger(policyVersion)) return null;
  if (courseId !== harapan.courseId || owner !== harapan.owner) return null;
  if (policyVersion !== harapan.policyVersion) return null;
  return { courseId, owner, policyVersion };
}

function berkasRun(id: string): string {
  const aman = path.basename(id);
  if (aman !== id) throw new Error(`Id sesi tidak valid: ${id}`);
  return path.join(tempatSesi(), `${aman}.json`);
}

async function tulisRun(run: SessionRun): Promise<void> {
  const tujuan = berkasRun(run.id);
  await mkdir(path.dirname(tujuan), { recursive: true });
  const sementara = `${tujuan}.tmp`;
  await writeFile(sementara, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  await rename(sementara, tujuan);
}

export async function ambilRun(id: string): Promise<SessionRun | null> {
  let mentah: string;
  try {
    mentah = await readFile(berkasRun(id), "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(mentah) as unknown;
    return isRun(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function mulaiRun(input: {
  courseId: string;
  owner: string;
  policyVersion: number;
}): Promise<SessionRun> {
  const run: SessionRun = {
    id: `sesi-${randomUUID()}`,
    course_id: input.courseId,
    owner: input.owner.trim().toLowerCase(),
    policy_version: input.policyVersion,
    status: "aktif",
    mulai_at: new Date().toISOString(),
    berakhir_at: null,
    kejadian: [],
  };
  await tulisRun(run);
  return run;
}

export async function catatKejadian(input: {
  runId: string;
  jenis: KJenisKejadian;
  visibilitas: "visible" | "hidden" | null;
  detail?: string;
  at?: string;
}): Promise<SessionRun | null> {
  const run = await ambilRun(input.runId);
  // Kejadian pada sesi yang sudah ditutup ditolak: menyisipkan kejadian ke
  // sesi selesai akan mengubah bukti setelah fakta.
  if (!run || run.status !== "aktif") return null;

  const kejadian: KejadianIntegritas = {
    at: input.at ?? new Date().toISOString(),
    jenis: input.jenis,
    jenis_klasifikasi: klasifikasiKejadian(input.jenis, input.visibilitas),
    visibilitas: input.visibilitas,
    ...(input.detail ? { detail: input.detail.slice(0, 300) } : {}),
  };

  const berikut: SessionRun = { ...run, kejadian: [...run.kejadian, kejadian].slice(-500) };
  await tulisRun(berikut);
  return berikut;
}

export async function akhiriRun(id: string, alasan: string): Promise<SessionRun | null> {
  const run = await ambilRun(id);
  if (!run) return null;
  if (run.status !== "aktif") return run;
  const berikut: SessionRun = {
    ...run,
    status: "diakhiri",
    berakhir_at: new Date().toISOString(),
    alasan_akhir: alasan.slice(0, 200),
  };
  await tulisRun(berikut);
  return berikut;
}

/**
 * Validasi bukti sesi terhadap server.
 *
 * Empat hal diperiksa sekaligus: tanda tangan, kecocokan owner, kecocokan
 * course, dan kecocokan versi kebijakan. Versi ikut diperiksa supaya peserta
 * yang mulai di bawah kebijakan lama tidak otomatis tunduk pada aturan baru.
 */
export async function buktikanSesi(input: {
  courseId: string;
  owner: string;
  policyVersion: number;
  token: string;
}): Promise<SessionRun | null> {
  const bukti = verifikasiBuktiSesi(input.token, {
    courseId: input.courseId,
    owner: input.owner.trim().toLowerCase(),
    policyVersion: input.policyVersion,
  });
  if (!bukti) return null;
  const run = await ambilRun(bukti.owner === input.owner ? (await cariRunAktif(input)) ?? "" : "");
  if (!run || run.status !== "aktif") return null;
  return run;
}

/** Cari sesi aktif milik seorang peserta untuk sebuah course. */
async function cariRunAktif(input: { courseId: string; owner: string }): Promise<string | null> {
  const { readdir } = await import("node:fs/promises");
  let berkas: string[];
  try {
    berkas = await readdir(tempatSesi());
  } catch {
    return null;
  }
  for (const nama of berkas) {
    if (!nama.endsWith(".json")) continue;
    const run = await ambilRun(nama.replace(/\.json$/, ""));
    if (!run) continue;
    if (run.status !== "aktif") continue;
    if (run.course_id !== input.courseId) continue;
    if (run.owner !== input.owner.trim().toLowerCase()) continue;
    return run.id;
  }
  return null;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/learning/session.test.ts`
Expected: PASS. If `buktikanSesi` fails because `cariRunAktif` returns `null`, replace the awkward line in `buktikanSesi` with the straightforward version:

```ts
  const id = await cariRunAktif(input);
  if (!id) return null;
  const run = await ambilRun(id);
  if (!run || run.status !== "aktif") return null;
  return run;
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/learning/session.ts src/lib/learning/session.test.ts
git commit -m "feat(learning): store sesi server-only + bukti sesi bertanda tangan"
```

---

## Task 4: Carry policy + checkpoint through store and catalog

**Files:**
- Modify: `src/lib/courses/store.ts` (`createModul`, `updateModul`)
- Modify: `src/lib/courses/katalog.ts`
- Test: `src/lib/courses/store-modul.test.ts`

**Interfaces:**
- Consumes: `CheckpointMateri`, `kebijakanDefault` (Task 1).
- Produces: `createModul` returns a module whose `checkpoint.mode === "materi"`; `updateModul` persists a supplied checkpoint; catalog entries expose `checkpoint`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/courses/store-modul.test.ts` (inside the existing describe block for module creation, or as a new block in the same file):

```ts
it("memberi checkpoint default saat modul dibuat", async () => {
  const kursus = await createCourse({
    title: "Uji Checkpoint",
    description: "Course untuk menguji checkpoint modul default.",
    provider: "Careevo Academy",
    url: "https://example.com",
    duration_min: 60,
  });
  const modul = await createModul(kursus.id, { judul: "Modul A", ringkasan: "Ringkasan A", durasi_min: 10 });
  expect(modul?.checkpoint?.mode).toBe("materi");
  expect(modul?.checkpoint?.batas_waktu_menit).toBe(30);
});

it("menyimpan checkpoint pilihan admin", async () => {
  const kursus = await createCourse({
    title: "Uji Checkpoint 2",
    description: "Course untuk menguji checkpoint tersimpan.",
    provider: "Careevo Academy",
    url: "https://example.com",
    duration_min: 60,
  });
  const modul = await createModul(kursus.id, { judul: "Modul B", ringkasan: "Ringkasan B", durasi_min: 10 });
  const hasil = await updateModul(kursus.id, modul!.id, {
    checkpoint: { mode: "kuis", batas_waktu_menit: 15, ref: "mat-9" },
  });
  expect(hasil?.checkpoint?.mode).toBe("kuis");
  expect(hasil?.checkpoint?.batas_waktu_menit).toBe(15);
});
```

Match the existing import style at the top of that test file (`resetCourses`, `createCourse`, `createModul`, `updateModul` from `./store`); add missing imports if the file does not already import them. Ensure the test file sets `CAREEVO_DATA_DIR` before importing the store (the other store tests already do).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/courses/store-modul.test.ts -t checkpoint`
Expected: FAIL — `checkpoint` is `undefined`.

- [ ] **Step 3: Update `createModul` in `src/lib/courses/store.ts`**

Add the import at the top:

```ts
import { kebijakanDefault } from "./kebijakan";
```

Then inside the `modul` object literal in `createModul`, after `halaman:`:

```ts
    // Checkpoint default = cek pemahaman materi. Course baru jadi aman secara
    // default tanpa memaksa admin mengisi apa pun.
    checkpoint: input.checkpoint ?? { mode: "materi", batas_waktu_menit: 30 },
```

Note: `createModul` must not fail when `kebijakanDefault` is unused — only import it if you also use it below for the course policy. If it is unused after this change, do **not** add the import (lint fails on unused imports).

- [ ] **Step 4: Update `updateModul` in `src/lib/courses/store.ts`**

In the object spread that applies `input`, add:

```ts
    ...(input.checkpoint ? { checkpoint: input.checkpoint } : {}),
```

- [ ] **Step 5: Update `CreateModulInput` / `UpdateModulInput` in `src/types/course.ts`**

Add to `CreateModulInput`:

```ts
  checkpoint?: CheckpointMateri;
```

`UpdateModulInput` is `Partial<Omit<CreateModulInput, "jumlah_halaman">>`, so it inherits `checkpoint` automatically — verify with `npm run typecheck`.

- [ ] **Step 6: Carry `checkpoint` through `src/lib/courses/katalog.ts`**

Find the mapping that builds `ModulKursus` entries from stored modules (or via `modulUntukSumber`). Add `checkpoint: m.checkpoint` to the mapped object. Then add `checkpoint?: CheckpointMateri` to the `ModulKursus` interface in `src/lib/courses/kurikulum.ts` (that file is pure and may import types from `@/types/course`).

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/lib/courses` then `npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/courses/store.ts src/lib/courses/katalog.ts src/lib/courses/kurikulum.ts src/types/course.ts src/lib/courses/store-modul.test.ts
git commit -m "feat(courses): persist checkpoint modul dan bawa ke katalog learner"
```

---

## Task 5: Session actions

**Files:**
- Create: `src/actions/learning.ts`
- Create: `src/actions/learning.test.ts`

**Interfaces:**
- Consumes: `mulaiRun`, `catatKejadian`, `akhiriRun`, `buktiBaru` (Task 3); `putuskanAkses` (Task 2); `getCourseById` (existing); `getSession` (existing).
- Produces: `SesiActionState = { ok: boolean; error?: string; runId?: string; bukti?: string; run?: SessionRun }`; `mulaiSesiAction(courseId)`; `catatKejadianAction(input)`; `selesaikanMateriAction(input)`.

- [ ] **Step 1: Write the failing test**

Create `src/actions/learning.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

const DIR = mkdtempSync(path.join(tmpdir(), "careevo-sesi-act-"));
process.env.CAREERS_SESSION_DIR = DIR;

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));

const sesi = { email: "siswa@careevo.test", nama: "Siswa", username: "siswa", role: "user", iat: 1 };
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => sesi,
}));

const { mulaiSesiAction, catatKejadianAction, selesaikanMateriAction } = await import("./learning");
const { daftarKursus } = await import("@/lib/courses/enrollment");

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe("mulaiSesiAction", () => {
  it("creates a session and returns a proof token", async () => {
    await daftarKursus("crs-1", "crs-1");
    const hasil = await mulaiSesiAction("crs-1");
    expect(hasil.ok).toBe(true);
    expect(hasil.bukti).toBeTruthy();
    expect(hasil.run?.owner).toBe("siswa@careevo.test");
  });

  it("rejects a course the caller is not enrolled in", async () => {
    const hasil = await mulaiSesiAction("crs-belum-daftar");
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("daftar");
  });
});

describe("selesaikanMateriAction", () => {
  it("rejects a missing session proof", async () => {
    const hasil = await selesaikanMateriAction({ courseId: "crs-1", modulId: "crs-1-m1", bukti: "" });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("sesi");
  });

  it("accepts a valid proof for a required-proctoring course", async () => {
    await daftarKursus("crs-2", "crs-2");
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
    await daftarKursus("crs-3", "crs-3");
    const mulai = await mulaiSesiAction("crs-3");
    const hasil = await catatKejadianAction({ runId: mulai.runId ?? "", jenis: "pindah_tab", visibilitas: "hidden" });
    expect(hasil.ok).toBe(true);
    expect(hasil.run?.kejadian[0].jenis).toBe("pindah_tab");
  });

  it("refuses an unknown run", async () => {
    const hasil = await catatKejadianAction({ runId: "sesi-palsu", jenis: "pindah_tab", visibilitas: "hidden" });
    expect(hasil.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/actions/learning.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/actions/learning.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/courses/store";
import { cariPendaftaran } from "@/lib/courses/enrollment";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { checkpointEfektif, putuskanAkses, type KJenisKejadian } from "@/lib/learning/akses";
import {
  akhiriRun,
  ambilRun,
  buktiBaru,
  buktikanSesi,
  catatKejadian,
  mulaiRun,
  type SessionRun,
} from "@/lib/learning/session";
import { kebijakanDefault } from "@/lib/courses/kebijakan";

export interface SesiActionState {
  ok: boolean;
  error?: string;
  runId?: string;
  bukti?: string;
  run?: SessionRun;
}

function segarkan(slug: string) {
  try {
    revalidatePath(`/belajar/${slug}`);
  } catch {
    // Di luar lifecycle request Next.js (unit test).
  }
}

/**
 * Mulai sesi terverifikasi untuk sebuah course.
 *
 * Sesi dibuat hanya untuk peserta yang benar-benar terdaftar — tanpa
 * pemeriksaan ini, siapa pun yang tahu id course dapat membuat sesi dan
 * mengklaim pengerjaan.
 */
export async function mulaiSesiAction(courseId: string): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Masuk dulu untuk memulai sesi belajar." };

  const kursus = await getCourseById(courseId);
  if (!kursus) return { ok: false, error: "Kursus tidak ditemukan." };
  if (kursus.status !== "published") return { ok: false, error: "Kursus belum dipublikasikan." };

  const pendaftaran = await cariPendaftaran(courseId);
  if (!pendaftaran) return { ok: false, error: "Daftar kursus ini dulu sebelum memulai sesi." };

  const kebijakan = kursus.kebijakan ?? kebijakanDefault();
  const run = await mulaiRun({
    courseId,
    owner: session.email,
    policyVersion: kebijakan.versi,
  });
  await catatKejadian({ runId: run.id, jenis: "sesi_dimulai", visibilitas: "visible" });

  return {
    ok: true,
    runId: run.id,
    bukti: buktiBaru({ courseId, owner: session.email, policyVersion: kebijakan.versi }),
    run,
  };
}

/** Catat kejadian integritas dari klien; selalu ditandai sumbernya. */
export async function catatKejadianAction(input: {
  runId: string;
  jenis: KJenisKejadian;
  visibilitas: "visible" | "hidden" | null;
  detail?: string;
}): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesi pengguna tidak ditemukan." };

  const run = await ambilRun(input.runId);
  if (!run || run.owner !== session.email.trim().toLowerCase()) {
    return { ok: false, error: "Sesi belajar tidak ditemukan untuk akun ini." };
  }

  const diperbarui = await catatKejadian({
    runId: input.runId,
    jenis: input.jenis,
    visibilitas: input.visibilitas,
    detail: input.detail,
  });
  if (!diperbarui) return { ok: false, error: "Sesi sudah berakhir; kejadian tidak dicatat." };
  return { ok: true, run: diperbarui };
}

/**
 * Selesaikan satu modul.
 *
 * Gerbang server: course wajib punya bukti sesi yang sah **dan** modulnya harus
 * memakai checkpoint `materi`. Tanpa ini, peserta bisa menyelesaikan modul kuis
 * hanya dengan memanggil action ini.
 */
export async function selesaikanMateriAction(input: {
  courseId: string;
  modulId: string;
  bukti: string;
}): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Masuk dulu untuk menyelesaikan materi." };

  const kursus = await getCourseById(input.courseId);
  if (!kursus) return { ok: false, error: "Kursus tidak ditemukan." };

  const kebijakan = kursus.kebijakan ?? kebijakanDefault();
  const modul = await modulUntukSumber({
    id: kursus.id,
    title: kursus.title,
    tags: kursus.tags,
    duration_min: kursus.duration_min,
    url: kursus.url,
  });
  const target = modul.find((m) => m.id === input.modulId);
  if (!target) return { ok: false, error: "Modul tidak ditemukan pada kurikulum saat ini." };

  const checkpoint = checkpointEfektif(target, kebijakan);
  const bukti = input.bukti
    ? await buktikanSesi({
        courseId: input.courseId,
        owner: session.email,
        policyVersion: kebijakan.versi,
        token: input.bukti,
      })
    : null;

  const keputusan = putuskanAkses({
    jenisKegiatan: "materi",
    kebijakan,
    adaBuktiSesi: Boolean(bukti),
  });
  if (keputusan.tipe === "perlu_sesi") return { ok: false, error: keputusan.pesan };
  if (keputusan.tipe === "ditolak") return { ok: false, error: keputusan.pesan };

  if (checkpoint.mode !== "materi") {
    return {
      ok: false,
      error: "Modul ini diselesaikan lewat checkpoint kuis/proyek, bukan penandaan manual.",
    };
  }

  segarkan(kursus.slug);
  return { ok: true, runId: bukti?.id };
}

/** Akhiri sesi secara eksplisit (mis. peserta menutup ruang belajar). */
export async function akhiriSesiAction(runId: string, alasan = "peserta_akhiri"): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesi pengguna tidak ditemukan." };
  const run = await ambilRun(runId);
  if (!run || run.owner !== session.email.trim().toLowerCase()) {
    return { ok: false, error: "Sesi belajar tidak ditemukan untuk akun ini." };
  }
  const diakhiri = await akhiriRun(runId, alasan);
  return { ok: Boolean(diakhiri), run: diakhiri ?? undefined };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/actions/learning.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/actions/learning.ts src/actions/learning.test.ts
git commit -m "feat(learning): server actions sesi, kejadian, dan gerbang penyelesaian materi"
```

---

## Task 6: Session provider, cockpit hook, and indicator (client)

**Files:**
- Create: `src/components/features/learning/course-session.tsx`
- Modify: `src/components/features/learning/detail-kursus.tsx`
- Modify: `src/app/(app)/belajar/[slug]/page.tsx`

**Interfaces:**
- Consumes: `mulaiSesiAction`, `catatKejadianAction`, `akhiriSesiAction` (Task 5); `putuskanAkses` (Task 2).
- Produces: `CourseSessionProvider`, `useCourseSession()`, `CourseSessionGate`, `CourseSessionIndicator`, `SessionKonteks`.

- [ ] **Step 1: Create `src/components/features/learning/course-session.tsx`**

Write the file with this exact public surface:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { mulaiSesiAction, catatKejadianAction, akhiriSesiAction } from "@/actions/learning";
import { putuskanAkses, type JenisKegiatan, type KeputusanAkses } from "@/lib/learning/akses";
import type { KebijakanCourse } from "@/types/course";

export interface SessionKonteks {
  courseId: string;
  kebijakan: KebijakanCourse;
  bukti: string | null;
  runId: string | null;
  status: "idle" | "menyiapkan" | "aktif" | "diakhiri" | "gagal";
  error: string | null;
  mulai: () => Promise<boolean>;
  akhiri: () => Promise<void>;
  boleh: (jenis: JenisKegiatan) => KeputusanAkses;
}

export const SessionContext = createContext<SessionKonteks | null>(null);

export function useCourseSession(): SessionKonteks {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useCourseSession dipakai di luar CourseSessionProvider");
  return ctx;
}

export function CourseSessionProvider({
  courseId,
  kebijakan,
  children,
}: {
  courseId: string;
  kebijakan: KebijakanCourse;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<SessionKonteks["status"]>("idle");
  const [bukti, setBukti] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<string | null>(null);

  const kirimKejadian = useCallback(
    (jenis: Parameters<typeof catatKejadianAction>[0]["jenis"], visibilitas: "visible" | "hidden" | null) => {
      const id = runRef.current;
      if (!id) return;
      // Fire-and-forget: kejadian tidak boleh memblokir UI peserta.
      void catatKejadianAction({ runId: id, jenis, visibilitas }).catch(() => undefined);
    },
    [],
  );

  const mulai = useCallback(async () => {
    setStatus("menyiapkan");
    setError(null);
    const hasil = await mulaiSesiAction(courseId);
    if (!hasil.ok || !hasil.bukti || !hasil.runId) {
      setStatus("gagal");
      setError(hasil.error ?? "Sesi gagal dimulai.");
      return false;
    }
    runRef.current = hasil.runId;
    setRunId(hasil.runId);
    setBukti(hasil.bukti);
    setStatus("aktif");
    return true;
  }, [courseId]);

  const akhiri = useCallback(async () => {
    const id = runRef.current;
    if (!id) return;
    await akhiriSesiAction(id, "peserta_akhiri").catch(() => undefined);
    runRef.current = null;
    setRunId(null);
    setBukti(null);
    setStatus("diakhiri");
  }, []);

  useEffect(() => {
    if (status !== "aktif") return;
    const padaVisibilitas = () => {
      if (document.hidden) kirimKejadian("pindah_tab", "hidden");
    };
    const padaFokusHilang = () => kirimKejadian("fokus_hilang", document.hidden ? "hidden" : "visible");
    document.addEventListener("visibilitychange", padaVisibilitas);
    window.addEventListener("blur", padaFokusHilang);
    return () => {
      document.removeEventListener("visibilitychange", padaVisibilitas);
      window.removeEventListener("blur", padaFokusHilang);
    };
  }, [status, kirimKejadian]);

  const boleh = useCallback(
    (jenis: JenisKegiatan) => putuskanAkses({ jenisKegiatan: jenis, kebijakan, adaBuktiSesi: Boolean(bukti) }),
    [kebijakan, bukti],
  );

  return (
    <SessionContext.Provider
      value={{ courseId, kebijakan, bukti, runId, status, error, mulai, akhiri, boleh }}
    >
      {children}
    </SessionContext.Provider>
  );
}

/** Gerbang pengerjaan: menampilkan tombol sesi alih-alih isi kegiatan. */
export function CourseSessionGate({ pesan }: { pesan: string }) {
  const { mulai, status, error } = useCourseSession();
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-900">{pesan}</p>
      <p className="mt-2 text-xs text-amber-800">
        Kamu perlu menyalakan kamera dan menyetujui pencatatan kejadian selama sesi. Tanpa
        itu, kegiatan ini tidak dihitung sebagai bukti kompetensi terverifikasi.
      </p>
      <button
        type="button"
        onClick={() => void mulai()}
        disabled={status === "menyiapkan"}
        className="mt-3 cursor-pointer rounded-full bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {status === "menyiapkan" ? "Menyiapkan sesi…" : "Mulai sesi terverifikasi"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

export function CourseSessionIndicator() {
  const { status, akhiri, kebijakan } = useCourseSession();
  if (status !== "aktif") return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
        <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
        Sesi terverifikasi aktif
      </span>
      <span className="text-xs text-emerald-700">
        Kamera dan pencatatan kejadian berjalan. Aturan bantuan: {kebijakan.aturan_bantuan}.
      </span>
      <a href="/pengaturan" className="text-xs font-medium text-emerald-900 underline">
        Cara kerja pencatatan
      </a>
      <button
        type="button"
        onClick={() => void akhiri()}
        className="ml-auto cursor-pointer text-xs font-semibold text-emerald-900 underline"
      >
        Akhiri sesi
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire the provider into `detail-kursus.tsx`**

Wrap the top-level returned JSX in `<CourseSessionProvider courseId={kursus.id} kebijakan={kebijakan}>` and accept a new `kebijakan` prop (added to the component's prop types). Render `<CourseSessionIndicator />` directly under the curriculum heading. Replace the "Buka materi" button handler so that:

```tsx
const keputusan = boleh("materi");
if (keputusan.tipe !== "bebas") {
  setPesanSesi(keputusan.pesan);
  return;
}
setModulTerbuka(terbuka ? null : m.id);
```

and render `<CourseSessionGate pesan={pesanSesi} />` in place of the module body when `pesanSesi` is set for that module. Keep `HalamanView` (free reading) always available — only the gated attachments sit behind the session.

- [ ] **Step 3: Pass policy from `page.tsx`**

In `src/app/(app)/belajar/[slug]/page.tsx`, import `kebijakanDefault` from `@/lib/courses/kebijakan`, then pass:

```tsx
kebijakan={kursusAsli?.kebijakan ?? kebijakanDefault()}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, then open `/belajar/fullstack-web-development-nextjs-15-react-19` as a logged-in, enrolled learner.
Expected: indicator absent initially; opening a quiz attachment shows the session gate; starting a session shows the active indicator; switching tabs while active adds a recorded event (check `.data/sessions/*.json`).

- [ ] **Step 5: Run checks and commit**

Run: `npm run check`
Expected: PASS.

```bash
git add src/components/features/learning/course-session.tsx src/components/features/learning/detail-kursus.tsx "src/app/(app)/belajar/[slug]/page.tsx"
git commit -m "feat(learning): provider sesi, indikator, dan gerbang pengerjaan di ruang belajar"
```

---

## Task 7: Admin policy + checkpoint editor

**Files:**
- Modify: `src/components/features/admin/courses/kursus-detail.tsx`
- Modify: `src/components/features/admin/courses/modul-editor.tsx`
- Modify: `src/lib/courses/store.ts` (`updateCourse` accepts `kebijakan`)

**Interfaces:**
- Consumes: `kebijakanDefault`, `LABEL_ATURAN_BANTUAN`, `LABEL_ATURAN_PENGAWASAN`, `MODE_CHECKPOINT_LABEL` (Task 1).
- Produces: `updateCourse(id, { kebijakan })` persists policy and bumps `versi`.

- [ ] **Step 1: Extend `updateCourse`**

In `src/lib/courses/store.ts`, inside `updateCourse`, when `input.kebijakan` is present set:

```ts
    kebijakan: {
      ...current.kebijakan ?? kebijakanDefault(),
      ...input.kebijakan,
      versi: (current.kebijakan?.versi ?? 0) + 1,
      aturan_pengawasan_sejak: new Date().toISOString(),
    },
```

Add `kebijakan?: CourseKebijakanInput` to `UpdateCourseInput` in `src/types/course.ts` (a `Partial<Pick<KebijakanCourse, "aturan_bantuan" | "aturan_pengawasan">>`).

- [ ] **Step 2: Add the policy form to `kursus-detail.tsx`**

Below the existing tabs, add a "Kebijakan asesmen" section with two `<select>` controls (aturan bantuan, aturan pengawasan) and a Save button that calls `updateCourseAction` with `kebijakan` fields plus `id`. Show the current `versi` as read-only text ("Versi kebijakan: N — naik otomatis saat disimpan").

- [ ] **Step 3: Add the checkpoint editor to `modul-editor.tsx`**

Per module row, add a collapsed "Checkpoint" panel with mode select and `batas_waktu_menit` number input, saved through `updateModulAction`. When mode is `kuis`, list the module's `kuis` materials as `ref` options; when `proyek`, allow a free-text task id.

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, sign in as `admin@careevo.test` / `careevo`, open `/admin/courses/<id>`, change `aturan_bantuan` to `tanpa_ai`, save, then reload `/belajar/<slug>`.
Expected: `versi` increments; the learner page reflects the new rule, and opening an attachment with a stale proof requires a fresh session.

- [ ] **Step 5: Run checks and commit**

Run: `npm run check` then `npm run build`
Expected: PASS both.

```bash
git add src/components/features/admin/courses/kursus-detail.tsx src/components/features/admin/courses/modul-editor.tsx src/lib/courses/store.ts src/types/course.ts
git commit -m "feat(admin): editor kebijakan asesmen dan checkpoint modul"
```

---

## Task 8: Integrity-event panel + reporting

**Files:**
- Create: `src/components/features/learning/kejadian-panel.tsx`
- Modify: `src/components/features/learning/detail-kursus.tsx`

**Interfaces:**
- Consumes: `useCourseSession` (Task 6).
- Produces: `KejadianPanel`, and a "Laporkan gangguan" action that calls `catatKejadianAction` with `jenis: "kamera_gagal"`.

- [ ] **Step 1: Create `kejadian-panel.tsx`**

Render:
- Count of `kejadian` vs `celah` for the active run (fetched from the last `catatKejadianAction` response stored in provider state, or from a new read-only server action `ambilKejadianAction(runId)`).
- A plain-language explainer: *"Pindah tab dan kamera terputus dicatat untuk konteks. Kejadian ini tidak otomatis menggagalkan penilaian dan tidak mengurangi reputasimu."*
- Cameras-controls: a "Laporkan gangguan" button, a "Coba nyalakan ulang kamera" stub that re-requests `getUserMedia` and records `kamera_mulai`/`kamera_gagal`, and a link to `/pengaturan`.

- [ ] **Step 2: Mount the panel in the learning room**

Show it only while `status === "aktif"` (or when there is at least one `celah`), directly under the indicator.

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, start a session, switch tabs twice, then open the panel.
Expected: two `pindah_tab` entries; wording does not accuse; "Laporkan gangguan" appends a `celah` entry.

- [ ] **Step 4: Commit**

```bash
git add src/components/features/learning/kejadian-panel.tsx src/components/features/learning/detail-kursus.tsx
git commit -m "feat(learning): panel kejadian integritas dengan pelaporan gangguan"
```

---

## Task 9: Privacy copy alignment

**Files:**
- Modify: `src/components/features/settings/settings-form.tsx`
- Modify: `src/components/features/marketing/faq.tsx` (only if it claims "nir-biometrik / tanpa webcam")

**Interfaces:**
- Consumes: nothing.
- Produces: copy that states camera/event recording happens in verified sessions, what is and is not recorded, and how to object.

- [ ] **Step 1: Update the consent copy**

Replace "Nir-biometrik: tanpa webcam, tanpa rekam ketukan…" with copy stating: kamera aktif hanya selama sesi terverifikasi yang kamu setujui; pencatatan terbatas pada kejadian sesi (pindah tab, status kamera, koneksi); tidak ada rekaman tuts, tidak ada geolokasi, tidak ada deteksi identitas; bukti hanya dilihat peserta dan staf berwenang; ada jalur keberatan via pengaturan.

- [ ] **Step 2: Sweep conflicting claims**

Run: `rg -n "nir-biometrik|tanpa webcam|tanpa kamera" src docs`
Expected: no remaining claim that contradicts the new behavior. Update each hit.

- [ ] **Step 3: Run checks and commit**

Run: `npm run check`
Expected: PASS.

```bash
git add src/components/features/settings/settings-form.tsx src/components/features/marketing/faq.tsx
git commit -m "docs(learning): selaraskan copy privasi dengan sesi terverifikasi"
```

---

## Task 10: Security static checks + smoke routes

**Files:**
- Create: `src/lib/learning/security.test.ts`
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: nothing at runtime; scans source text.
- Produces: regression test preventing answer-key leaks and missing gates.

- [ ] **Step 1: Write the failing test**

Create `src/lib/learning/security.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");

function berkasDi(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const p = path.join(dir, nama);
    if (statSync(p).isDirectory()) hasil.push(...berkasDi(p));
    else if (/\.(ts|tsx)$/.test(nama)) hasil.push(p);
  }
  return hasil;
}

describe("keamanan jalur ujian", () => {
  it("tidak mengirim kunci jawaban dari server actions", () => {
    const berkas = [path.join(ROOT, "src/actions/learning.ts")];
    for (const f of berkas) {
      expect(readFileSync(f, "utf8")).not.toContain("jawaban_benar");
    }
  });

  it("setiap server action sesi memeriksa getSession", () => {
    const isi = readFileSync(path.join(ROOT, "src/actions/learning.ts"), "utf8");
    const jumlahGate = (isi.match(/await getSession\(\)/g) ?? []).length;
    expect(jumlahGate).toBeGreaterThanOrEqual(4);
  });

  it("endpoint kejadian tidak mempercayai owner dari klien", () => {
    const isi = readFileSync(path.join(ROOT, "src/actions/learning.ts"), "utf8");
    expect(isi).toContain("run.owner !== session.email");
  });
});
```

- [ ] **Step 2: Run test to verify it fails/passes meaningfully**

Run: `npx vitest run src/lib/learning/security.test.ts`
Expected: PASS (these guard code written in earlier tasks). If the first assertion fails, remove the leak before continuing.

- [ ] **Step 3: Extend `scripts/smoke.mjs`**

Append to the `routes` array:

```js
  "/ujian",
  "/ujian/demo",
```

- [ ] **Step 4: Run the full gate**

Run: `npm run check` then `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/learning/security.test.ts scripts/smoke.mjs
git commit -m "test(learning): pemeriksaan statis keamanan sesi + route smoke"
```

---

## Self-Review Notes

- **Spec coverage:** CourseRun (T3), session proof (T3/T5), policy vocabulary (T1), access engine (T2), session gate in UI (T6), admin policy + checkpoint editor (T7), integrity events (T3/T5/T8), privacy copy (T9), security regression (T10). The spec's non-goals (camera execution, companion extension, AI-text detection, VTS reuse) have no tasks, as intended.
- **Package boundary:** the spec describes packages A–E; this plan implements only package C. Packages A/B/D/E remain future work and are called out in the spec.
- **Type consistency:** `KebijakanCourse`, `CheckpointMateri`, `KeputusanAkses`, `SessionRun`, `SesiActionState` are defined once and reused with identical field names across tasks. `mulaiSesiAction`, `catatKejadianAction`, `selesaikanMateriAction`, `akhiriSesiAction`, `buktiBaru`, `verifikasiBuktiSesi`, `buktikanSesi`, `checkpointEfektif`, `putuskanAkses` keep the same signatures where reused.
- **Known risk:** Task 6's provider currently passes `bukti` only to actions called from that component; extending the existing `tandaiModulAction` in `src/actions/enrollment.ts` to also require proof is deferred to keep this plan small. Until then, "Tandai selesai" remains a purely informal progress marker (documented in the spec) and must not be treated as verified evidence.
