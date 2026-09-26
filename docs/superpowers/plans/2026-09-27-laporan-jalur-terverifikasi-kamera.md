# Laporan Jalur `terverifikasi_kamera` Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Task-by-task, with a review between each.

**Goal:** Menutup dua jurang yang ditinggalkan Task 4 — (1) `wajib_kamera` **belum ditegakkan di server**, sehingga course yang menuntut kamera masih bisa diselesaikan lewat `selesaikanMateriAction` tanpa kamera; dan (2) laporan belum menyatakan apa yang arti `terverifikasi` pada course `wajib_kamera` maupun `wajib` biasa, sehingga dua jalur dengan kekuatan bukti berbeda tampil dengan label yang sama.

**Architecture:** Dua bagian yang dipisah karena risikonya berbeda. **Bagian A adalah perbaikan bug**: `selesaikanMateriAction` memanggil `putuskanAkses` tanpa `adaBuktiKamera`, jadi cabang `perlu_kamera` yang baru saja dibuat di Task 4 tidak pernah menyala di server — hanya di UI. Bukti kamera diturunkan dari **run yang sedang diverifikasi** (`bukti.id`), bukan dari klaim klien: run sudah dibaca server sebagai bagian dari `buktikanSesiDb`, dan `kamera_mulai` di dalamnya adalah satu-satunya bukti yang bisa-diaudit. **Bagian B adalah pengungkapan**: `completion_path` tetap dua nilai (CHECK constraint), tetapi laporan menurunkan label jalurnya — `terverifikasi_kamera` bila run yang mendasari punya `kamera_mulai`, selain itu `terverifikasi` — dan menyatakan perbedaan maknanya.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest 5 (node env, tanpa jsdom), Drizzle ORM + PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-27-lapisan-pengawasan-anti-curang-design.md` — lihat §"Kamera tidak menambah nilai `completion_path`" (baris 169–186) dan P3 (baris 88–99).

**Preseden yang dipakai:** `docs/superpowers/plans/2026-09-27-lapisan-pengawasan-anti-curang.md` Task 8 (baris 1997+) sudah menjadwalkan `perAsal` + `asal` di laporan. Plan ini **tidak** mengulanginya; ia menjawab pertanyaan yang Task 8 tidak jawab: *jalur penyelesaian* yang bukan *asal sinyal*.

---

## Global Constraints

- **Copy berbahasa Indonesia** (`id`) dan `<html lang>` tetap `id`.
- **Tidak ada kata vonis** (`curang`, `menyalin`, `mencontek`, `penyalahgunaan`, `bersalah`) di label maupun detail laporan. `integritas.test.ts` sudah menjaga `temuanSesi`; aturan yang sama berlaku untuk label jalur di plan ini.
- **`completion_path` tetap dua nilai** (`terverifikasi`, `informal`). Kolomnya punya CHECK constraint di tiga tabel (`schema.ts:473`). **Jangan** menambah nilai ketiga di database — label turunan hidup di layer laporan.
- **`hitungCompletionPath` tidak berubah.** Ia hanya membaca `module_progress.completion_path`; menambah nilai di sana berarti mengubah keputusan yang sudah ada dan diuji, bukan menurunkan label tampilan.
- **Tidak ada `dangerouslySetInnerHTML`.**
- Modul yang disentuh harus tetap murni atau server-only seperti catatan aslinya. `sumber-sinyal.ts`, `akses.ts`, `kebijakan.ts` adalah bundel klien — satu impor nilai `node:fs` menjatuhkan build.
- Ikuti langkah merah→hijau per task. Kalau sebuah mutasi tidak membuat test merah, test itu tidak menutup logikanya.
- Jalankan `npm run typecheck` + `npm run lint` + `npm test` + `npm run build` sebelum commit. Gate sudah hijau di commit `081bc03` — jangan biarkan berubah.

---

## Mengapa dua bagian, dan urutannya

Bagian A (bug) harus lebih dulu. Alasannya bukan sekadar "yang penting dulu", melainkan karena **Bagian B membuat klaim tentang bukti yang hanya benar kalau A benar**. Kalau laporan menyatakan "jalur `terverifikasi` pada course `wajib_kamera` berarti kamera hidup" sementara server sebenarnya tidak pernah menolak penyelesaian tanpa kamera, laporan itu **berbohong dengan cara yang terlihat otoritatif** — justru jenis yang paling merusak kredibilitas. Jadi A memperbaiki mekanisme, B menyatakan mekanismenya.

---

# BAGIAN A — Menegakkan `wajib_kamera` di server (perbaikan bug)

## Task A1: `adaBuktiKamera` di `selesaikanMateriAction`

**Files:**
- Modify: `src/actions/learning.ts:266-274` (pemanggilan `putuskanAkses` + penanganan `perlu_kamera`)
- Modify: `src/actions/learning.test.ts`

**Interfaces:**
- Consumes: `putuskanAkses` (varians `perlu_kamera` sudah ada dari Task 4), `listEventRun` (sudah diimpor di `learning.ts:13`).
- Produces: `selesaikanMateriAction` menolak `perlu_kamera`; helper lokal `kameraMenyalaPadaRun(runId)`.

- [ ] **Step 1: Write the failing tests**

`src/actions/learning.test.ts` sudah punya `store.events` + mock `listEventRun` (baris 23–31, 201–204), jadi test ini tidak butuh harness baru. Tambahkan di dalam `describe("selesaikanMateriAction", ...)`:

```ts
describe("selesaikanMateriAction — gerbang wajib_kamera", () => {
  /** Course `wajib_kamera`: kebijakan disimpan, bukan default. */
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
    // Bukti kamera diturunkan dari **run**, jadi yang diperiksa test ini adalah
    // kejadian `kamera_mulai` pada run itu — bukan boolean yang dikirim klien.
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

Tambahkan import `catatKejadianAction` ke baris destructure yang sudah ada (baris 206):

```ts
const { mulaiSesiAction, catatKejadianAction, selesaikanMateriAction, akhiriSesiAction } =
  await import("./learning");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/actions/learning.test.ts`
Expected: FAIL — karena gerbang belum ada, test pertama mendapat `hasil.ok === true` (test mengharapkan `false`) dan `tandaiModulDb` terpanggil.

> Kalau test **hijau** sebelum implementasi, hentikan dan laporkan: itu berarti gerbang sudah ada di tempat lain dan plan ini salahunderstanding.

- [ ] **Step 3: Verify `kebijakan` is actually stored by the test helper**

`updateCourse` di store mungkin memvalidasi kebijakan lewat `kebijakanCourseSchema`. Pastikan `wajib_kamera` sudah diterima (Task 4 menambahkan nilai itu ke `ATURAN_PENGAWASAN`). Kalau `updateCourse` menolak, cari cara yang dipakai test lain untuk menyunting kebijakan course — `src/lib/courses/store.test.ts:192` sudah melakukannya.

- [ ] **Step 4: Implement the gate**

`listEventRun` **sudah** diimpor di `src/actions/learning.ts:13` (`import { ambilRun, listEventRun } from "@/lib/learning/repository";`) — tidak perlu import baru.

Tambahkan helper modul-level (dekat `kebijakanKursus`, sebelum `mulaiSesiAction`):

```ts
/**
 * Apakah run yang sedang diverifikasi punya bukti kamera menyala.
 *
 * **Diturunkan dari run, bukan dari klaim pemanggil.** `kamera_mulai` ditulis
 * ke `learning_events` saat kamera benar-benar menyala, dan run itu sudah dibaca
 * server di `buktikanSesiDb` — jadi ini bukti yang bisa diaudit, bukan parameter
 * yang bisa diisi `true` oleh klien. run yang tidak bisa dibaca menghasilkan
 * `false` (gagal-tertutup): bukti yang tidak bisa diperiksa tidak boleh
 * dianggap memenuhi syarat.
 */
async function kameraMenyalaPadaRun(runId: string): Promise<boolean> {
  const kejadian = await listEventRun(runId);
  return kejadian.some((k) => k.kind === "kamera_mulai");
}
```

Lalu di `selesaikanMateriAction`, ganti pemanggilan `putuskanAkses` (baris 266–274):

```ts
  // Bukti kamera dibaca dari run **setelah** `bukti` terverifikasi: tanpa run
  // yang sah tidak ada catatan yang bisa diperiksa, jadi urutan ini mencegah
  // satu query sia-sia pada course yang tidak butuh kamera.
  const kameraMenyala = bukti ? await kameraMenyalaPadaRun(bukti.id) : false;

  // Pemanggil tidak menyaring berdasarkan ada/tidaknya bukti: keputusannya
  // serahkan ke `putuskanAkses` di sini. `keputusan.tipe` selalu `bebas` untuk
  // course `opsional` (lihat `wajibSesiTerverifikasi`), jadi rute klien yang
  // mengirim permintaan ini pada course `opsional` tidak ikut ditolak.
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

> Perhatikan `if (keputusan.tipe === "perlu_kamera")` — **itu inti Task A1**. Tanpa baris ini, `putuskanAkses` mengembalikan `perlu_kamera` tetapi action mengabaikannya dan tetap menulis progres `terverifikasi` (bug yang ada hari ini).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/actions/learning.test.ts`
Expected: PASS — tiga test baru hijau, tidak ada test lama yang berubah.

- [ ] **Step 6: Verify the test actually covers the gate (mutation check)**

Ubah `kameraMenyala` menjadi `const kameraMenyala = true;` (hardcode) dan konfirmasi test "menolak…tanpa kamera menyala" jadi merah. Kembalikan. Lalu hapus baris `if (keputusan.tipe === "perlu_kamera")` dan konfirmasi test yang sama jadi merah lagi. **Kedua mutasi harus merah** — kalau salah satu hijau, gerbangnya tidak tertutup test.

- [ ] **Step 7: Run the gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: semuanya hijau.

- [ ] **Step 8: Commit**

```bash
git add src/actions/learning.ts src/actions/learning.test.ts
git commit -m "fix(learning): tegakkan gerbang wajib_kamera di selesaikanMateriAction"
```

---

# BAGIAN B — Menyatakan arti jalur di laporan

Bagian ini **tidak** menambah nilai `completion_path`. Ia menurunkan label tampilan dari run yang mendasari.

## Task B1: Fungsi turunan `jalurDariRun`

**Files:**
- Create: `src/lib/performa/jalur-selesai.ts`
- Create: `src/lib/performa/jalur-selesai.test.ts`

**Interfaces:**
- Consumes: `KJenisKejadian` (dari `@/lib/learning/akses`).
- Produces:
  - `type JalurTerlihat = "terverifikasi_kamera" | "terverifikasi" | "informal"`
  - `type SumberJalur = "sesi" | "kuis"` (asal baris progres: `evidence_id` menunjuk run sesi **atau** attempt kuis).
  - `function jalurDariRun(input: { completionPath: string | null; adaKameraMulai: boolean }): JalurTerlihat`
  - `const LABEL_JALUR: Record<JalurTerlihat, string>`

- [ ] **Step 1: Write the failing test**

`src/lib/performa/jalur-selesai.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LABEL_JALUR, jalurDariRun } from "./jalur-selesai";

describe("jalurDariRun", () => {
  it("menandai jalur terverifikasi yang ditopang kamera", () => {
    // Inilah makna `terverifikasi` pada course `wajib_kamera`: bukan sekadar
    // "ada sesi", tapi "ada sesi DAN kamera menyala".
    expect(jalurDariRun({ completionPath: "terverifikasi", adaKameraMulai: true })).toBe(
      "terverifikasi_kamera",
    );
  });

  it("menandai jalur terverifikasi tanpa kamera sebagai terverifikasi biasa", () => {
    // Course `wajib` biasa: jalur ini tidak membuktikan apa pun soal kamera.
    expect(jalurDariRun({ completionPath: "terverifikasi", adaKameraMulai: false })).toBe(
      "terverifikasi",
    );
  });

  it("tidak pernah menaikkan jalur yang tidak menyatakan dirinya terverifikasi", () => {
    // Fail-closed: `informal` dan `null` tidak boleh menjadi `terverifikasi_*`
    // apa pun, walaupun kamera kebetulan menyala.
    for (const completionPath of ["informal", null, "", "terverifikasi_kamera"]) {
      expect(jalurDariRun({ completionPath, adaKameraMulai: true })).toBe("informal");
      expect(jalurDariRun({ completionPath, adaKameraMulai: false })).toBe("informal");
    }
  });

  it("tidak memakai kata vonis di labelnya", () => {
    for (const label of Object.values(LABEL_JALUR)) {
      for (const kata of ["curang", "menyalin", "mencontek", "penyalahgunaan", "bersalah"]) {
        expect(label.toLowerCase()).not.toContain(kata);
      }
    }
  });

  it("menyatakan perbedaan makna antara kedua jalur terverifikasi", () => {
    // Dua label harus **berbeda** dan keduanya harus menyebut kamera, karena
    // seluruh gunanya adalah memberi tahu pembaca bahwa dua jalur ini tidak
    // setara. Label yang identik membuat pengungkapan ini jadi tidak ada.
    expect(LABEL_JALUR.terverifikasi_kamera).not.toBe(LABEL_JALUR.terverifikasi);
    expect(LABEL_JALUR.terverifikasi_kamera.toLowerCase()).toContain("kamera");
    expect(LABEL_JALUR.terverifikasi.toLowerCase()).toContain("kamera");
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
 * tabel (`schema.ts:473`), dan menambah nilai ketiga berarti migrasi yang
 * menyentuh setiap pembaca. Yang ditambahkan di sini adalah **label**, bukan
 * nilai: label bisa menyatakan lebih dari yang bisa disimpan kolom.
 *
 * Bedanya nyata dan penting:
 *
 * - `terverifikasi_kamera` — sesi terverifikasi **dan** kamera menyala selama
 *   run itu. Hanya mungkin pada course `wajib_kamera`, karena course `wajib`
 *   tidak pernah menolak penyelesaian tanpa kamera.
 * - `terverifikasi` — sesi terverifikasi, kamera mungkin tidak pernah menyala.
 * - `informal` — tidak ada bukti sesi yang sah. Jalur ini tidak pernah
 *   dinaikkan, apa pun yang terjadi di run.
 *
 * Fungsi ini **tidak** mengembalikan skor, tingkat bahaya, atau vonis. Ia hanya
 * menyatakan bukti apa yang ada di depan pembaca.
 */

export type JalurTerlihat = "terverifikasi_kamera" | "terverifikasi" | "informal";

/**
 * Kalimat yang dipakai laporan untuk menyebut masing-masing jalur.
 *
 * `terverifikasi` **sengaja** menyebut kamera juga — "tanpa kamera" dibaca
 * sebagai "kamera tidak pernah menyala", yang benar untuk course `wajib`, tapi
 * kalimat itu tidak berlaku untuk course `opsional` yang tidak butuh sesi
 * sama sekali. Karena itu keduanya memakai bentuk "kamera mungkin tidak
 * menyala", yang jujur di kedua kasus.
 */
export const LABEL_JALUR: Record<JalurTerlihat, string> = {
  terverifikasi_kamera: "lewat sesi terverifikasi dengan kamera menyala",
  terverifikasi: "lewat sesi terverifikasi (kamera mungkin tidak menyala)",
  informal: "tanpa sesi terverifikasi",
};

export function jalurDariRun(input: {
  completionPath: string | null;
  adaKameraMulai: boolean;
}): JalurTerlihat {
  // Fail-closed: hanya `terverifikasi` yang eksak boleh dinaikkan. Nilai lain —
  // termasuk `null` dari baris lama dan slug yang tidak dikenal — turun ke
  // `informal`, karena bukti yang tidak menyatakan dirinya terverifikasi tidak
  // boleh diangkat.
  if (input.completionPath !== "terverifikasi") return "informal";
  return input.adaKameraMulai ? "terverifikasi_kamera" : "terverifikasi";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/performa/jalur-selesai.test.ts`
Expected: PASS — 5 test.

- [ ] **Step 5: Mutation check**

Ubah `if (input.completionPath !== "terverifikasi") return "informal";` menjadi return `"terverifikasi"` dan konfirmasi test "tidak pernah menaikkan jalur…" jadi merah. Kembalikan.

- [ ] **Step 6: Commit**

```bash
git add src/lib/performa/jalur-selesai.ts src/lib/performa/jalur-selesai.test.ts
git commit -m "feat(performa): label jalur selesai diturunkan dari run (bukan kolom)"
```

---

## Task B2: Bawa bukti kamera ke laporan per-kursus

**Files:**
- Modify: `src/lib/learning/dashboard.ts:144-150` (`BarisSelesaiModul`) dan `detailPembelajaranDariDb` (198–255)
- Modify: `src/lib/learning/dashboard.test.ts`
- Modify: `src/app/(verifikator)/performa/[owner]/page.tsx:78-89`

**Interfaces:**
- Consumes: `jalurDariRun`, `LABEL_JALUR` (Task B1).
- Produces: `BarisSelesaiModul` + `jalur: JalurTerlihat`; `detailPembelajaranDariDb` menerima `kameraMulai?: ReadonlyMap<string, boolean>` (runId → ada `kamera_mulai`).

- [ ] **Step 1: Write the failing test**

`src/lib/learning/dashboard.test.ts` — cari describe `detailPembelajaranDariDb` yang sudah ada dan tambahkan:

Helper yang **sudah ada** di `dashboard.test.ts`: `enrollment(...)` (membangun `EnrollmentStaf`, default `courseId: "crs-1"`) dan `progres(enrollmentId, moduleId, completionPath, state)` — yang **`evidenceId`-nya selalu `null`**. Karena test ini butuh `evidenceId` yang menunjuk run, tambahkan helper kecil di dekat `progres`:

```ts
/** `progres` dengan `evidenceId` yang menunjuk run — jalur diturunkan dari situ. */
function progresDenganRun(
  enrollmentId: string,
  moduleId: string,
  completionPath: "terverifikasi" | "informal" | null,
  evidenceId: string | null,
): ModuleProgressRow {
  return { ...progres(enrollmentId, moduleId, completionPath), evidenceId };
}
```

Lalu test-nya:

```ts
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

it("progres tanpa peta kamera tetap memakai jalur yang tersimpan", () => {
  // Halaman yang tidak mengirim peta, dan baris lama tanpa `evidence_id`, harus
  // tetap benar — bukan melempar, dan bukan mengarang bukti kamera.
  const hasil = detailPembelajaranDariDb({
    enrollments: [enrollment(ENR)],
    progress: [progresDenganRun(ENR.id, "crs-1-m1", "terverifikasi", null)],
    attempts: [],
  });
  expect(hasil?.kursus[0]?.selesai[0]?.jalur).toBe("terverifikasi");
});
```

> `EMAIL_A`, `USER_A` sudah ada di berkas itu (baris 22–25). `enrollment(...)` menerima **satu objek** — jangan memanggilnya dengan argumen posisional.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/learning/dashboard.test.ts`
Expected: FAIL — `jalur` belum ada di `BarisSelesaiModul`.

- [ ] **Step 3: Implement**

Di `src/lib/learning/dashboard.ts`:

Tambahkan import:

```ts
import { jalurDariRun, type JalurTerlihat } from "@/lib/performa/jalur-selesai";
```

Ubah `BarisSelesaiModul`:

```ts
/** Satu baris progres modul, dalam kosakata yang dirender (`sumber`/`at`). */
export interface BarisSelesaiModul {
  modul_id: string;
  /** Jalur tak dikenal turun ke "informal" — klaim tidak dinaikkan. */
  sumber: "terverifikasi" | "informal";
  /**
   * Jalur **yang terlihat di laporan** — diturunkan dari `sumber` plus bukti
   * kamera pada run yang mendasarinya. Tidak pernah lebih kuat dari `sumber`:
   * `jalurDariRun` menurunkan apa pun yang bukan `terverifikasi` ke `informal`.
   */
  jalur: JalurTerlihat;
  at: string;
}
```

Ubah signature `detailPembelajaranDariDb`:

```ts
export function detailPembelajaranDariDb(input: {
  enrollments: EnrollmentStaf[];
  progress: ModuleProgressRow[];
  attempts: AttemptDashboard[];
  judul?: ReadonlyMap<string, string>;
  /**
   * `run id` → apakah run itu punya kejadian `kamera_mulai`.
   *
   * Opsional supaya pemanggil yang tidak punya akses ke kejadian run (halaman
   * yang tidak memuat integritas) tetap bekerja: tanpa peta ini, jalur diturunkan
   * dari `completion_path` saja dan `terverifikasi` berarti "tanpa bukti kamera
   * yang tersedia" — bukan "kamera pasti tidak menyala".
   */
  kameraMulai?: ReadonlyMap<string, boolean>;
}): DetailPembelajaran | null {
```

Dan di loop progres (baris 220–229):

```ts
  for (const baris of input.progress) {
    if (baris.state !== "completed") continue;
    const courseId = courseDariEnrollment.get(baris.enrollmentId);
    if (!courseId) continue;
    const sumber = baris.completionPath === "terverifikasi" ? "terverifikasi" : "informal";
    perKursus.get(courseId)?.selesai.push({
      modul_id: baris.moduleId,
      sumber,
      jalur: jalurDariRun({
        completionPath: baris.completionPath,
        adaKameraMulai: Boolean(baris.evidenceId && input.kameraMulai?.get(baris.evidenceId)),
      }),
      at: iso(baris.completedAt),
    });
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/learning/dashboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Show it in the report UI**

Di `src/app/(verifikator)/performa/[owner]/page.tsx`, ganti import `LABEL_SUMBER` dengan:

```ts
import { LABEL_JALUR } from "@/lib/performa/jalur-selesai";
import { listEventRun, listEnrollmentStaf, listProgresSemua, listAttemptSemua } from "@/lib/learning/repository";
import { listRunStaf } from "@/lib/learning/run-service";
```

Halaman ini **sudah** punya `owner` (email, sudah di-`decodeURIComponent` di baris 31) dan sudah memfilter enrollment dengan normalisasi `.trim().toLowerCase()` (baris 41–43). Tambahkan pengambilan run **milik peserta itu saja** dan peta kameranya:

```ts
  const [semua, progress, attempts] = await Promise.all([
    listEnrollmentStaf(),
    listProgresSemua(),
    listAttemptSemua(),
  ]);
```

```ts
  // Flag `kamera_mulai` per run milik peserta ini — bukan catatan integritas.
  // Halaman ini sengaja tidak memuat temuan/hitungan kejadian (lihat catatan
  // di `PageHead`), dan yang dibutuhkan di sini hanya satu fakta: apakah run
  // yang mendasari penyelesaian ini punya kamera menyala. Kejadiannya dibaca
  // dari database sehingga bisa diaudit.
  //
  // `listRunStaf()` mengembalikan **semua** run tanpa gate, jadi filter owner di
  // sini bukan sekadar cosmestik: tanpa filter, satu halaman memuat flag kamera
  // seluruh peserta.
  const kunci = owner.trim().toLowerCase();
  const emailPerUser = new Map(semua.map((b) => [b.user.userId, b.user.email]));
  const runPeserta = (await listRunStaf()).filter(
    (run) => (emailPerUser.get(run.userId) ?? "").trim().toLowerCase() === kunci,
  );
  const petaKamera = new Map<string, boolean>();
  for (const run of runPeserta) {
    const kejadian = await listEventRun(run.id);
    petaKamera.set(run.id, kejadian.some((k) => k.kind === "kamera_mulai"));
  }
```

Lalu teruskan ke `detailPembelajaranDariDb`:

```ts
  const record = detailPembelajaranDariDb({
    enrollments,
    progress,
    attempts,
    kameraMulai: petaKamera,
  });
```

Dan ubah baris label (sekarang baris 86):

```tsx
                        selesai {LABEL_JALUR[s.jalur]} · {s.at}
```

> `performa-belajar.tsx` (daftar peserta) **tidak** ikut diubah di sini: `BarisPembelajaran` cuma punya hitungan `terverifikasi`, bukan daftar modul, jadi tidak ada run yang bisa dipetakan tanpa perubahan bentuk data yang lebih besar. Itu catatannya di Task C1, bukan lisensi untuk mengarang.

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: semuanya hijau. `npm run build` wajib di sini — ini perubahan server-rendering yang menyentuh pemanggilan DB.

- [ ] **Step 7: Commit**

```bash
git add src/lib/learning/dashboard.ts src/lib/learning/dashboard.test.ts "src/app/(verifikator)/performa/[owner]/page.tsx"
git commit -m "feat(performa): laporan menyatakan arti jalur terverifikasi (kamera atau tidak)"
```

---

# BAGIAN C — Dokumentasi

## Task C1: Perbarui catatan di spec & AGENTS.md

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-lapisan-pengawasan-anti-curang-design.md` (§"Kamera tidak menambah nilai `completion_path`", baris 169–186)
- Modify: `AGENTS.md`

- [ ] **Step 1: Record the decided rule**

Di spec, tambahkan catatan bahwa konsekuensi **sudah diimplementasikan** dan di mana: `jalurDariRun` di `src/lib/performa/jalur-selesai.ts` menurunkan label; `completion_path` tetap dua nilai; dan gerbang `wajib_kamera` ditegakkan server di `selesaikanMateriAction` dari bukti `kamera_mulai` pada run (bukan klaim klien).

Di `AGENTS.md`, tambahkan satu baris ke bagian Architecture yang menyebut: label jalur di laporan diturunkan dari run, dan `wajib_kamera` ditegakkan dari `kamera_mulai` — supaya agent berikutnya tidak "menyederhanakan" dengan mengulang nilai ke dalam kolom.

**Juga catat dua hal yang sengaja tidak dikerjakan**, supaya tidak dianggap terlewat dan diisi ulang nanti:

1. `performa-belajar.tsx` (daftar peserta) masih menampilkan `LABEL_SUMBER.terverifikasi` yang generik. `BarisPembelajaran` hanya punya **hitungan**, bukan daftar modul, jadi tidak ada run yang bisa dipetakan tanpa mengubah bentuk datanya lebih dulu. Angka "3 lewat sesi terverifikasi" di daftar tetap jujur; yang belum ada adalah rincian per-modul di halaman detail.
2. `SumberPenyelesaian` di `src/lib/performa/store.ts` tidak mendapat nilai `terverifikasi_kamera`. Tipe itu adalah bentuk data **yang tersimpan** di `.data/performa`, bukan bentuk tampilan; menambah nilainya mengubah kontrak JSON yang sudah punya pembaca, dan label turunan di `jalur-selesai.ts` sudah menutup kebutuhannya.

- [ ] **Step 2: Run the gate**

Run: `npm run check`
Expected: hijau (`skills:check` memvalidasi `.agents/skills/`; dokumen ini bukan skill, jadi yang diperiksa adalah `tsc`/`eslint`/test tetap hijau).

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md docs/superpowers/specs/2026-09-27-lapisan-pengawasan-anti-curang-design.md
git commit -m "docs: catat aturan label jalur terverifikasi dan gerbang wajib_kamera"
```

---

## Yang TIDAK dikerjakan di plan ini (sengaja)

- **`completion_path` tidak menjadi tiga nilai.** CHECK constraint di tiga tabel; label turunan cukup.
- **`hitungCompletionPath` tidak diubah.** Ia membaca `module_progress`, bukan run; logikanya sudah benar dan sudah diuji.
- **Tidak ada skor/bahaya/reputasi baru.** Aturan repo: sinyal integritas tidak pernah menurunkan skor.
- **Tidak ada bandingan human-review** — itu spec terpisah (`2026-09-25-temuan-integritas-dan-banding-design.md`), belum diimplementasikan.
- **Tidak ada `terverifikasi_kamera` di `SumberPenyelesaian`.** Tipe itu adalah bentuk data yang tersimpan (`.data/performa`), bukan tampilan; menambah nilainya berarti mengubah kontrak JSON yang sudah ada pembacanya.

## Verifikasi manual (wajib, bersama `careevo-browser-verify`)

Tiga klaim di sini **harus** diukur di browser, bukan dibaca:

1. `/performa/<email>` untuk peserta yang punya penyelesaian `terverifikasi` **dengan** `kamera_mulai` → label memuat "dengan kamera menyala".
2. Peserta yang penyelesaiannya `terverifikasi` **tanpa** `kamera_mulai` → label memuat "kamera mungkin tidak menyala".
3. Course `wajib_kamera`: menyelesaikan modul dengan sesi sah tapi tanpa `kamera_mulai` → **ditolak** dengan pesan kamera, dan `tandaiModulDb` tidak menulis.

Kalau harness browser tidak tersedia di environment itu, nyatakan terus terang di laporan bahwa ketiga klaim itu **belum diverifikasi** — jangan menulis "sudah dites" untuk yang hanya dibaca.
