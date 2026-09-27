# Materi Reader + Drawer Tutor AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pisahkan halaman kursus menjadi **silabus** dan **reader per modul** (`/belajar/[slug]/materi/[modulId]`), lalu tambahkan **drawer tutor AI** di sisi kanan reader yang memakai ulang aplikasi AI Mastery lewat rute chromeless — bukan chat baru.

**Architecture:** Reader adalah shell fokus (`(focus)`, tanpa navbar) yang tinggal di `layout.tsx` supaya rail, provider sesi, dan iframe tutor **bertahan** saat berpindah modul. `CourseSessionProvider` di-seed dari server (`ambilRunAktif` + `buktiBaru`) sehingga muat ulang dan deep link tidak kehilangan sesi terverifikasi. Drawer meniru "reading companion" DeepTutor: dock + resize di `xl`, sheet + scrim di bawahnya, dan **tidak pernah di-unmount** karena state percakapan hidup di dalam iframe.

**Tech Stack:** Next.js 16 App Router (Server Actions), React 19, TypeScript 5 (`strict: true`, tanpa `noUncheckedIndexedAccess`), Vitest 5 (node env, tanpa jsdom), Drizzle ORM + PostgreSQL 18, Tailwind v4. Pohon vendored `features/sijago/` punya gate sendiri.

**Spec:** `docs/superpowers/specs/2026-09-30-materi-reader-design.md` — §3.1 (route + shell), §3.2 (kontinuitas sesi), §3.3 (isi + gerbang), §3.4 (penyelesaian), §3.5 (silabus), §3.6 (revalidasi), §3.7 (drawer).

---

## Global Constraints

- **Copy berbahasa Indonesia** (`id`); `<html lang>` tetap `id`. Identifier yang sudah Bahasa Indonesia (`modulUntukSumber`, `boleh`, `buktiBaru`, `hitungProgres`) tidak diterjemahkan; kode infra/UI tetap Inggris.
- **Mesin akses tidak disentuh.** `putuskanAkses`, `wajibSesiTerverifikasi`, `checkpointEfektif`, `checkpointTerverifikasi`, dan pesan `PESAN_POLICY` **tidak diubah** oleh plan ini. Gerbang reader memakai keputusan yang sama, bukan salinannya.
- **Tidak ada aturan AI per modul.** `aturan_bantuan` tetap milik `KebijakanCourse`. `CheckpointMateri` tidak ditambah field. `putuskanAkses` tetap tidak membaca modul.
- **Tidak ada chat baru di Careevo.** Drawer memakai AI Mastery lewat iframe. `getLlm()` tidak dipakai untuk chat. (Skill `careevo-sijago`: *"do not rebuild one."*)
- **Drawer tidak pernah di-unmount.** Disembunyikan dengan CSS. Melepas iframe memutus WebSocket dan membuang percakapan.
- **Satu helper progres.** Jangan menulis loop `modulUntukSumber` + `hitungProgres` sendiri di halaman baru; pakai resolver tunggal.
- **Server-only:** `modul-resolver.ts`, `run-service.ts`, `session.ts` (versi berkas), `repository.ts` **tidak boleh** diimpor dari komponen klien. `course-session.tsx`, `halaman-view.tsx`, `materi-view.tsx`, `kuis-view.tsx` adalah klien.
- **`kursus.ts`/`kurikulum.ts`/`kebijakan.ts` tetap murni** — jangan tambah impor `node:fs` di sana.
- **Test:** suffix `.integration.test.ts` untuk yang butuh DB; `npm test` harus tetap hijau tanpa PostgreSQL. Test unit komponen memakai `renderToStaticMarkup` + `createElement` (tanpa JSX, karena `vitest.config.mts` hanya menyertakan `src/**/*.test.ts`).
- **Pohon vendored `features/sijago/`:** gate sendiri — `npm run typecheck && npm run test:unit && npm run i18n:check && npm run contracts:check && npm run build`. **Jangan** sentuh `vendor/` dan `contracts/` (`contracts:check` gagal). Jangan rename path/identifier lowercase `deeptutor`. `:3790` menyajikan `.next/standalone` — **build ulang DAN restart**.
- **Gate per task:** `npm run check` (typecheck → lint → skills:check → test). Task yang menyentuh `src/app` atau komponen klien juga `npm run build`.
- **Route baru/pindah:** jalankan `npx next typegen`.
- **Commit lokal saja, jangan `push`** tanpa izin eksplisit.
- **Jangan edit/hapus `drizzle/00NN_*.sql`** yang sudah dipakai. Plan ini tidak menambah migrasi.

---

## File Structure

**Baru (Careevo):**

| Berkas | Tanggung jawab |
|---|---|
| `src/lib/learning/tutor-ai.ts` (modify) | Tambah `urlFrameTutorEmbed` — URL rute embed, murni, teruji |
| `src/lib/learning/reader-sesi.ts` | Seed sesi server: cari run aktif → bukti. Server-only |
| `src/components/features/learning/materi-rail.tsx` | Daftar seluruh modul + sub-item, tanda centang |
| `src/components/features/learning/materi-focus-bar.tsx` | Bar fokus: kembali, judul, pil sesi, tombol tutor, selesai |
| `src/components/features/learning/tutor-drawer.tsx` | Drawer kanan: toggle, dock/sheet, resize, persist lebar, iframe |
| `src/components/features/learning/materi-pane.tsx` | Isi satu modul: halaman → lampiran → kuis (masing-masing bergerbang) |
| `src/app/(focus)/belajar/[slug]/materi/layout.tsx` | Shell reader: rail + bar + drawer + provider sesi |
| `src/app/(focus)/belajar/[slug]/materi/[modulId]/page.tsx` | Hanya pane modul |

**Baru (vendored):**

| Berkas | Tanggung jawab |
|---|---|
| `features/sijago/app/embed/chat/page.tsx` | Rute chromeless: provider chat tanpa `AppShell`/sidebar |

**Diubah:**

| Berkas | Perubahan |
|---|---|
| `src/components/features/learning/course-session.tsx` | Prop opsional `buktiAwal`/`runIdAwal`/`kejadianAwal` |
| `src/components/features/learning/detail-kursus.tsx` | Jadi silabus; buang akordeon + impor mati |
| `src/components/features/learning/kursus-subnav.tsx` | CTA ke URL reader, bukan `#kurikulum` |
| `src/actions/learning.ts` | `safeRevalidate` route reader |
| `src/actions/enrollment.ts` | `safeRevalidate` route reader |
| `scripts/smoke.mjs` | Tambah route reader ke array `routes` |

---

# BAGIAN A — Fondasi murni (tanpa UI)

> Tiga task pertama menghasilkan unit teruji tanpa menyentuh tampilan. Urutannya penting: Task 3 (seed sesi) dipakai Task 5–7.

## Task 1: `urlFrameTutorEmbed` — URL rute embed

**Files:**
- Modify: `src/lib/learning/tutor-ai.ts` (tambah fungsi + konstanta; jangan ubah yang ada)
- Test: `src/lib/learning/tutor-ai.test.ts` (tambah `describe`)

**Interfaces:**
- Consumes: `KAPABILITAS_COURSE_STUDY` (sudah ada, `tutor-ai.ts:25`).
- Produces: `urlFrameTutorEmbed(baseUrl: string, query: { course?: string | null; capability?: string | null }): string` — mengembalikan `${baseUrl}/embed/chat?course=…&capability=…`, atau `${baseUrl}/embed/chat` bila tidak ada query. Melempar bila `baseUrl` bukan URL.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `src/lib/learning/tutor-ai.test.ts`:

```ts
describe("urlFrameTutorEmbed", () => {
  const DASAR = "http://localhost:3790";

  it("menempelkan path embed dan query course", () => {
    const out = urlFrameTutorEmbed(DASAR, { course: "r2", capability: "course_study" });
    expect(out).toBe("http://localhost:3790/embed/chat?course=r2&capability=course_study");
  });

  it("tanpa query tetap mengembalikan path embed, bukan baseUrl polos", () => {
    // Berbeda dari `urlFrameAiMastery`, yang mengembalikan `baseUrl` apa adanya.
    // Di sini path-nya sendiri yang penting: `/embed/chat` adalah rutenya.
    expect(urlFrameTutorEmbed(DASAR, {})).toBe("http://localhost:3790/embed/chat");
    expect(urlFrameTutorEmbed(DASAR, { course: "", capability: "" })).toBe(
      "http://localhost:3790/embed/chat",
    );
  });

  it("meng-encode id kursus yang memuat `&`", () => {
    // `courses.id` adalah kolom `text`, bukan uuid: `a&b` mentah akan terpecah
    // jadi dua parameter dan kursus yang tiba bukan kursus yang diklik.
    const out = urlFrameTutorEmbed(DASAR, { course: "a&b" });
    expect(out).toContain("course=a%26b");
    expect(new URL(out).searchParams.get("course")).toBe("a&b");
  });

  it("base URL tidak valid dilempar, bukan jadi frame rusak", () => {
    expect(() => urlFrameTutorEmbed("not a url", { course: "r2" })).toThrow();
  });
});
```

Tambahkan `urlFrameTutorEmbed` ke daftar impor di kepala berkas itu (bersama `urlFrameAiMastery`).

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npx vitest run src/lib/learning/tutor-ai.test.ts -t "urlFrameTutorEmbed"`
Expected: FAIL — `urlFrameTutorEmbed is not a function` (atau error impor).

- [ ] **Step 3: Implementasi minimal**

Tambahkan di `src/lib/learning/tutor-ai.ts`, **setelah** `urlFrameAiMastery`:

```ts
/** Path rute chromeless AI Mastery yang dipakai drawer tutor. */
const RUTE_EMBED_TUTOR = "/embed/chat";

/**
 * URL rute embed AI Mastery untuk drawer tutor.
 *
 * Berbeda dari `urlFrameAiMastery` yang mengembalikan `baseUrl` apa adanya saat
 * tidak ada query, di sini **path-nya sendiri** yang bermakna: `/embed/chat`
 * adalah rute chromeless yang tidak mewarisi `AppShell`/sidebar. Karena itu
 * `baseUrl` polos tidak pernah menjadi hasil yang benar.
 *
 * Id kursus di-encode dengan alasan yang sama seperti `tautanTutorAi`:
 * `courses.id` adalah `text`, jadi ia boleh memuat `&` — menempelkannya mentah
 * memecah query dan kursus yang tiba bukan kursus yang diklik.
 *
 * `baseUrl` tidak valid dilempar (`new URL` melempar), mengikuti
 * `urlFrameAiMastery`: salah konfigurasi harus gagal saat render, bukan memuat
 * frame yang diam-diam kosong.
 */
export function urlFrameTutorEmbed(
  baseUrl: string,
  query: { course?: string | null; capability?: string | null },
): string {
  const course = query.course?.trim();
  const capability = query.capability?.trim();

  const url = new URL(RUTE_EMBED_TUTOR, baseUrl);
  if (course) url.searchParams.set("course", course);
  if (capability) url.searchParams.set("capability", capability);
  return url.toString();
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npx vitest run src/lib/learning/tutor-ai.test.ts`
Expected: PASS — seluruh `describe` di berkas itu hijau.

- [ ] **Step 5: Mutation check**

Ubah sementara `if (course)` menjadi `if (false)`, jalankan test lagi, pastikan test "menempelkan path embed dan query course" **merah**. Kembalikan. Test yang tidak bisa dibuat merah tidak menutup logikanya.

- [ ] **Step 6: Commit**

```bash
git add src/lib/learning/tutor-ai.ts src/lib/learning/tutor-ai.test.ts
git commit -m "feat(tutor): URL rute embed chromeless untuk drawer"
```

---

## Task 2: `reader-sesi.ts` — seed sesi terverifikasi dari server

**Files:**
- Create: `src/lib/learning/reader-sesi.ts`
- Test: `src/lib/learning/reader-sesi.test.ts`

**Interfaces:**
- Consumes: `ambilRunAktif(userId: string, courseId: string): Promise<LearningRun | null>` (`repository.ts:336`), `kedaluwarsaDb(run, now?)` (`run-service.ts:81`), `buktiBaru(input: BuktiSesi): string` + `BuktiSesi { courseId; owner; policyVersion }` (`session.ts:119`/`61`), `pemilikBukti` bukan ekspor — pakai `userId.trim().toLowerCase()`.
- Produces: `sesiReaderAwal(input: { userId: string; courseId: string; policyVersion: number }): Promise<{ bukti: string; runId: string; mulaiAt: string } | null>`

**Kontrak yang harus dipatuhi:** mengembalikan `null` (gagal-tertutup) bila run tidak ada, tidak `active`, atau sudah kedaluwarsa. Jangan pernah menandatangani bukti untuk run yang tidak sah.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/learning/reader-sesi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Seed sesi reader — diuji dengan service-nya di-mock.
 *
 * Yang dikunci di sini adalah **fail-closed**: run yang kedaluwarsa atau tidak
 * aktif tidak boleh menghasilkan bukti. Kalau reader menandatangani bukti untuk
 * run mati, gerbang sesi di UI terbuka padahal server akan menolak
 * penyelesaiannya — peserta melihat modul yang "bisa diselesaikan" lalu ditolak.
 */

const mocks = vi.hoisted(() => ({
  ambilRunAktif: vi.fn(),
  kedaluwarsaDb: vi.fn(),
}));

vi.mock("./repository", () => ({ ambilRunAktif: mocks.ambilRunAktif }));
vi.mock("./run-service", () => ({ kedaluwarsaDb: mocks.kedaluwarsaDb }));

import { sesiReaderAwal } from "./reader-sesi";

function run(over: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    userId: "u-1",
    courseId: "crs-1",
    integrityVersion: 1,
    state: "active",
    startedAt: new Date("2026-09-30T00:00:00.000Z"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = "test-secret-yang-cukup-panjang-untuk-hmac";
});

describe("sesiReaderAwal", () => {
  it("mengembalikan bukti + runId untuk run aktif yang belum kedaluwarsa", async () => {
    mocks.ambilRunAktif.mockResolvedValue(run());
    mocks.kedaluwarsaDb.mockReturnValue(false);

    const hasil = await sesiReaderAwal({ userId: "u-1", courseId: "crs-1", policyVersion: 1 });

    expect(hasil).not.toBeNull();
    expect(hasil?.runId).toBe("run-1");
    // Bukti harus token bertanda tangan, bukan string kosong.
    expect(hasil?.bukti).toContain(".");
    expect(hasil?.mulaiAt).toBe("2026-09-30T00:00:00.000Z");
  });

  it("mengembalikan null saat tidak ada run aktif", async () => {
    mocks.ambilRunAktif.mockResolvedValue(null);
    expect(await sesiReaderAwal({ userId: "u-1", courseId: "crs-1", policyVersion: 1 })).toBeNull();
    // Run yang tidak ada tidak boleh diuji kedaluwarsanya.
    expect(mocks.kedaluwarsaDb).not.toHaveBeenCalled();
  });

  it("mengembalikan null saat run sudah kedaluwarsa", async () => {
    mocks.ambilRunAktif.mockResolvedValue(run());
    mocks.kedaluwarsaDb.mockReturnValue(true);
    expect(await sesiReaderAwal({ userId: "u-1", courseId: "crs-1", policyVersion: 1 })).toBeNull();
  });

  it("mengembalikan null saat policyVersion run berbeda dari kebijakan sekarang", async () => {
    // Kebijakan yang naik versi membatalkan bukti lama. Menandatangani ulang
    // dengan versi baru untuk run versi lama akan membuat server menolaknya
    // (`buktikanSesiDb` membandingkan `integrityVersion`), jadi lebih baik
    // jujur tidak ada sesi.
    mocks.ambilRunAktif.mockResolvedValue(run({ integrityVersion: 1 }));
    mocks.kedaluwarsaDb.mockReturnValue(false);
    expect(await sesiReaderAwal({ userId: "u-1", courseId: "crs-1", policyVersion: 2 })).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npx vitest run src/lib/learning/reader-sesi.test.ts`
Expected: FAIL — `Cannot find module './reader-sesi'`.

- [ ] **Step 3: Implementasi minimal**

Buat `src/lib/learning/reader-sesi.ts`:

```ts
import { ambilRunAktif } from "./repository";
import { kedaluwarsaDb } from "./run-service";
import { buktiBaru } from "./session";

/**
 * Bukti sesi yang di-seed ke reader dari **server**.
 *
 * `CourseSessionProvider` menyimpan `bukti`/`runId` di state React, dan provider
 * itu hidup di dalam shell reader. Selama navigasi **di dalam** reader provider
 * tidak pernah di-unmount, jadi state-nya bertahan sendiri. Yang tidak bisa
 * ditutup dengan cara itu adalah **muat ulang halaman** dan **deep link langsung**
 * ke satu modul: di sana tidak ada state klien yang bisa diwarisi, dan peserta
 * yang sedang di tengah sesi akan melihat gerbang menutup lagi padahal sesinya
 * masih berjalan.
 *
 * Fungsi ini menutup celah itu. Ia bekerja karena `buktiBaru` adalah tanda
 * tangan murni atas `(courseId, owner, policyVersion)` — **bukan token acak** —
 * sehingga server bisa menurunkan ulang tanda tangan yang identik dengan yang
 * dikeluarkan `mulaiSesiAction`, tanpa memulai sesi baru.
 *
 * Fail-closed di setiap cabang: tanpa run aktif, tanpa run yang sah, atau saat
 * versi kebijakan sudah bergeser, hasilnya `null` dan UI menampilkan gerbang
 * biasa. Menandatangani bukti untuk run yang tidak sah justru lebih buruk
 * daripada tidak ada sesi: peserta melihat modul yang tampak bisa diselesaikan,
 * lalu ditolak server saat menekan "Tandai selesai".
 *
 * `owner` di dalam token adalah `users.id` yang di-lowercase — definisi yang
 * sama dengan `pemilikBukti` di `run-service.ts:69`, yang tidak diekspor. Dua
 * tempat memakai aturan yang sama; kalau salah satunya berubah, keduanya harus
 * berubah.
 */
export async function sesiReaderAwal(input: {
  userId: string;
  courseId: string;
  policyVersion: number;
}): Promise<{ bukti: string; runId: string; mulaiAt: string } | null> {
  const run = await ambilRunAktif(input.userId, input.courseId);
  if (!run) return null;

  // Kedaluwarsa diperiksa **sebelum** menandatangani, dan run yang lewat batas
  // tidak ditutup di sini: penutupan adalah urusan service sesi, dan reader
  // tidak boleh menulis status run sebagai efek samping render.
  if (kedaluwarsaDb(run)) return null;

  // Versi kebijakan yang berbeda berarti bukti lama tidak berlaku lagi
  // (`buktikanSesiDb` membandingkan `integrityVersion`). Menandatangani dengan
  // versi baru untuk run versi lama hanya menghasilkan token yang pasti ditolak.
  if (run.integrityVersion !== input.policyVersion) return null;

  const bukti = buktiBaru({
    courseId: input.courseId,
    owner: input.userId.trim().toLowerCase(),
    policyVersion: input.policyVersion,
  });

  return { bukti, runId: run.id, mulaiAt: run.startedAt.toISOString() };
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npx vitest run src/lib/learning/reader-sesi.test.ts`
Expected: PASS — 4 test hijau.

- [ ] **Step 5: Mutation check**

Ubah sementara `if (kedaluwarsaDb(run)) return null;` menjadi `if (false) return null;` dan `if (run.integrityVersion !== input.policyVersion) return null;` menjadi `if (false) return null;`. Jalankan test; dua test yang relevan harus **merah**. Kembalikan.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Kalau `run.startedAt` bukan `Date`, baca `schema.ts:1205` dan sesuaikan (kolom `timestamptz` → `Date`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/learning/reader-sesi.ts src/lib/learning/reader-sesi.test.ts
git commit -m "feat(reader): seed bukti sesi dari run aktif di server"
```

---

## Task 3: `CourseSessionProvider` menerima bukti awal

**Files:**
- Modify: `src/components/features/learning/course-session.tsx:155-176` (signature + `useState` awal)
- Test: `src/components/features/learning/course-session.test.ts` (baru)

**Interfaces:**
- Consumes: `SessionKonteks`, `KejadianSesi` (sudah ada di berkas yang sama).
- Produces: `CourseSessionProvider` menerima prop opsional tambahan:
  - `buktiAwal?: string | null`
  - `runIdAwal?: string | null`
  - `kejadianAwal?: KejadianSesi[]`
  Tanpa prop ini perilakunya **persis** seperti sebelumnya.

**Kenapa prop, bukan baca sendiri:** provider ini klien; ia tidak boleh menyentuh `repository.ts`/`run-service.ts` (server-only). Server yang menurunkan bukti (Task 2), provider hanya menerimanya.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/components/features/learning/course-session.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseSessionProvider, CourseSessionPrompt } from "./course-session";
import { kebijakanDefault } from "@/lib/courses/kebijakan";

/**
 * Seed provider — diuji lewat HTML yang benar-benar dihasilkan.
 *
 * Yang dibuktikan: bukti yang di-seed membuat gerbang `wajib` **terbuka** di
 * render pertama, tanpa menekan tombol "Mulai sesi". Itu inti Task 3: peserta
 * yang memuat ulang halaman di tengah sesi tidak dipaksa memulai sesi kedua.
 *
 * `CourseSessionPrompt` dipakai sebagai pengintai karena ia satu-satunya
 * komponen yang tampil **hanya** saat status bukan `aktif`
 * (`course-session.tsx:503`). Kalau bukti awal diterima, ia hilang dari HTML.
 */

function render(props: { buktiAwal?: string | null; runIdAwal?: string | null }) {
  // Props disusun sebagai satu objek, lalu `children` dioper lewat properti —
  // **bukan** sebagai argumen ketiga `createElement`. Di React 19 types,
  // `children` adalah properti wajib `CourseSessionProvider`, dan
  // `createElement(Comp, props, child)` gagal `npm run typecheck` dengan
  // TS2769 "Property 'children' is missing". Objek literal inline juga ditolak
  // `eslint react/no-children-prop`, jadi variabel perantara ini memang perlu.
  const isi = { ...props, children: createElement(CourseSessionPrompt) };
  return renderToStaticMarkup(
    createElement(
      CourseSessionProvider,
      { courseId: "crs-1", kebijakan: kebijakanDefault(), ...isi },
    ),
  );
}

describe("CourseSessionProvider — seed awal", () => {
  it("tanpa bukti awal, gerbang `wajib` tetap tampil", () => {
    expect(render({})).toContain("Mulai sesi terverifikasi");
  });

  it("dengan bukti awal, gerbang tidak tampil", () => {
    // `kebijakanDefault()` adalah `wajib`, jadi inilah jalur yang penting.
    const html = render({ buktiAwal: "token.abc", runIdAwal: "run-1" });
    expect(html).not.toContain("Mulai sesi terverifikasi");
  });

  it("bukti awal kosong diperlakukan sebagai tidak ada sesi", () => {
    expect(render({ buktiAwal: "" })).toContain("Mulai sesi terverifikasi");
    expect(render({ buktiAwal: null })).toContain("Mulai sesi terverifikasi");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npx vitest run src/components/features/learning/course-session.test.ts`
Expected: FAIL pada test kedua — HTML masih memuat "Mulai sesi terverifikasi", karena `buktiAwal` belum dibaca.

- [ ] **Step 3: Implementasi**

Di `src/components/features/learning/course-session.tsx`, ganti blok signature + state awal:

```ts
export function CourseSessionProvider({
  courseId,
  kebijakan,
  buktiAwal = null,
  runIdAwal = null,
  kejadianAwal,
  children,
}: {
  courseId: string;
  kebijakan: KebijakanCourse;
  /**
   * Bukti sesi yang sudah sah, dihitung **server** (`reader-sesi.ts`).
   *
   * Dipakai reader: peserta yang memuat ulang halaman atau membuka deep link ke
   * satu modul tidak kehilangan sesi terverifikasi yang masih berjalan. Provider
   * tidak menghitungnya sendiri karena ia klien, dan service sesi server-only.
   *
   * `null` berarti "tidak ada sesi" — sama seperti perilaku lama.
   */
  buktiAwal?: string | null;
  /** Id run aktif pasangan `buktiAwal`; hanya dipakai untuk indikator. */
  runIdAwal?: string | null;
  /** Kejadian yang sudah tercatat di run itu, supaya panel tidak mulai kosong. */
  kejadianAwal?: KejadianSesi[];
  children: React.ReactNode;
}) {
  /**
   * Status awal mengikuti ada/tidaknya bukti seed.
   *
   * Bukti kosong (`""`) diperlakukan sebagai tidak ada: `putuskanAkses` memakai
   * `Boolean(bukti)`, dan status `aktif` untuk token kosong akan menampilkan
   * indikator sesi yang tidak bisa dipertanggungjawabkan server.
   */
  const adaBuktiAwal = Boolean(buktiAwal);
  const [status, setStatus] = useState<SessionKonteks["status"]>(
    adaBuktiAwal ? "aktif" : "idle",
  );
  const [bukti, setBukti] = useState<string | null>(buktiAwal ?? null);
  const [runId, setRunId] = useState<string | null>(runIdAwal ?? null);
  const [error, setError] = useState<string | null>(null);
  const [kejadian, setKejadian] = useState<KejadianSesi[]>(kejadianAwal ?? []);
```

Lalu, tepat **setelah** deklarasi `runRef`, tambahkan sinkronisasi ref dengan nilai seed — tanpa ini listener kejadian membaca `runRef.current === null` dan tidak mencatat apa pun:

```ts
  /**
   * Cermin `runId` yang bisa dibaca sinkron.
   *
   * Diinisialisasi dari `runIdAwal`: listener kejadian hidup di luar siklus
   * render dan membaca ref ini, bukan state. Kalau ref dibiarkan `null` pada
   * render pertama, sesi hasil seed akan **berjalan tanpa mencatat kejadian**
   * sampai peserta memulai sesi baru — celah integritas, bukan sekadar bug UI.
   */
  const runRef = useRef<string | null>(runIdAwal ?? null);
```

(Pada berkas aslinya `runRef` dideklarasikan dengan `useRef<string | null>(null)` di `course-session.tsx:181`; ganti baris itu, jangan tambah deklarasi kedua.)

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npx vitest run src/components/features/learning/course-session.test.ts`
Expected: PASS — 3 test hijau.

- [ ] **Step 5: Pastikan tidak ada regresi**

Run: `npx vitest run src/components/features/learning src/actions/learning.test.ts`
Expected: PASS. Pemanggil lama (`detail-kursus.tsx`) tidak mengirim prop baru, jadi perilakunya harus tetap identik.

- [ ] **Step 6: Commit**

```bash
git add src/components/features/learning/course-session.tsx src/components/features/learning/course-session.test.ts
git commit -m "feat(sesi): provider menerima bukti awal dari server"
```

---

# BAGIAN B — Reader

> Task 4–7 membangun reader. Task 8 menutup loop ke silabus. Setiap task menghasilkan halaman yang bisa dibuka.

## Task 4: `materi-rail.tsx` — daftar seluruh modul

**Files:**
- Create: `src/components/features/learning/materi-rail.tsx`
- Test: `src/components/features/learning/materi-rail.test.ts`

**Interfaces:**
- Consumes: `ModulKursus` (`@/lib/courses/kurikulum`), `cn` (`@/lib/utils`).
- Produces: `MateriRail({ slug, modul, modulAktif, selesai }: { slug: string; modul: ModulKursus[]; modulAktif: string; selesai: string[] })`.

**Aturan:** rail memuat **setiap** modul, termasuk yang tidak aktif. Sub-item dihitung dari `m.halaman`/`m.materi`/`m.kuis` (opsional — modul turunan kosong). Tautan memakai `<Link href={`/belajar/${slug}/materi/${m.id}`}>`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/components/features/learning/materi-rail.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MateriRail } from "./materi-rail";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Rail — diuji lewat HTML hasil render.
 *
 * Yang dikunci: rail memuat **semua** modul (bukan hanya yang aktif), dan tiap
 * baris menautkan ke URL reader modulnya. Kalau hanya modul aktif yang dirender,
 * peta kemajuan yang menetap — alasan reader ini ada — hilang.
 */

function modul(over: Partial<ModulKursus> & { id: string; judul: string }): ModulKursus {
  return { ringkasan: "ringkasan", durasi_min: 10, url: "https://contoh.test", ...over };
}

const KURIKULUM: ModulKursus[] = [
  modul({ id: "crs-1-m1", judul: "Orientasi" }),
  modul({
    id: "crs-1-m2",
    judul: "Mendalami React",
    halaman: [
      {
        id: "hal-1",
        modul_id: "crs-1-m2",
        course_id: "crs-1",
        judul: "Pengantar",
        urutan: 1,
        blok: [],
        created_at: "",
        updated_at: "",
      },
    ],
    kuis: [
      {
        id: "k-1",
        judul: "Kuis React",
        deskripsi: "Uji pemahaman React.",
        soal: [],
        nilai_lulus: 70,
        created_at: "",
        updated_at: "",
      },
    ],
  }),
  modul({ id: "crs-1-m3", judul: "Penutup" }),
];

function render(modulAktif = "crs-1-m1", selesai: string[] = []) {
  return renderToStaticMarkup(
    createElement(MateriRail, { slug: "kursus-uji", modul: KURIKULUM, modulAktif, selesai }),
  );
}

describe("MateriRail", () => {
  it("memuat setiap modul, bukan hanya yang aktif", () => {
    const html = render();
    expect(html).toContain("Orientasi");
    expect(html).toContain("Mendalami React");
    expect(html).toContain("Penutup");
  });

  it("menautkan tiap modul ke URL reader-nya", () => {
    const html = render();
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m1"');
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m2"');
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m3"');
  });

  it("menandai modul yang sedang dibuka dengan aria-current", () => {
    const html = render("crs-1-m2");
    // `aria-current="page"` hanya pada satu baris — yang aktif.
    expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1);
  });

  it("menandai modul yang sudah selesai", () => {
    const html = render("crs-1-m1", ["crs-1-m1"]);
    expect(html).toContain("Selesai");
  });

  it("menghitung sub-item per modul", () => {
    const html = render();
    // Modul 2 punya 1 halaman + 1 kuis; modul 1 dan 3 tidak punya isi.
    expect(html).toContain("1 halaman");
    expect(html).toContain("1 kuis");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npx vitest run src/components/features/learning/materi-rail.test.ts`
Expected: FAIL — `Cannot find module './materi-rail'`.

- [ ] **Step 3: Implementasi**

Buat `src/components/features/learning/materi-rail.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Daftar seluruh modul kursus — "outline yang menetap" milik reader.
 *
 * Ini yang membedakan reader dari akordeon lama: saat membaca, peta kemajuan
 * tetap terlihat, dan berpindah modul tidak perlu kembali ke silabus. Karena itu
 * rail memuat **semua** modul, bukan hanya yang sedang dibuka.
 *
 * Modul turunan (tanpa `halaman`/`materi`/`kuis`) tetap tampil sebagai baris
 * tanpa sub-item; ia bukan modul rusak, hanya modul yang isinya tautan
 * eksternal (`url`).
 */
export function MateriRail({
  slug,
  modul,
  modulAktif,
  selesai,
}: {
  slug: string;
  modul: ModulKursus[];
  /** Id modul yang sedang dibuka — satu baris, untuk `aria-current`. */
  modulAktif: string;
  /** Id modul yang sudah selesai; dari server, bukan dihitung di sini. */
  selesai: string[];
}) {
  const setSelesai = new Set(selesai);

  return (
    <nav aria-label="Daftar modul" className="flex flex-col gap-1">
      <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
        Daftar modul
      </p>
      <ol className="flex flex-col gap-0.5">
        {modul.map((m, index) => {
          const aktif = m.id === modulAktif;
          const sudah = setSelesai.has(m.id);
          const jumlahHalaman = m.halaman?.length ?? 0;
          const jumlahLampiran = m.materi?.length ?? 0;
          const jumlahKuis = m.kuis?.length ?? 0;
          return (
            <li key={m.id}>
              <Link
                href={`/belajar/${slug}/materi/${m.id}`}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
                  aktif ? "bg-blue-50 text-[#0056D2]" : "text-gray-700 hover:bg-gray-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                    sudah
                      ? "bg-emerald-500 text-white"
                      : aktif
                        ? "bg-[#0056D2] text-white"
                        : "bg-gray-100 text-gray-500",
                  )}
                >
                  {sudah ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block leading-snug", aktif && "font-semibold")}>
                    {m.judul}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-gray-500">
                    {m.durasi_min} mnt
                    {jumlahHalaman > 0 ? ` · ${jumlahHalaman} halaman` : ""}
                    {jumlahLampiran > 0 ? ` · ${jumlahLampiran} lampiran` : ""}
                    {jumlahKuis > 0 ? ` · ${jumlahKuis} kuis` : ""}
                    {sudah ? " · Selesai" : ""}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npx vitest run src/components/features/learning/materi-rail.test.ts`
Expected: PASS — 5 test hijau.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/learning/materi-rail.tsx src/components/features/learning/materi-rail.test.ts
git commit -m "feat(reader): rail daftar modul"
```

---

## Task 5: `materi-focus-bar.tsx` — bar fokus

**Files:**
- Create: `src/components/features/learning/materi-focus-bar.tsx`
- Test: `src/components/features/learning/materi-focus-bar.test.ts`

**Interfaces:**
- Consumes: `useCourseSession()` (`./course-session`), `wajibSesiTerverifikasi` + `checkpointTerverifikasi` + `checkpointEfektif` (`@/lib/learning/akses`), `ModulKursus`.
- Produces: `MateriFocusBar({ slug, kursusJudul, modul, sudah, onTandai, pending, drawerBuka, onToggleDrawer, aksesTutor }: {...})`.

**Gerbang tombol tutor:** `aksesTutor: KeputusanAkses` dari `boleh("bantuan_akademik")`. Aktif hanya bila `aksesTutor.tipe === "bebas"` — sama seperti `kursus-ai-panel.tsx:36`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/components/features/learning/materi-focus-bar.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseSessionProvider } from "./course-session";
import { MateriFocusBar } from "./materi-focus-bar";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Bar fokus — diuji lewat HTML hasil render.
 *
 * Dua hal yang dikunci:
 * 1. Tombol tutor mengikuti **kebijakan kursus** (`aturan_bantuan`), bukan
 *    checkpoint modul. Test ini sengaja memakai modul ber-checkpoint `kuis` di
 *    kursus `bertutor` dan mengharapkan tombol tetap aktif — supaya tidak ada
 *    yang diam-diam menambahkan gerbang per checkpoint.
 * 2. Tombol `tanpa_ai` tetap **dirender** meski nonaktif, dengan alasan dari
 *    `putuskanAkses` — peserta berhak tahu fitur itu ada dan kenapa mati.
 */

const MODUL: ModulKursus = {
  id: "crs-1-m2",
  judul: "Mendalami React",
  ringkasan: "r",
  durasi_min: 10,
  url: "https://contoh.test",
  checkpoint: { batas_waktu_menit: 30, mode: "kuis" },
};

function render(aksesTutor: Parameters<typeof MateriFocusBar>[0]["aksesTutor"]) {
  // `children` dioper lewat properti, bukan argumen ketiga `createElement`:
  // di React 19 types `children` adalah properti wajib `CourseSessionProvider`,
  // dan bentuk tiga-argumen gagal `npm run typecheck` dengan TS2769. Sama
  // seperti helper di Task 3.
  const isi = {
    courseId: "crs-1",
    kebijakan: kebijakanDefault(),
    buktiAwal: "t.a",
    runIdAwal: "r-1",
    children: createElement(MateriFocusBar, {
      slug: "kursus-uji",
      kursusJudul: "Kursus Uji",
      modul: MODUL,
      sudah: false,
      onTandai: () => {},
      pending: false,
      drawerBuka: false,
      onToggleDrawer: () => {},
      aksesTutor,
    }),
  };
  return renderToStaticMarkup(createElement(CourseSessionProvider, isi));
}

describe("MateriFocusBar", () => {
  it("menautkan kembali ke silabus dengan nama aksesibel", () => {
    const html = render({ tipe: "bebas" });
    expect(html).toContain('href="/belajar/kursus-uji"');
    // `aria-label` wajib ada: di bawah `sm` label visualnya `display:none` dan
    // ikonnya `aria-hidden`, jadi tanpa ini tautannya tanpa nama di mobile —
    // dan ini satu-satunya jalan keluar dari reader.
    expect(html).toContain('aria-label="Silabus"');
  });

  it("tombol tutor aktif saat kebijakan mengizinkan", () => {
    const html = render({ tipe: "bebas" });
    expect(html).toContain('aria-expanded="false"');
    // Dihitung dari **atribut** `disabled=""`, bukan substring "disabled":
    // kelas Tailwind `disabled:opacity-60` pada tombol "Tandai selesai" juga
    // memuat kata itu, sehingga `not.toContain("disabled")` gagal pada kode
    // yang benar dan `toContain("disabled")` lulus tanpa membuktikan apa pun.
    expect(html.match(/disabled=""/g) ?? []).toHaveLength(0);
  });

  it("tombol tutor nonaktif saat `tanpa_ai`, tapi tetap dirender dengan alasannya", () => {
    const html = render({ tipe: "ditolak", pesan: "Aturan course ini melarang bantuan AI." });
    expect(html).toContain("Aturan course ini melarang bantuan AI.");
    // Tepat satu tombol nonaktif — tombol tutor. "Tandai selesai" tidak
    // (`pending` false), jadi jumlahnya membedakan keduanya.
    expect(html.match(/disabled=""/g) ?? []).toHaveLength(1);
  });

  it("menampilkan tombol tandai selesai saat modul belum selesai", () => {
    expect(render({ tipe: "bebas" })).toContain("Tandai selesai");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npx vitest run src/components/features/learning/materi-focus-bar.test.ts`
Expected: FAIL — `Cannot find module './materi-focus-bar'`.

- [ ] **Step 3: Implementasi**

Buat `src/components/features/learning/materi-focus-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ArrowLeft, Check, Loader2, PanelRightClose, PanelRightOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCourseSession } from "./course-session";
import { CourseSessionIndicator, CourseSessionPrompt } from "./course-session";
import type { KeputusanAkses } from "@/lib/learning/akses";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Bar fokus reader — satu baris, `sticky top-0`.
 *
 * Berada di `top-0`, **bukan** di bawah navbar mengambang: reader tidak memakai
 * `.chrome` sama sekali. Karena itu bar ini tidak butuh offset `--chrome-h`, dan
 * tidak boleh memperkenalkan `-mt-[Npx]` (`chrome-offset.test.ts` menyapu semua
 * `.tsx` dan akan gagal).
 *
 * Tombol tutor mengikuti `aksesTutor` — keputusan `boleh("bantuan_akademik")`,
 * jadi `aturan_bantuan` dihormati lewat satu mesin keputusan, bukan salinan
 * aturan. Saat `tanpa_ai` tombolnya tetap dirender nonaktif dengan alasan dari
 * `putuskanAkses`, mengikuti alasan yang sudah ditulis di `kursus-ai-panel.tsx`.
 */
export function MateriFocusBar({
  slug,
  kursusJudul,
  modul,
  sudah,
  onTandai,
  pending,
  drawerBuka,
  onToggleDrawer,
  aksesTutor,
}: {
  slug: string;
  kursusJudul: string;
  modul: ModulKursus;
  sudah: boolean;
  onTandai: () => void;
  pending: boolean;
  drawerBuka: boolean;
  onToggleDrawer: () => void;
  /** Keputusan `putuskanAkses` untuk `bantuan_akademik`. */
  aksesTutor: KeputusanAkses;
}) {
  const bolehTutor = aksesTutor.tipe === "bebas";

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-md">
      <div className="flex w-full items-center gap-3 px-3 py-2.5 sm:px-5">
        <Link
          href={`/belajar/${slug}`}
          // Nama aksesibel yang **tidak bergantung breakpoint**: di bawah `sm`
          // span labelnya `display: none` dan ikonnya `aria-hidden`, sehingga
          // tanpa `aria-label` ini satu-satunya jalan keluar dari reader
          // diumumkan sebagai "link" tanpa nama. Label visualnya tetap seperti
          // semula bagi pengguna awas.
          aria-label="Silabus"
          className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-gray-600 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden="true" />
          <span className="hidden sm:inline">Silabus</span>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-gray-900">{kursusJudul}</p>
          <p className="truncate text-[11px] text-gray-500">{modul.judul}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleDrawer}
            disabled={!bolehTutor}
            aria-expanded={drawerBuka}
            aria-controls="drawer-tutor"
            aria-label={bolehTutor ? "Tutor AI" : aksesTutor.tipe === "ditolak" ? aksesTutor.pesan : "Tutor AI"}
            title={bolehTutor ? "Tutor AI" : aksesTutor.tipe === "ditolak" ? aksesTutor.pesan : undefined}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-lg border transition-colors",
              bolehTutor
                ? "cursor-pointer border-gray-300 text-gray-700 hover:bg-gray-50"
                : "cursor-not-allowed border-gray-200 text-gray-300",
            )}
          >
            {drawerBuka ? (
              <PanelRightClose className="size-4" strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <PanelRightOpen className="size-4" strokeWidth={1.9} aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onTandai}
            disabled={pending}
            aria-pressed={sudah}
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors disabled:opacity-60",
              sudah
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            )}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
            )}
            {sudah ? "Selesai" : "Tandai selesai"}
          </button>
        </div>
      </div>

      {/* Ajakan/indikator sesi hidup di bar yang sama supaya peserta selalu punya
          satu titik masuk untuk memulai sesi — termasuk di kursus yang modulnya
          tidak punya lampiran, di mana `CourseSessionGate` tidak pernah tampil. */}
      <div className="px-3 pb-2.5 sm:px-5">
        <CourseSessionPrompt />
        <CourseSessionIndicator />
      </div>

      {!bolehTutor && aksesTutor.tipe === "ditolak" ? (
        <p className="flex items-center gap-1.5 border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900 sm:px-5">
          <Sparkles className="size-3 shrink-0" aria-hidden="true" />
          {aksesTutor.pesan}
        </p>
      ) : null}
    </header>
  );
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npx vitest run src/components/features/learning/materi-focus-bar.test.ts`
Expected: PASS — 4 test hijau.

- [ ] **Step 5: Mutation check**

Ubah `const bolehTutor = aksesTutor.tipe === "bebas";` menjadi `const bolehTutor = true;`. Test `tanpa_ai` harus **merah**. Kembalikan.

- [ ] **Step 6: Commit**

```bash
git add src/components/features/learning/materi-focus-bar.tsx src/components/features/learning/materi-focus-bar.test.ts
git commit -m "feat(reader): bar fokus dengan tombol tutor"
```

---

## Task 6: `tutor-drawer.tsx` — drawer kanan

**Files:**
- Create: `src/components/features/learning/tutor-drawer.tsx`
- Test: `src/components/features/learning/tutor-drawer.test.ts`

**Interfaces:**
- Produces: `TutorDrawer({ src, buka, onTutup, boleh }: { src: string; buka: boolean; onTutup: () => void; boleh: boolean })`.

**Tiga aturan yang tidak boleh dilanggar:**
1. **Tidak pernah di-unmount.** Selalu dirender; disembunyikan dengan CSS. Melepas iframe memutus WebSocket dan membuang percakapan.
2. **`sandbox` + `referrerPolicy` sama seperti `ai-mastery-frame.tsx`** — frame tidak boleh menjangkau dokumen Careevo.
3. **`boleh === false` berarti iframe tidak dimuat sama sekali** (`src` tidak diberikan), supaya kebijakan `tanpa_ai` tidak diam-diam memuat aplikasi tutor.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/components/features/learning/tutor-drawer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TutorDrawer } from "./tutor-drawer";

/**
 * Drawer tutor — diuji lewat HTML hasil render.
 *
 * Yang dikunci adalah hal-hal yang kalau salah merusak percakapan atau kebijakan:
 * 1. Tertutup **tidak** berarti tidak dirender (iframe harus tetap hidup).
 * 2. `boleh: false` tidak boleh memuat iframe sama sekali.
 * 3. Atribut keamanan frame ikut terpasang.
 */

const SRC = "http://localhost:3790/embed/chat?course=r2";

function render(props: Partial<Parameters<typeof TutorDrawer>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(TutorDrawer, { src: SRC, buka: true, onTutup: () => {}, boleh: true, ...props }),
  );
}

describe("TutorDrawer", () => {
  it("merender iframe saat dibuka", () => {
    const html = render({ buka: true });
    expect(html).toContain("<iframe");
    expect(html).toContain(SRC);
  });

  it("tetap merender iframe saat tertutup — disembunyikan, bukan dilepas", () => {
    // Ini yang menjaga WebSocket dan transkrip tetap hidup saat peserta menutup
    // drawer untuk membaca. Melepas iframe akan memuat ulang dokumennya.
    const html = render({ buka: false });
    expect(html).toContain("<iframe");
    // `hidden` harus ada di kelas `<aside>`, **bukan** sekadar di suatu tempat di
    // HTML: gagang resize dan scrim sama-sama memakai kelas `hidden`, jadi
    // `toContain("hidden")` yang longgar tetap hijau walau aside-nya dibiarkan
    // selalu terbuka — assertion yang tidak bisa merah tidak membuktikan apa pun.
    const aside = html.match(/<aside[^>]*>/)?.[0] ?? "";
    expect(aside).toContain("hidden");
  });

  it("tidak memuat iframe sama sekali saat kebijakan melarang", () => {
    const html = render({ boleh: false });
    expect(html).not.toContain("<iframe");
  });

  it("memasang sandbox dan referrerPolicy", () => {
    const html = render();
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"');
    // Dibandingkan tanpa peduli huruf besar/kecil: React 19 merender atribut ini
    // sebagai `referrerPolicy` (camelCase) di `renderToStaticMarkup`, sementara
    // HTML sendiri tidak case-sensitive untuk nama atribut. Assertion lowercase
    // yang ketat akan gagal pada kode yang benar.
    expect(html.toLowerCase()).toContain('referrerpolicy="no-referrer"');
  });

  it("punya id yang bisa dirujuk aria-controls tombol", () => {
    expect(render()).toContain('id="drawer-tutor"');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npx vitest run src/components/features/learning/tutor-drawer.test.ts`
Expected: FAIL — `Cannot find module './tutor-drawer'`.

- [ ] **Step 3: Implementasi**

Buat `src/components/features/learning/tutor-drawer.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Drawer tutor AI di sisi kanan reader.
 *
 * Diadaptasi dari "reading companion" DeepTutor
 * (`features/sijago/components/reading/workspace/ReadingWorkspace.tsx`):
 * kolom kanan ter-dock yang bisa di-resize di `xl`, dan **sheet** di atas
 * dokumen dengan scrim di bawahnya. Yang diambil adalah mekanismenya — bukan
 * chat-nya: isi drawer adalah aplikasi AI Mastery lewat rute chromeless
 * `/embed/chat`, jadi tidak ada chat kedua di Careevo.
 *
 * ## Kenapa tidak pernah di-unmount
 *
 * DeepTutor memakai `companionOpen && <ReadingCompanion/>` — ia membongkar
 * panelnya saat ditutup, dan itu benar di sana karena `ChatRuntimeProvider` di
 * atasnya memegang state percakapan. Di sini tidak ada lapisan itu: transkrip
 * dan WebSocket hidup **di dalam** iframe. Melepas iframe memuat ulang dokumen
 * dan memutus giliran yang sedang berjalan. Karena itu drawer selalu dirender
 * dan hanya disembunyikan dengan CSS.
 *
 * ## `boleh: false` tidak memuat iframe
 *
 * Kebijakan `tanpa_ai` harus berarti aplikasi tutor tidak pernah dimuat, bukan
 * hanya disembunyikan. Karena itu `src` tidak diberikan sama sekali saat
 * `boleh` false — frame yang dimuat lalu ditutup tetap sudah memanggil backend.
 */

/** Lebar default drawer; sama dengan lebar tetap DeepTutor sebelum bisa di-resize. */
const LEBAR_BAWAAN = 400;
const LEBAR_MIN = 300;
const LEBAR_MAKS = 640;
const KUNCI_SIMPAN = "careevo.reader.tutorWidth";

export function TutorDrawer({
  src,
  buka,
  onTutup,
  boleh,
}: {
  /** URL rute embed AI Mastery, sudah dihitung server. */
  src: string;
  buka: boolean;
  onTutup: () => void;
  /** `false` = kebijakan melarang; iframe tidak dimuat sama sekali. */
  boleh: boolean;
}) {
  /**
   * Lebar drawer, disimpan di `localStorage`.
   *
   * Lazy-init dan dibaca hanya di klien: nilai ini tidak pernah masuk markup
   * server, jadi tidak ada ketidakcocokan hidrasi yang perlu dijaga. Di server
   * `window` tidak ada, jadi lebar bawaannya yang dipakai.
   */
  const [lebar, setLebar] = useState(() => {
    if (typeof window === "undefined") return LEBAR_BAWAAN;
    try {
      const tersimpan = Number(window.localStorage.getItem(KUNCI_SIMPAN));
      return Number.isFinite(tersimpan) && tersimpan >= LEBAR_MIN && tersimpan <= LEBAR_MAKS
        ? tersimpan
        : LEBAR_BAWAAN;
    } catch {
      // Penyimpanan yang diblokir cukup kembali ke default; bukan alasan gagal.
      return LEBAR_BAWAAN;
    }
  });
  const mulaiRef = useRef<{ x: number; lebar: number } | null>(null);

  /**
   * `Escape` menutup drawer — pola yang sama dengan mode belajar DeepTutor.
   *
   * Hanya terpasang saat drawer terbuka, dan hanya menutup drawer (bukan
   * menghentikan sesi belajar): peserta yang menekan Escape ingin kembali ke
   * materi, bukan mengakhiri sesinya.
   */
  useEffect(() => {
    if (!buka) return;
    const padaTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    document.addEventListener("keydown", padaTombol);
    return () => document.removeEventListener("keydown", padaTombol);
  }, [buka, onTutup]);

  const mulaiResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    mulaiRef.current = { x: e.clientX, lebar };
    const padaGerak = (ev: PointerEvent) => {
      const mulai = mulaiRef.current;
      if (!mulai) return;
      // Menyeret ke kiri memperlebar drawer: delta dibalik.
      const berikut = mulai.lebar + (mulai.x - ev.clientX);
      setLebar(Math.min(LEBAR_MAKS, Math.max(LEBAR_MIN, Math.round(berikut))));
    };
    const padaLepas = () => {
      window.removeEventListener("pointermove", padaGerak);
      window.removeEventListener("pointerup", padaLepas);
      mulaiRef.current = null;
      setLebar((sekarang) => {
        try {
          window.localStorage.setItem(KUNCI_SIMPAN, String(sekarang));
        } catch {
          // Gagal menyimpan hanya berarti default lagi lain kali.
        }
        return sekarang;
      });
    };
    window.addEventListener("pointermove", padaGerak);
    window.addEventListener("pointerup", padaLepas);
  };

  return (
    <>
      {/* Scrim: hanya di bawah `xl`, tempat drawer menjadi sheet di atas
          dokumen. Di `xl` drawer ter-dock, jadi menutup layar justru menghalangi
          membaca — persis kesalahan yang pernah terjadi di DeepTutor, di mana
          scrim tunggal meredupkan dokumen yang sedang dibaca. */}
      {buka && boleh ? (
        <div
          onClick={onTutup}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/30 xl:hidden"
        />
      ) : null}

      <aside
        id="drawer-tutor"
        aria-label="Tutor AI"
        // Selalu ada di pohon React: saat tertutup ia hanya disembunyikan dengan
        // CSS (`hidden`), sehingga iframe di dalamnya **tidak** dimuat ulang dan
        // WebSocket tidak putus. Ini beda dari `companionOpen && <Panel/>` milik
        // DeepTutor, yang boleh membongkar panelnya karena state-nya ada di
        // provider di atas — di sini state-nya ada di dalam iframe.
        className={cn(
          "border-gray-200 bg-white",
          buka
            // `xl:relative`, **bukan** `xl:static`: gagang resize di bawah
            // diposisikan `absolute`, dan elemen `static` tidak membentuk
            // containing block — gagangnya akan mengukur terhadap viewport dan
            // mendarat sebagai pita setinggi layar di tepi kiri halaman, bukan di
            // batas drawer. `relative` tetap in-flow, jadi docking tidak berubah.
            ? "fixed inset-y-0 right-0 z-40 flex flex-col border-l shadow-xl xl:relative xl:z-auto xl:shadow-none"
            : "hidden",
        )}
        style={buka ? { width: `${lebar}px`, maxWidth: "92vw" } : undefined}
      >
        {boleh ? (
          <>
            {/* Gagang resize hanya di layar lebar, tempat drawer benar-benar ter-dock. */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Ubah lebar tutor"
              onPointerDown={mulaiResize}
              className="absolute inset-y-0 -left-0.5 z-10 hidden w-1 cursor-col-resize hover:bg-blue-200 xl:block"
            />
            <iframe
              src={src}
              title="Tutor AI"
              // Sama seperti `ai-mastery-frame.tsx`: frame tidak boleh menjangkau
              // dokumen Careevo, dan tidak perlu mengirim referrer.
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              referrerPolicy="no-referrer"
              allow="clipboard-read; clipboard-write"
              className="h-full w-full flex-1 border-0 bg-transparent"
            />
          </>
        ) : (
          <p className="p-4 text-[12.5px] text-gray-500">
            Tutor AI tidak tersedia untuk kursus ini.
          </p>
        )}
      </aside>
    </>
  );
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npx vitest run src/components/features/learning/tutor-drawer.test.ts`
Expected: PASS — 5 test hijau.

- [ ] **Step 5: Mutation check**

Ubah `{boleh ? (` menjadi `{true ? (`, dan ubah `buka ? "fixed inset-y-0 …" : "hidden"` menjadi selalu kelas `buka`-nya. Test "tidak memuat iframe saat kebijakan melarang" dan "tetap merender iframe saat tertutup" harus **merah**. Kembalikan.

- [ ] **Step 6: Commit**

```bash
git add src/components/features/learning/tutor-drawer.tsx src/components/features/learning/tutor-drawer.test.ts
git commit -m "feat(reader): drawer tutor AI, ter-mount permanen"
```

---

## Task 7: `materi-pane.tsx` — isi satu modul

**Files:**
- Create: `src/components/features/learning/materi-pane.tsx`
- Test: `src/components/features/learning/materi-pane.test.ts`

**Interfaces:**
- Consumes: `HalamanView`, `MateriView`, `KuisView`, `CourseSessionGate`, `useCourseSession`, `ModulKursus`.
- Produces: `MateriPane({ kursusId, modul }: { kursusId: string; modul: ModulKursus })`.

**Gerbang (dari spec §3.3):** halaman **bebas**; lampiran `boleh("materi")`; kuis `boleh("kuis")`.

**Kenapa pane membaca keputusannya sendiri.** Versi pertama plan ini mengoper
`keputusanLampiran`/`keputusanKuis` sebagai prop dari shell. Itu salah untuk
struktur yang dipakai Task 8: shell hidup di `layout.tsx`, dan layout **tidak**
punya akses ke `modulId` anaknya, jadi ia tidak bisa merender pane. Pane dirender
oleh `page.tsx` yang berada **di bawah** provider — dan `useCourseSession()` di
sana membaca sesi yang sama. Keputusannya tetap dihitung **saat render**, bukan
disimpan di state, jadi gerbang tidak bisa tertinggal basi.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/components/features/learning/materi-pane.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseSessionProvider } from "./course-session";
import { MateriPane } from "./materi-pane";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { KeputusanAkses } from "@/lib/learning/akses";

/**
 * Pane modul — diuji lewat HTML hasil render.
 *
 * Yang dikunci: prosa **selalu** tampil (membaca bukan penyelesaian), sedangkan
 * lampiran dan kuis tunduk pada keputusan `putuskanAkses`. Keputusan itu dibaca
 * pane dari `useCourseSession()`, jadi test ini menyuntikkan bukti lewat
 * `CourseSessionProvider` alih-alih mengoper keputusan sebagai prop — itu yang
 * membuatnya benar-benar menguji gerbangnya, bukan sekadar meneruskan nilai.
 */

const HALAMAN = {
  id: "hal-1",
  modul_id: "crs-1-m1",
  course_id: "crs-1",
  judul: "Pengantar",
  urutan: 1,
  blok: [{ id: "b1", tipe: "paragraf" as const, segmen: [{ teks: "Isi materi." }] }],
  created_at: "",
  updated_at: "",
};

const MODUL: ModulKursus = {
  id: "crs-1-m1",
  judul: "Orientasi",
  ringkasan: "r",
  durasi_min: 10,
  url: "https://contoh.test",
  halaman: [HALAMAN],
  materi: [
    {
      id: "mat-1",
      modul_id: "crs-1-m1",
      course_id: "crs-1",
      judul: "Video",
      tipe: "video",
      url: "https://youtu.be/abc",
      durasi_min: 5,
      urutan: 1,
      created_at: "",
      updated_at: "",
    },
  ],
  kuis: [
    {
      id: "k-1",
      judul: "Kuis Orientasi",
      deskripsi: "Uji pemahaman.",
      soal: [],
      nilai_lulus: 70,
      created_at: "",
      updated_at: "",
    },
  ],
};

/**
 * `bukti` menentukan keputusan: tanpa bukti, kebijakan `wajib` membuat
 * `putuskanAkses` menjawab `perlu_sesi` untuk `materi` dan `kuis`.
 */
function render(bukti: string | null) {
  // `children` lewat properti, bukan argumen ketiga: di React 19 types
  // `children` wajib pada `CourseSessionProvider` dan bentuk tiga-argumen gagal
  // `npm run typecheck` (TS2769). Sama seperti helper Task 3 dan Task 5.
  const isi = {
    courseId: "crs-1",
    kebijakan: kebijakanDefault(),
    buktiAwal: bukti,
    runIdAwal: bukti ? "run-1" : null,
    children: createElement(MateriPane, { kursusId: "crs-1", modul: MODUL }),
  };
  return renderToStaticMarkup(createElement(CourseSessionProvider, isi));
}

describe("MateriPane", () => {
  it("selalu menampilkan prosa, bahkan tanpa sesi", () => {
    // Membaca bukan penyelesaian: gerbang tidak boleh menutup prosa.
    expect(render(null)).toContain("Isi materi.");
  });

  it("menutup lampiran tanpa sesi", () => {
    const html = render(null);
    // Embed YouTube tidak boleh ikut ter-render saat gerbang menutup.
    expect(html).not.toContain("youtube.com/embed");
  });

  it("menampilkan lampiran saat sesi terverifikasi aktif", () => {
    expect(render("token.abc")).toContain("youtube.com/embed");
  });

  it("menutup kuis secara terpisah dari lampiran", () => {
    // Tanpa sesi, keduanya tertutup — tetapi yang dibuktikan di sini adalah
    // pesan gerbang `kuis` muncul sendiri, bukan hanya pesan `materi`.
    const html = render(null);
    expect(html).toContain("Kuis");
    expect(html).not.toContain("Periksa jawaban");
  });
});
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npx vitest run src/components/features/learning/materi-pane.test.ts`
Expected: FAIL — `Cannot find module './materi-pane'`.

- [ ] **Step 3: Implementasi**

Buat `src/components/features/learning/materi-pane.tsx`:

```tsx
"use client";

import { useState } from "react";
import { HalamanView } from "./halaman-view";
import { MateriView } from "./materi-view";
import { KuisView } from "./kuis-view";
import { CourseSessionGate, useCourseSession } from "./course-session";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Isi satu modul di reader.
 *
 * Urutannya mengikuti alur belajar yang lama — prosa dulu, lalu **kuis**, lalu
 * **lampiran** — supaya peserta tidak perlu belajar ulang tata letaknya. Urutan
 * itu bukan pilihan baru: halaman kursus lama merender dengan urutan yang sama
 * (`detail-kursus.tsx`: `HalamanView` di :614, `KuisView` di :632, `MateriView`
 * di :658). Yang berubah hanya rumahnya: dulu dirender di dalam akordeon daftar
 * modul, sekarang di pane reader.
 *
 * Keputusan akses dibaca **di sini**, dari `useCourseSession()`, bukan dioper
 * sebagai prop. Pane dirender oleh `page.tsx` yang berada di bawah
 * `CourseSessionProvider` di layout, jadi konteksnya tersedia; dan karena
 * keputusannya dihitung saat render (bukan disimpan di state), gerbangnya tidak
 * bisa tertinggal basi ketika sesi dimulai atau diakhiri.
 *
 * Halaman yang sedang dibaca juga state lokal di sini. Dulu ia di shell, tetapi
 * shell ada di `layout.tsx` yang tidak punya akses ke `modulId` anaknya — dan
 * pager halaman memang milik satu modul, jadi tempatnya di sini.
 *
 * Panel tutor AI **tidak** di sini: ia pindah ke drawer (spec §3.7).
 */
export function MateriPane({ kursusId, modul }: { kursusId: string; modul: ModulKursus }) {
  const { boleh } = useCourseSession();
  const keputusanLampiran = boleh("materi");
  const keputusanKuis = boleh("kuis");

  const [halamanTerpilih, setHalamanTerpilih] = useState<string | null>(null);

  const daftarHalaman = [...(modul.halaman ?? [])].sort((a, b) => a.urutan - b.urutan);
  const daftarMateri = modul.materi ?? [];
  const daftarKuis = modul.kuis ?? [];
  // Halaman yang ditampilkan: yang dipilih peserta, atau halaman pertama.
  const halamanAktif = daftarHalaman.find((h) => h.id === halamanTerpilih) ?? daftarHalaman[0] ?? null;
  const adaIsi = daftarHalaman.length > 0 || daftarMateri.length > 0 || daftarKuis.length > 0;

  if (!adaIsi) {
    // Modul turunan tidak punya isi tersimpan. Ia tidak berpura-pura punya pane
    // kosong: yang benar adalah mengantar ke materi eksternalnya.
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">{modul.judul}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{modul.ringkasan}</p>
        <a
          href={modul.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-full bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00419e]"
        >
          Buka materi eksternal ↗
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {halamanAktif ? (
        <HalamanView modul={modul} halaman={halamanAktif} onPindahHalaman={setHalamanTerpilih} />
      ) : null}

      {daftarKuis.length > 0 ? (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Kuis</p>
          {keputusanKuis.tipe === "bebas" ? (
            daftarKuis.map((kuis) => (
              <KuisView key={kuis.id} kuis={kuis} konteks={{ courseId: kursusId, modulId: modul.id }} />
            ))
          ) : (
            <CourseSessionGate pesan={keputusanKuis.pesan} />
          )}
        </section>
      ) : null}

      {daftarMateri.length > 0 ? (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Lampiran</p>
          {keputusanLampiran.tipe === "bebas" ? (
            daftarMateri.map((materi) => (
              <div key={materi.id}>
                <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#0056D2] uppercase">
                    {materi.tipe === "video" ? "Video" : "PDF"}
                  </span>
                  {materi.judul}
                </p>
                <MateriView materi={materi} />
              </div>
            ))
          ) : (
            <CourseSessionGate pesan={keputusanLampiran.pesan} />
          )}
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npx vitest run src/components/features/learning/materi-pane.test.ts`
Expected: PASS — 4 test hijau.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/learning/materi-pane.tsx src/components/features/learning/materi-pane.test.ts
git commit -m "feat(reader): pane isi modul dengan gerbang per kegiatan"
```

---

## Task 8: Shell reader — `layout.tsx` + `page.tsx`

**Files:**
- Create: `src/app/(focus)/belajar/[slug]/materi/layout.tsx`
- Create: `src/components/features/learning/materi-shell.tsx` (komposisi klien: bar + rail + drawer)
- Create: `src/app/(focus)/belajar/[slug]/materi/[modulId]/page.tsx`
- Modify: `scripts/smoke.mjs` (tambah route)

**Interfaces:**
- Consumes: `modulUntukSumber`, `sesiReaderAwal` (Task 2), `kebijakanDefault`/`kursusKebijakan`, `urlFrameTutorEmbed` (Task 1), `AI_MASTERY_WEB_URL`, `selaraskanKursusAi`, semua komponen Task 3–7.
- Produces: route `/belajar/[slug]/materi/[modulId]` yang bisa dibuka.

**Kenapa shell di `layout.tsx`:** layout Next.js **tidak** di-render ulang saat
navigasi (docs Next: *"Layouts do not re-render on navigation"*), jadi provider
sesi dan iframe tutor tidak pernah di-remount saat berpindah modul. Menaruhnya di
`page.tsx` membuat setiap klik modul me-remount keduanya — sesi dan percakapan
hilang. Ini keputusan struktural, bukan preferensi gaya.

**Konsekuensi yang harus ditangani:** layout di `materi/layout.tsx` hanya menerima
`params.slug` — ia **tidak** menerima `modulId`, karena segmen itu milik anaknya.
Karena itu modul aktif **diturunkan dari pathname di komponen klien**, persis yang
disarankan docs Next (*"To access the current pathname, you can read it inside a
Client Component using the `usePathname()` hook"*). Layout tetap server component
untuk membaca data; shell-nya klien.

**Pembagian tanggung jawab:**

| Berkas | Peran |
|---|---|
| `materi/layout.tsx` (server) | Baca kursus, modul, progres, seed sesi, URL tutor. Render provider + `<MateriShell>` |
| `materi-shell.tsx` (klien) | `usePathname()` → modul aktif. Render bar fokus, rail, drawer, `KejadianPanel`, dan `{children}` |
| `[modulId]/page.tsx` (server) | `notFound()` untuk id tak dikenal; render `<MateriPane>` saja |

- [ ] **Step 1: Tulis `layout.tsx`**

Buat `src/app/(focus)/belajar/[slug]/materi/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { cariEntri } from "@/lib/courses/katalog";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { getCourseById } from "@/lib/courses/store";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import { irisModulSelesai } from "@/lib/courses/kurikulum";
import { progresKursusDb } from "@/lib/learning/service";
import { pastikanBackfill } from "@/lib/learning/backfill-lazy";
import { sesiReaderAwal } from "@/lib/learning/reader-sesi";
import { selaraskanKursusAi } from "@/lib/learning/tutor-ai-kursus";
import { urlFrameTutorEmbed, KAPABILITAS_COURSE_STUDY } from "@/lib/learning/tutor-ai";
import { AI_MASTERY_WEB_URL } from "@/lib/mode/store";
import { CourseSessionProvider } from "@/components/features/learning/course-session";
import { MateriShell } from "@/components/features/learning/materi-shell";

/**
 * Shell reader — tinggal di **layout**, bukan di halaman.
 *
 * Layout Next.js tidak di-render ulang saat navigasi, jadi berpindah modul 1 → 4
 * tidak me-remount provider sesi atau iframe tutor. Kalau shell ini ditaruh di
 * `page.tsx`, setiap klik modul akan memuat ulang iframe dan memutus WebSocket di
 * tengah giliran — dan sesi terverifikasi yang sedang berjalan ikut hilang karena
 * provider-nya dibongkar.
 *
 * Layout ini **tidak** tahu modul mana yang aktif: `params` di sini hanya memuat
 * `slug`, karena `[modulId]` adalah segmen anak. Modul aktif diturunkan dari
 * pathname di dalam `MateriShell` (klien).
 *
 * Gerbang sesi + onboarding tidak diulang di sini: `(focus)/layout.tsx` sudah
 * memilikinya, dan layout ini berada di bawahnya.
 */
export default async function MateriLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { slug } = await params;
  const entri = await cariEntri(slug);
  if (!entri) notFound();

  const kursusAsli = await getCourseById(entri.id);
  const kebijakan = kursusAsli?.kebijakan ?? kebijakanDefault();

  const modul = await modulUntukSumber({
    id: entri.id,
    title: entri.title,
    tags: entri.tags,
    duration_min: entri.duration_min,
    url: entri.url,
  });

  await pastikanBackfill(session);
  const { selesai } = await progresKursusDb(session, entri.id);
  const selesaiValid = irisModulSelesai(selesai, modul);

  // Seed sesi: peserta yang memuat ulang atau membuka deep link ke satu modul
  // tidak kehilangan sesi terverifikasi yang masih berjalan. `null` berarti
  // memang tidak ada sesi — gerbang biasa yang tampil, bukan galat.
  const sesiAwal = await sesiReaderAwal({
    userId: session.userId,
    courseId: entri.id,
    policyVersion: kebijakan.versi,
  });

  // Bridging tutor: `selaraskanKursusAi` mengembalikan `null` saat bridging tidak
  // dikonfigurasi atau AI Mastery mati, dan null jatuh ke `entri.id` — perilaku
  // lama, bukan error.
  const aiCourseId =
    (await selaraskanKursusAi({
      courseId: entri.id,
      title: entri.title,
      modul: modul.map((m) => m.judul),
    })) ?? entri.id;

  const tutorSrc = urlFrameTutorEmbed(AI_MASTERY_WEB_URL, {
    course: aiCourseId,
    capability: KAPABILITAS_COURSE_STUDY,
  });

  return (
    <CourseSessionProvider
      courseId={entri.id}
      kebijakan={kebijakan}
      buktiAwal={sesiAwal?.bukti ?? null}
      runIdAwal={sesiAwal?.runId ?? null}
    >
      <MateriShell
        slug={entri.slug}
        kursusJudul={entri.title}
        kursusId={entri.id}
        kebijakan={kebijakan}
        modul={modul}
        selesai={selesaiValid}
        tutorSrc={tutorSrc}
      >
        {children}
      </MateriShell>
    </CourseSessionProvider>
  );
}
```

- [ ] **Step 2: Tulis `materi-shell.tsx`**

Buat `src/components/features/learning/materi-shell.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useCourseSession } from "./course-session";
import { MateriRail } from "./materi-rail";
import { MateriFocusBar } from "./materi-focus-bar";
import { TutorDrawer } from "./tutor-drawer";
import { KejadianPanel } from "./kejadian-panel";
import { useSelesaikanModul } from "./selesaikan-modul";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { KebijakanCourse } from "@/types/course";

/**
 * Shell reader — bar fokus + rail + drawer, membungkus pane modul.
 *
 * Ini **komponen klien** karena satu alasan: ia harus tahu modul mana yang aktif,
 * dan layout yang merendernya tidak menerima `modulId` (`params` di
 * `materi/layout.tsx` hanya memuat `slug`; `[modulId]` adalah segmen anak).
 * Pathname dibaca dengan `usePathname()` — cara yang disarankan docs Next untuk
 * mendapat pathname dari Client Component, karena layout sendiri tidak
 * di-render ulang saat navigasi.
 *
 * Karena shell ini hidup di `layout.tsx`, ia **tidak** di-remount saat berpindah
 * modul: `TutorDrawer` dan `CourseSessionProvider` di atasnya bertahan, sehingga
 * percakapan tutor dan sesi terverifikasi tidak hilang.
 *
 * `KejadianPanel` dirender di sini — panel itu satu-satunya tempat peserta bisa
 * melihat apa yang sudah tercatat selama sesi (spec §2), dan ia menyembunyikan
 * dirinya sendiri saat tidak relevan (`kejadian-panel.tsx:76`).
 */
export function MateriShell({
  slug,
  kursusJudul,
  kursusId,
  kebijakan,
  modul,
  selesai,
  tutorSrc,
  children,
}: {
  slug: string;
  kursusJudul: string;
  kursusId: string;
  kebijakan: KebijakanCourse;
  modul: ModulKursus[];
  selesai: string[];
  /** URL rute embed tutor, sudah dihitung server. */
  tutorSrc: string;
  children: ReactNode;
}) {
  const { boleh } = useCourseSession();
  const [drawerBuka, setDrawerBuka] = useState(false);

  /**
   * Modul aktif, dari segmen terakhir pathname.
   *
   * `/belajar/<slug>/materi/<modulId>` → `<modulId>`. `decodeURIComponent` karena
   * id modul tersimpan boleh memuat karakter yang di-encode di URL.
   *
   * Kalau segmennya tidak cocok dengan modul mana pun (id basi), shell jatuh ke
   * modul pertama hanya untuk membuat bar tetap punya judul; `page.tsx` yang
   * memutuskan `notFound()` untuk id yang benar-benar tidak ada.
   */
  const pathname = usePathname();
  const segmenTerakhir = pathname.split("/").filter(Boolean).at(-1) ?? "";
  const modulAktif =
    modul.find((m) => m.id === decodeURIComponent(segmenTerakhir)) ?? modul[0];

  /**
   * Keputusan akses dihitung **saat render**, bukan disimpan di state.
   *
   * Keputusannya bergantung pada bukti sesi yang bisa berubah kapan saja (sesi
   * dimulai/diakhiri). Menyalinnya ke state membuat gerbang bisa tertinggal
   * menutup lampiran yang sudah sah — alasan yang sama yang sudah ditulis di
   * `detail-kursus.tsx:231`.
   */
  const keputusanTutor = boleh("bantuan_akademik");

  // Kalau kurikulum kosong, tidak ada modul yang bisa ditampilkan. Ini bukan
  // keadaan yang seharusnya terjadi pada kursus yang bisa dibuka, tetapi
  // mengembalikan `null` lebih jujur daripada merender bar tanpa modul.
  if (!modulAktif) return <>{children}</>;

  const sudah = selesai.includes(modulAktif.id);
  const { jalankan, pending } = useSelesaikanModul({
    courseId: kursusId,
    modulId: modulAktif.id,
    kebijakan,
    checkpoint: modulAktif.checkpoint,
  });

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <MateriFocusBar
        slug={slug}
        kursusJudul={kursusJudul}
        modul={modulAktif}
        sudah={sudah}
        onTandai={() => jalankan(sudah)}
        pending={pending}
        drawerBuka={drawerBuka}
        onToggleDrawer={() => setDrawerBuka((v) => !v)}
        aksesTutor={keputusanTutor}
      />

      {/* Panel kejadian: penjelasan + pelaporan selama sesi berjalan. Menyembunyikan
          dirinya sendiri saat status bukan `aktif` dan tanpa celah. */}
      <div className="px-3 pt-3 sm:px-5">
        <KejadianPanel />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Rail tersembunyi di bawah `lg`: pada layar sempit ia akan memakan
            separuh lebar dan menyisakan kolom baca yang tidak terbaca. */}
        <div className="hidden w-72 shrink-0 overflow-y-auto border-r border-gray-200 p-3 lg:block">
          <MateriRail slug={slug} modul={modul} modulAktif={modulAktif.id} selesai={selesai} />
        </div>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>

        <TutorDrawer
          src={tutorSrc}
          buka={drawerBuka}
          onTutup={() => setDrawerBuka(false)}
          boleh={keputusanTutor.tipe === "bebas"}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Tulis `page.tsx`**

Buat `src/app/(focus)/belajar/[slug]/materi/[modulId]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cariEntri } from "@/lib/courses/katalog";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { MateriPane } from "@/components/features/learning/materi-pane";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entri = await cariEntri(slug);
  return { title: entri ? `Materi · ${entri.title}` : "Materi" };
}

/**
 * Satu modul di dalam shell reader.
 *
 * Halaman ini sengaja **tipis**. Shell-nya — bar fokus, rail, drawer tutor, dan
 * `CourseSessionProvider` — hidup di `materi/layout.tsx` supaya tidak di-remount
 * saat berpindah modul. Yang dikerjakan di sini hanya dua hal: menolak id modul
 * yang tidak ada di kurikulum saat ini, dan merender pane-nya.
 *
 * Modul dibaca ulang di sini karena halaman ini yang harus memvalidasi `modulId`
 * dan menyerahkan modulnya ke pane. Pembacaan kedua ini murah: store kursus
 * menghidrasi dirinya **sekali per proses** ke state modul (`pastikanTermuat`,
 * `store.ts:235`), jadi `modulUntukSumber` setelah itu hanya bekerja di memori.
 * Yang **tidak** dibaca ulang di sini adalah progres dan bukti sesi: keduanya
 * sudah dibaca layout, dan membacanya lagi berarti dua pembacaan yang bisa
 * menyimpang.
 *
 * `MateriPane` membaca keputusan aksesnya sendiri dari `useCourseSession()` —
 * ia berada di bawah provider yang dipasang layout, jadi konteksnya tersedia.
 */
export default async function MateriModulPage({
  params,
}: {
  params: Promise<{ slug: string; modulId: string }>;
}) {
  const { slug, modulId } = await params;
  const entri = await cariEntri(slug);
  if (!entri) notFound();

  const modul = await modulUntukSumber({
    id: entri.id,
    title: entri.title,
    tags: entri.tags,
    duration_min: entri.duration_min,
    url: entri.url,
  });

  // Id modul yang tidak ada di kurikulum saat ini adalah 404, bukan render modul
  // kosong: modul yang dihapus admin tidak boleh tampil sebagai halaman hampa.
  const modulAktif = modul.find((m) => m.id === modulId);
  if (!modulAktif) notFound();

  return <MateriPane kursusId={entri.id} modul={modulAktif} />;
}
```

**Catatan:** halaman ini tidak merender shell, provider, atau drawer. Semuanya
milik `layout.tsx`. Kalau kamu menemukan diri menambahkan `CourseSessionProvider`
di sini, itu tanda shell-nya bocor kembali ke halaman — persis yang membuat sesi
dan percakapan hilang saat berpindah modul.

- [ ] **Step 4: Buat hook penyelesaian modul**

Buat `src/components/features/learning/selesaikan-modul.ts`:

```ts
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCourseSession } from "./course-session";
import { tandaiModulAction } from "@/actions/enrollment";
import { selesaikanMateriAction } from "@/actions/learning";
import { checkpointEfektif, checkpointTerverifikasi, wajibSesiTerverifikasi } from "@/lib/learning/akses";
import type { CheckpointMateri, KebijakanCourse } from "@/types/course";

/**
 * Penyelesaian modul — **satu** jalur untuk reader.
 *
 * Logika dua jalur disalin apa adanya dari `detail-kursus.tsx:336–376`; tidak ada
 * aturan baru:
 *
 * - `wajibSesiTerverifikasi(kebijakan) && checkpointTerverifikasi(...)` →
 *   `selesaikanMateriAction`, satu-satunya jalur yang memverifikasi bukti di
 *   server. Klien **tidak** memeriksa ada/tidaknya bukti sebelum memilih jalur:
 *   kalau ia menyaring, peserta yang belum memenuhi syarat justru lolos lewat
 *   jalur informal dan gerbang server tidak pernah dievaluasi.
 * - Sisanya (kursus `opsional`, checkpoint `kuis`/`proyek`, atau pembatalan) →
 *   `tandaiModulAction`.
 *
 * Dipisah dari komponennya karena aturan ini adalah yang paling mudah salah
 * dibaca, dan ia tidak butuh markup untuk diuji.
 */
export function useSelesaikanModul({
  courseId,
  modulId,
  kebijakan,
  checkpoint,
}: {
  courseId: string;
  modulId: string;
  kebijakan: KebijakanCourse;
  /** Checkpoint modul apa adanya; `undefined` untuk modul turunan. */
  checkpoint?: CheckpointMateri;
}) {
  const { bukti } = useCourseSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const jalankan = (sudah: boolean) =>
    startTransition(async () => {
      // `checkpointEfektif` menerima pembungkus `ModulCheckpoint` dan mengisi
      // default aman saat checkpoint-nya tidak lengkap — sama seperti jalur
      // yang dipakai halaman kursus lama.
      const efektif = checkpointEfektif({ checkpoint });
      const wajibTerverifikasi =
        wajibSesiTerverifikasi(kebijakan) && checkpointTerverifikasi(efektif);

      // Jalur informal juga dipakai untuk **pembatalan**: `selesaikanMateriAction`
      // hanya bisa menandai selesai, jadi mengoreksi tanda harus tetap mungkin.
      if (!wajibTerverifikasi || sudah) {
        const hasil = await tandaiModulAction(courseId, modulId);
        if (hasil.ok) {
          setPesan(null);
          router.refresh();
        } else {
          setPesan(hasil.error ?? null);
        }
        return;
      }

      // Bukti diteruskan apa adanya. Bukti kosong bukan alasan mengganti jalur —
      // server yang menolak, dan pesannya dipakai apa adanya; klien bukan
      // penjaga otoritatif.
      const hasil = await selesaikanMateriAction({ courseId, modulId, bukti: bukti ?? "" });
      if (hasil.ok) {
        setPesan(null);
        router.refresh();
      } else {
        setPesan(hasil.error ?? null);
      }
    });

  return { jalankan, pending, pesan };
}
```

**Catatan urutan:** `materi-shell.tsx` (Step 2) mengimpor hook ini, jadi hook harus
ada sebelum `npm run build` di Step 6 bisa lulus. Kalau kamu mengerjakan langkah
berurutan, tulis Step 2 dulu lalu Step 4, dan baru jalankan build.

Di `materi-shell.tsx`, pemanggilan hook yang sudah tertulis di Step 2 memakai prop
`checkpoint` (bukan `checkpointMode`), dan nilainya `modulAktif.checkpoint` apa
adanya — `checkpointEfektif` di dalam hook yang mengisi default untuk modul turunan:

```tsx
const { jalankan, pending } = useSelesaikanModul({
  courseId: kursusId,
  modulId: modulAktif.id,
  kebijakan,
  checkpoint: modulAktif.checkpoint,
});
```

**Catatan:** `pesan` dari hook ini sengaja belum dirender di `MateriFocusBar`.
Menampilkan galat gerbang di bar adalah perbaikan terpisah; untuk sekarang jalur
yang gagal tidak menandai modul selesai, dan pesannya tersedia bagi komponen yang
ingin menampilkannya nanti. Jangan menambahkan penulisan optimistis untuk
menutupinya — itu justru menyembunyikan penolakan server.

- [ ] **Step 5: Tambahkan route ke smoke test**

Di `scripts/smoke.mjs`, di dalam array `routes`, setelah `"/belajar/r1"`:

```js
  // Reader materi: rute baru per modul. Modul `m1` adalah id turunan yang
  // Reader materi: rute baru per modul. Smoke berjalan **tanpa sesi**, jadi
  // route ini dijawab redirect (307) ke `/masuk` sebelum `modulId` pernah
  // dibaca — dan redirect dihitung lulus oleh skrip ini. Yang dicari bukan
  // isinya, melainkan bahwa halamannya bisa dimuat sama sekali: 500 akibat
  // impor server-only yang salah (mis. `reader-sesi`/`modul-resolver` tertarik
  // ke bundel klien) langsung tertangkap di sini.
  "/belajar/r1/materi/r1-m1",
```

**Jangan** mengandalkan `r1-m1` sebagai id modul nyata: `r1` punya modul
**tersimpan** dengan id hasil generate (`mod-mumd9dpe-b038`, …), bukan id turunan
`r1-m1`. Id itu tetap benar untuk smoke karena smoke tidak pernah sampai membacanya
(redirect lebih dulu), tetapi verifikasi manual di langkah berikut harus memakai id
modul yang benar-benar ada — ambil dari rail reader setelah halaman terbuka.

- [ ] **Step 6: Typegen + typecheck + build**

Run:
```bash
npx next typegen && npm run typecheck && npm run build
```
Expected: PASS ketiganya. `build` **wajib** di sini: `check` saja tidak menangkap pelanggaran impor client-safe/server-only (`modul-resolver`, `reader-sesi`, `repository` server-only).

- [ ] **Step 7: Verifikasi manual**

Jalankan dev server (`npm run dev`), buka `/belajar/r1` sebagai pengguna yang sudah
login dan onboarding, lalu **klik salah satu modul** — itu cara mendapatkan
`modulId` yang benar untuk kursus ini.

Periksa: rail menampilkan semua modul · pane menampilkan prosa · bar fokus memuat
tombol tutor · tombol tutor membuka drawer berisi `/embed/chat` **tanpa sidebar** ·
berpindah modul tidak memuat ulang halaman (rail tetap, tanpa kedip putih).

- [ ] **Step 8: Commit**

```bash
git add src/app/\(focus\)/belajar/\[slug\]/materi src/components/features/learning/materi-shell.tsx src/components/features/learning/selesaikan-modul.ts scripts/smoke.mjs
git commit -m "feat(reader): route + shell materi per modul"
```

---

# BAGIAN C — Rute embed vendored

## Task 9: `features/sijago/app/embed/chat/page.tsx`

**Files:**
- Create: `features/sijago/app/embed/chat/page.tsx`

**Interfaces:**
- Consumes: `CapabilityAccessProvider`, `ChatRuntimeProvider`, `ReadingProvider`, `WatchingProvider`, `ChatWorkspace`.
- Produces: `GET /embed/chat?course=<id>&capability=course_study` yang merender chat **tanpa** sidebar.

**Kenapa di luar semua route group:** `(workspace)/layout.tsx` membungkus anaknya tanpa syarat dengan `AppShell sidebar={<WorkspaceSidebar />}`. Berada di `app/embed/` — di luar `(workspace)`, `(utility)`, `(settings)`, `(admin)`, `(auth)` — berarti tidak ada layout mana pun yang menyumbang sidebar. Ini pola yang sudah dipakai `app/handoff/page.tsx`.

- [ ] **Step 1: Buat rute**

Buat `features/sijago/app/embed/chat/page.tsx`:

```tsx
import { Suspense } from "react";
import { CapabilityAccessProvider } from "@/components/access/CapabilityAccessContext";
import { ChatRuntimeProvider } from "@/features/chat";
import { ReadingProvider } from "@/context/ReadingContext";
import { WatchingProvider } from "@/context/WatchingContext";
import ChatWorkspace from "@/features/chat/components/ChatWorkspace";

/**
 * Chat chromeless — dipakai drawer tutor Careevo lewat iframe.
 *
 * Rute ini sengaja berada **di luar semua route group** (`(workspace)`,
 * `(utility)`, `(settings)`, `(admin)`, `(auth)`). Alasannya satu: grup
 * `(workspace)` membungkus anaknya tanpa syarat dengan
 * `AppShell sidebar={<WorkspaceSidebar />}`, dan sidebar itu tidak muat di drawer
 * 300–640px — hasilnya chrome ganda dan transkrip terjepit. Tanpa route group,
 * tidak ada layout yang menyumbang sidebar. `app/handoff/page.tsx` memakai
 * posisi yang sama untuk alasan yang sama.
 *
 * Provider di bawah ini adalah yang **memang** dibutuhkan `ChatWorkspace`, dan
 * keempatnya tidak bergantung pada `AppShell` — sudah diperiksa satu per satu.
 * `AppShellProvider` sendiri dipasang di `app/layout.tsx` (root), jadi rute ini
 * tetap mendapatkannya tanpa sidebar.
 *
 * Kontrak query tidak berubah: `ChatWorkspace` membaca `course` dan `capability`
 * dari `window.location.search`-nya sendiri
 * (`ChatWorkspace.tsx:1398`), jadi `?course=<id>&capability=course_study`
 * sampai apa adanya dari `urlFrameTutorEmbed` di sisi Careevo.
 */
export default function EmbedChatPage() {
  return (
    <CapabilityAccessProvider>
      <Suspense>
        <ChatRuntimeProvider>
          <ReadingProvider>
            <WatchingProvider>
              <div className="h-dvh w-full overflow-hidden">
                <ChatWorkspace />
              </div>
            </WatchingProvider>
          </ReadingProvider>
        </ChatRuntimeProvider>
      </Suspense>
    </CapabilityAccessProvider>
  );
}
```

- [ ] **Step 2: Gate vendored — typecheck + unit + i18n + contracts**

Run:
```bash
cd features/sijago && npm run typecheck && npm run test:unit && npm run i18n:check && npm run contracts:check
```
Expected: PASS keempatnya.

Kalau `contracts:check` gagal, **jangan** ubah `vendor/` atau `contracts/` — itu berarti rute ini menyentuh sesuatu yang digenerate. Hentikan dan laporkan.

- [ ] **Step 3: Build vendored**

Run: `cd features/sijago && npm run build`
Expected: PASS.

- [ ] **Step 4: Restart server `:3790`**

`:3790` menyajikan `.next/standalone` — build saja tidak cukup, dan proses lama berjalan dari cwd yang sudah dihapus.

```bash
ss -ltnp | grep ':3790' | grep -oP 'pid=\K[0-9]+' | head -1 | xargs -r kill
cd features/sijago && nohup node .next/standalone/server.js > /tmp/ai-mastery.log 2>&1 &
sleep 3 && ss -ltnp | grep ':3790'
```

Expected: port `:3790` listening lagi.

- [ ] **Step 5: Verifikasi rute embed di browser**

Rute ini butuh sesi AI Mastery, jadi verifikasi paling andal lewat Careevo (Task 8 sudah menyediakan tombolnya). Buka reader, tekan tombol tutor.

Periksa dengan `frameLocator` (frame-nya cross-origin):
- rute memuat `/embed/chat`
- **tidak ada sidebar** di dalam frame
- transkrip/komposer tampil

Beri jeda ~10–12 detik setelah frame dimuat sebelum berinteraksi — WebSocket belum siap, dan giliran yang dikirim terlalu cepat akan hilang tanpa jejak (tercatat di skill `careevo-sijago`).

- [ ] **Step 6: Commit**

```bash
git add features/sijago/app/embed
git commit -m "feat(ai-mastery): rute chat chromeless untuk drawer tutor"
```

---

# BAGIAN D — Silabus + revalidasi

## Task 10: Halaman kursus menjadi silabus

**Files:**
- Modify: `src/components/features/learning/detail-kursus.tsx`
- Modify: `src/components/features/learning/kursus-subnav.tsx`

**Interfaces:**
- Consumes: `modulUntukSumber` sudah dipakai halaman; tidak ada yang baru.
- Produces: baris modul menautkan ke `/belajar/[slug]/materi/[id]`.

- [ ] **Step 1: Ganti tombol expand menjadi tautan**

Di `detail-kursus.tsx`, ganti blok tombol "Buka materi"/"Tutup materi" (`:565–590`) dengan tautan ke reader:

```tsx
{punyaIsi ? (
  <Link
    href={`/belajar/${kursus.slug}/materi/${m.id}`}
    className="font-medium text-[#0056D2] hover:underline"
  >
    Buka materi
  </Link>
) : (
  <a href={m.url} target="_blank" rel="noreferrer" className="font-medium text-[#0056D2]">
    Buka materi ↗
  </a>
)}
```

- [ ] **Step 2: Buang state akordeon dan render inline**

Hapus dari `detail-kursus.tsx`:
- `const [modulTerbuka, setModulTerbuka] = useState<string | null>(null);`
- `const [halamanTerpilih, setHalamanTerpilih] = useState<string | null>(null);`
- variabel `terbuka`, `halamanAktif`
- seluruh blok `{terbuka && punyaIsi ? ( … ) : null}` (render `HalamanView`, `KuisView`, `MateriView`, `CourseSessionGate`)
- impor yang menjadi mati: `HalamanView`, `MateriView`, `KuisView`, `KejadianPanel`

Jalankan `npm run lint` untuk menemukan impor mati yang tersisa.

- [ ] **Step 3: Pindahkan indikator sesi keluar dari daftar modul**

`CourseSessionPrompt`/`CourseSessionIndicator`/`KejadianPanel` sebelumnya dirender di atas daftar modul (`:531–541`). Di silabus, pertahankan `CourseSessionPrompt` + `CourseSessionIndicator` (peserta harus tetap bisa memulai sesi dari silabus), tetapi **hapus** `KejadianPanel` dari sini — panel itu pindah ke reader bersama sesinya. Tambahkan komentar singkat yang menyebut alasan itu.

- [ ] **Step 4: Arahkan CTA ke reader**

Di `kursus-subnav.tsx`, ganti `href="#kurikulum"` (`:78`) menjadi tautan ke modul pertama yang belum selesai. Tambahkan prop `hrefLanjut: string` dan pakai itu; pemanggil di `detail-kursus.tsx` menghitungnya:

```tsx
const modulBerikutnya = modul.find((m) => !selesaiValid.includes(m.id)) ?? modul[0];
const hrefLanjut = modulBerikutnya
  ? `/belajar/${kursus.slug}/materi/${modulBerikutnya.id}`
  : "#kurikulum";
```

Lakukan hal yang sama pada CTA sidebar "Lanjutkan belajar" (`detail-kursus.tsx:726`) dan tombol di `KursusSubNav`.

- [ ] **Step 5: Typecheck, lint, build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS. Build wajib — `detail-kursus.tsx` adalah komponen klien, dan impor server-only yang tersisa baru ketahuan di sini.

- [ ] **Step 6: Verifikasi manual**

Buka `/belajar/r1`. Periksa: tidak ada lagi akordeon yang membuka di tempat · setiap baris modul menautkan ke reader · "Lanjutkan" mengarah ke modul pertama yang belum selesai.

- [ ] **Step 7: Commit**

```bash
git add src/components/features/learning/detail-kursus.tsx src/components/features/learning/kursus-subnav.tsx
git commit -m "refactor(kursus): halaman kursus menjadi silabus"
```

---

## Task 11: Revalidasi route reader

**Files:**
- Modify: `src/actions/learning.ts` (dekat `:392`)
- Modify: `src/actions/enrollment.ts` (dekat `:254`)

**Interfaces:**
- Consumes: `safeRevalidate(path: string)` (sudah ada di kedua berkas).
- Produces: tidak ada ekspor baru; efek samping revalidasi.

**Kenapa:** kedua action me-revalidate `/belajar` dan `/belajar/${slug}`, tetapi reader adalah halaman **lain**. Tanpa ini, tanda centang di rail bisa basi pada navigasi lunak.

- [ ] **Step 1: Tambahkan revalidasi di `selesaikanMateriAction`**

Di `src/actions/learning.ts`, setelah `safeRevalidate(\`/belajar/${kursus.slug}\`);`:

```ts
  // Reader adalah halaman lain: tanpa ini, rail-nya bisa tetap menampilkan
  // modul yang baru saja diselesaikan sampai muat ulang penuh.
  safeRevalidate(`/belajar/${kursus.slug}/materi/${input.modulId}`);
```

- [ ] **Step 2: Tambahkan revalidasi di `tandaiModulAction`**

Di `src/actions/enrollment.ts`, setelah `safeRevalidate(\`/belajar/${target.slug}\`);`:

```ts
  // Sama seperti `selesaikanMateriAction`: reader punya route sendiri, jadi
  // tanda centang di rail butuh revalidasi route itu, bukan hanya halaman kursus.
  safeRevalidate(`/belajar/${target.slug}/materi/${modulId}`);
```

- [ ] **Step 3: Jalankan test action**

Run: `npx vitest run src/actions/learning.test.ts src/actions/enrollment.test.ts`
Expected: PASS. `safeRevalidate` sudah menelan kegagalan di luar lifecycle request, jadi unit test tidak boleh pecah.

- [ ] **Step 4: Commit**

```bash
git add src/actions/learning.ts src/actions/enrollment.ts
git commit -m "fix(reader): revalidasi route materi setelah penyelesaian modul"
```

---

## Task 12: Gate akhir

**Files:** tidak ada berkas baru.

- [ ] **Step 1: Gate Careevo**

Run: `npm run check`
Expected: PASS (typecheck → lint → skills:check → test).

- [ ] **Step 2: Build Careevo**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Gate vendored**

Run:
```bash
cd features/sijago && npm run typecheck && npm run test:unit && npm run i18n:check && npm run contracts:check && npm run build
```
Expected: PASS.

- [ ] **Step 4: Pastikan seluruh stack hidup**

Run: `ss -ltnp | grep -E ':(3000|3790|8011|5432)\b'`
Expected: keempat port listening. **Pakai `ss`, bukan probe `/dev/tcp`** — probe itu memberi false negative di mesin ini.

Kalau `:3790` mati, restart dari `.next/standalone` (Task 9 Step 4).

- [ ] **Step 5: Smoke**

Run: `npm run smoke -- http://localhost:3000`
Expected: PASS, termasuk route reader baru.

- [ ] **Step 6: Verifikasi akhir di browser**

Buka `/belajar/r1` → tekan modul → periksa rail, pane, dan bar fokus → tekan tombol tutor → periksa drawer memuat `/embed/chat` tanpa sidebar → tekan "Tandai selesai" → periksa tanda centang muncul di rail setelah refresh lunak.

- [ ] **Step 7: Commit (bila ada perbaikan)**

```bash
git add -A
git commit -m "chore(reader): perbaikan dari verifikasi akhir"
```

---

## Catatan Penutup untuk Pelaksana

**Tiga jebakan yang paling mungkin menggigit:**

1. **Jangan pindahkan shell ke `page.tsx`.** Kalau `CourseSessionProvider` dan `TutorDrawer` tidak berada di `layout.tsx`, berpindah modul akan me-remount keduanya — sesi hilang, WebSocket putus, transkrip hilang. Ini alasan §3.1 ada.

2. **Jangan bongkar iframe saat drawer ditutup.** `buka ? <iframe/> : null` terlihat wajar dan **salah** di sini. DeepTutor melakukannya karena state-nya ada di provider di atas; kita tidak punya lapisan itu.

3. **`npx next typegen` setelah menambah route.** `next dev` tidak andal menyegarkan `.next/types`, dan `validator.ts` yang basi akan merusak `npm run typecheck` dengan galat yang menyesatkan.

**Yang sengaja tidak dikerjakan:** aturan AI per modul (butuh migrasi + perubahan mesin akses), posisi baca/modul yang dikirim ke AI Mastery (kontrak `course_study` hanya mengikat kursus), drawer di halaman silabus, dan chat baru di Careevo.
