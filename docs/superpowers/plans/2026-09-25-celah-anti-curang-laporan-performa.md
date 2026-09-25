# Penutup Celah Anti-Curang & Laporan Performa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup dua celah anti-curang yang tersisa (chatbot tidak digerbangi `aturan_bantuan`; sesi tidak pernah kedaluwarsa), lalu membangun laporan performa lintas-pengguna (progres + skor kuis + integritas) yang hanya bisa dibaca verifikator.

**Architecture:** Bagian A tidak menambah konsep baru — ia memakai mesin keputusan `putuskanAkses` yang sudah ada, dan menambahkan masa berlaku pada `SessionRun` yang di-cap dari `batas_waktu_menit` yang juga sudah ada. Bagian B menambah satu toko file per-pemilik di `.data/performa/`, dicerminkan dari satu-satunya penulis progres (`tandaiModul`), ditambah satu aksi penyimpanan skor kuis, dan satu pembaca integritas yang membaca `.data/sessions/` secara langsung tanpa menyalinnya.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest 5 (node env, tanpa jsdom), Tailwind v4 CSS-first, `node:fs/promises`, HMAC-SHA256.

**Spec:** `docs/superpowers/specs/2026-09-25-celah-anti-curang-laporan-performa-design.md`

## Global Constraints

- Nama fungsi logika bisnis mengikuti bahasa berkas (`hitung…`, `bangun…`, `catat…`); kode infra/UI berbahasa Inggris. Ikuti bahasa berkas yang ada.
- Copy pengguna dan `<html lang>` berbahasa Indonesia (`id`).
- **Pola penyimpanan yang berbeda itu disengaja — jangan diseragamkan.** Cookie signed untuk data kecil; `data/courses.json` untuk kurikulum; `.data/` untuk data peserta tak terbatas. Lihat bagian "Arsitektur" di `AGENTS.md`.
- **Tidak boleh ada `dangerouslySetInnerHTML`.** Repo ini tidak punya sanitizer; menambahkannya akan membuka stored XSS.
- Modul yang menyentuh `node:fs` harus tetap **server-only**. Modul klien (`kurikulum.ts`, `kebijakan.ts`, `akses.ts`, `chat-types.ts`) harus tetap **murni** — satu impor nilai dari store menjatuhkan build Turbopack produksi. `npm run build` adalah gerbangnya; `npm run check` bukan.
- **Jangan pernah mengirim `jawaban_benar` ke komponen klien.** Task 6 menambahkan aksi yang menyentuh kuis — jangan bocorkan kunci lewat jalur baru itu.
- Setiap Server Action wajib bergerbang (`getSession()` / `isStaffRole`) dan tidak boleh mempercayai output kebijakan dari klien.
- **Kejadian integritas tidak pernah boleh menurunkan skor atau reputasi.** Dashboard menampilkannya sebagai konteks, dengan label tegas.
- Klaim anti-curang apa pun tetap memuat batas: web + kamera tidak menjamin bebas AI/joki/perangkat kedua.
- Skor kuis di pass ini **dilaporkan klien dan belum dinilai server** — label itu wajib tampil. Jangan menulis "terverifikasi" untuk skor kuis.
- `Vitest` `include` persis `src/**/*.test.ts` — tidak ada `.test.tsx`, tidak ada jsdom. Invarian UI diproteksi lewat static source check di `src/lib/learning/security.test.ts`.
- **Test tidak boleh menulis ke `data/` atau `.data/` milik repo.** Lihat Task 4 untuk pengalihan `CAREEVO_PERFORMA_DIR`.
- Jangan menghapus `.data/` atau `data/` secara massal.
- Jalankan `npm run check` sebelum setiap commit yang menutup satu task.
- Di luar cakupan: kamera, penilaian server untuk kuis, `/dashboard` peserta, middleware route guard, `logAudit`.
- **Jangan push** ke remote tanpa izin eksplisit pengguna.

## Peta File

**Create:**
- `src/lib/performa/store.ts` — toko file per-pemilik (`.data/performa/<sha256(email)>.json`): baca, tulis, indeks lintas-pemilik, cermin progres, catat skor.
- `src/lib/performa/store.test.ts` — tes toko.
- `src/lib/performa/integritas.ts` — pembaca `.data/sessions/` dikelompokkan per-pemilik.
- `src/lib/performa/integritas.test.ts` — tes agregasi integritas.
- `src/actions/performa.ts` — `simpanNilaiKuisAction`.
- `src/actions/performa.test.ts` — tes validasi aksi skor kuis.
- `src/app/(verifikator)/performa/page.tsx` — daftar peserta.
- `src/app/(verifikator)/performa/[owner]/page.tsx` — detail satu peserta.
- `src/components/features/performa/performa-tabel.tsx` — tabel daftar + peringatan wajib.

**Modify:**
- `src/lib/learning/chat-types.ts` — varian state `policy_denied`.
- `src/actions/learning-chat.ts` — gerbang `aturan_bantuan` sebelum `appendStudyMessage`.
- `src/components/features/learning/study-chat.tsx` — dua kondisi menyertai `policy_denied`.
- `src/lib/learning/akses.ts` — `lewatBatas()` (murni).
- `src/lib/learning/akses.test.ts` — tes `lewatBatas()`.
- `src/lib/learning/session.ts` — `berlaku_hingga`, `kedaluwarsa()`, `BATAS_SESI_BAWAAN_MENIT`, `mulaiRun({batasMenit})`, `tandaiKedaluwarsa()`, `cariRunAktif` diekspor, `buktikanSesi` menandai kedaluwarsa, `listRun()` untuk staf.
- `src/lib/learning/session.test.ts` — tes masa berlaku, kedaluwarsa, `listRun`.
- `src/actions/learning.ts` — `mulaiSesiAction` lanjutkan/restart run; `selesaikanMateriAction` tegakkan batas per modul; teruskan `sumber: "terverifikasi"`.
- `src/actions/learning.test.ts` — tes resume/restart + batas percobaan.
- `src/actions/learning-chat.test.ts` — mock `getCourseById` + tes gerbang.
- `src/lib/learning/security.test.ts` — static check gerbang chatbot, kebocoran kunci, label dashboard.
- `src/lib/courses/enrollment.ts` — `tandaiModul(..., sumber)` menulis cermin ke toko performa.
- `src/actions/enrollment.test.ts` — tes cermin progres.
- `src/components/features/learning/kuis-view.tsx` — prop konteks + pengiriman skor.
- `src/components/features/learning/detail-kursus.tsx` — teruskan `courseId`/`modulId` ke `KuisView`.
- `src/components/ui/dashboard-sidebar.tsx` — entri navigasi staf.
- `vitest.config.mts` — `env.CAREEVO_PERFORMA_DIR` ke temp dir.
- `AGENTS.md` — dokumentasikan toko performa.

---

# BAGIAN A — Penutup celah anti-curang

Task 1–3. Masing-masing menghasilkan perangkat lunak yang bisa diuji dan di-commit sendiri. Bagian B tidak bergantung pada Bagian A; keduanya boleh dikerjakan terpisah.

---

## Task 1: Gerbang kebijakan untuk StudyChat

**Files:**
- Modify: `src/lib/learning/chat-types.ts`
- Modify: `src/actions/learning-chat.ts`
- Modify: `src/components/features/learning/study-chat.tsx`
- Modify: `src/actions/learning-chat.test.ts`
- Modify: `src/lib/learning/security.test.ts`

**Interfaces:**
- Consumes (sudah ada): `putuskanAkses({jenisKegiatan, kebijakan, adaBuktiSesi})` dari `@/lib/learning/akses`; `getCourseById(id)` dari `@/lib/courses/store`; `kebijakanDefault()` dari `@/lib/courses/kebijakan`; `readStudyChatSnapshot(owner)` dari `@/lib/learning/chat-store`.
- Produces: varian baru `StudyChatActionState` → `{ status: "policy_denied"; message: string; snapshot: StudyChatSnapshot }`.

**Konteks:** `EntriKatalog` sengaja tidak membawa `kebijakan`, jadi gerbang wajib memuat course lewat `getCourseById`. `kategoriDiblokir` **tidak** dipakai: ia butuh klasifikasi kategori pesan yang tidak ada di `StudyChatMessage`, dan menambah pengklasifikasi LLM berarti menyerahkan keputusan penolakan ke model yang sedang dijaga.

- [ ] **Step 1: Tulis test yang gagal**

Di `src/actions/learning-chat.test.ts`, tambahkan `getCourseById: vi.fn()` ke objek `mocks` (blok `vi.hoisted`, baris 16-33), lalu tambahkan mock modul di antara baris mock lain:

```ts
vi.mock("@/lib/courses/store", () => ({ getCourseById: mocks.getCourseById }));
```

Tambahkan import di kepala berkas:

```ts
import { kebijakanDefault } from "@/lib/courses/kebijakan";
```

Tambahkan helper ini tepat setelah fungsi `setCoursePath` (sekitar baris 199):

```ts
/** Kursus dari store — `EntriKatalog` sengaja tidak membawa `kebijakan`. */
function setKebijakanCourse(aturanBantuan: "bebas" | "bertutor" | "tanpa_ai") {
  mocks.getCourseById.mockResolvedValue({
    id: COURSE.id,
    kebijakan: { ...kebijakanDefault(), aturan_bantuan: aturanBantuan },
  });
}
```

Tambahkan default di dalam `beforeEach` supaya test lama tidak ikut gagal:

```ts
  mocks.getCourseById.mockResolvedValue(undefined);
```

Tambahkan dua test di `describe` yang sama dengan test sukses:

```ts
  it("menolak tutor saat aturan bantuan course tanpa AI", async () => {
    setKebijakanCourse("tanpa_ai");
    const hasil = await kirimStudyChatAction({ status: "idle" }, messageForm("Tolong kerjakan ini."));

    expect(hasil.status).toBe("policy_denied");
    // Gerbang harus membatalkan sebelum model dipanggil: memanggil lalu membuang
    // jawabannya tetap membakar kuota dan tetap menghasilkan bantuan.
    expect(mocks.generateStudyReply).not.toHaveBeenCalled();
    // Peserta yang ditolak tidak boleh meninggalkan jejak di transkrip.
    expect(mocks.appendStudyMessage).not.toHaveBeenCalled();
    if (hasil.status === "policy_denied") {
      expect(hasil.message).toContain("melarang");
      expect(hasil.snapshot.messages).toHaveLength(0);
    }
  });

  it("melayani tutor saat aturan bantuan mengizinkan", async () => {
    setKebijakanCourse("bertutor");
    const hasil = await kirimStudyChatAction({ status: "idle" }, messageForm("Apa itu server component?"));

    expect(hasil.status).toBe("success");
    expect(mocks.generateStudyReply).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/actions/learning-chat.test.ts`
Expected: FAIL — test "menolak tutor…" gagal karena `hasil.status` adalah `"success"`, bukan `"policy_denied"`, dan `generateStudyReply` terpanggil.

- [ ] **Step 3: Tambahkan varian state**

Di `src/lib/learning/chat-types.ts`, tambahkan satu cabang ke `StudyChatActionState` tepat sebelum cabang `{ status: "success" … }`:

```ts
  | {
      status: "policy_denied";
      message: string;
      snapshot: StudyChatSnapshot;
    }
```

- [ ] **Step 4: Pasang gerbang di action**

Di `src/actions/learning-chat.ts`, tambahkan tiga import:

```ts
import { getCourseById } from "@/lib/courses/store";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import { putuskanAkses } from "@/lib/learning/akses";
```

Sisipkan blok ini **tepat setelah** pemeriksaan `if (!context) { … }` dan **sebelum** `const learnerMessage = messageFor(…)`:

```ts
  // Gerbang aturan bantuan course. Dipasang SEBELUM `appendStudyMessage`:
  // pesan yang ditolak tidak boleh masuk ke transkrip, dan model tidak boleh
  // dipanggil sama sekali — memanggil lalu membuang jawaban tetap membakar kuota
  // dan tetap menghasilkan bantuan yang dilarang.
  //
  // Tanpa konteks course tidak ada kebijakan yang berlaku, jadi tutor tetap
  // dilayani seperti sebelumnya. `context.course` diturunkan dari profil +
  // pendaftaran, bukan dari formulir, jadi peserta tidak bisa mengecualikan
  // dirinya lewat pesan yang ia kirim.
  if (context.course) {
    const kursus = await getCourseById(context.course.id);
    const keputusan = putuskanAkses({
      jenisKegiatan: "bantuan_akademik",
      kebijakan: kursus?.kebijakan ?? kebijakanDefault(),
      // `bantuan_akademik` tidak bergantung bukti sesi — mesin akses tidak
      // membacanya untuk kegiatan ini, jadi nilainya sengaja tidak menebak.
      adaBuktiSesi: false,
    });
    if (keputusan.tipe === "ditolak") {
      return {
        status: "policy_denied",
        message: keputusan.pesan,
        snapshot: await readStudyChatSnapshot(owner),
      };
    }
  }
```

`readStudyChatSnapshot` sudah diimpor di berkas ini.

- [ ] **Step 5: Perbarui komponen klien**

Di `src/components/features/learning/study-chat.tsx`, ubah **kedua** kondisi.

Baris ~58, di dalam `submitMessage`:

```ts
    if (
      next.status === "success" ||
      next.status === "unavailable" ||
      next.status === "invalid_model_output" ||
      next.status === "policy_denied"
    ) {
      setMessage("");
    }
```

Baris ~78, untuk `displayedSnapshot`:

```ts
  const displayedSnapshot =
    sendState.status === "success" ||
    sendState.status === "unavailable" ||
    sendState.status === "invalid_model_output" ||
    sendState.status === "policy_denied"
      ? sendState.snapshot
      : initialSnapshot;
```

**Hanya dua tempat ini.** `sendStatus` (baris ~91) sudah jatuh ke cabang `sendState.message`, dan `sendStatusClass` sudah memberi `text-destructive` untuk setiap status yang bukan sukses/idle — jadi pesan penolakan tampil tanpa sentuhan tambahan.

**Kenapa tepat dua, dan kenapa tidak boleh dilewati:** tanpa pembaruan `displayedSnapshot`, penolakan diam-diam jatuh ke `initialSnapshot` dan pesannya tidak pernah terlihat. Tanpa pembaruan `submitMessage`, isian tidak dikosongkan dan peserta mengira pesannya belum terkirim. Keduanya adalah penyimpangan kontrak jenis yang dicatat skill `careevo-review`; Step 7 mengunci jumlah kemunculannya.

- [ ] **Step 6: Jalankan test untuk memastikan lulus**

Run: `npx vitest run src/actions/learning-chat.test.ts`
Expected: PASS.

- [ ] **Step 7: Tambah static check**

Di `src/lib/learning/security.test.ts`, tambahkan dua konstanta berkas setelah baris `BERKAS_SESI`:

```ts
const BERKAS_CHAT_ACTION = path.join(ROOT, "src/actions/learning-chat.ts");
const BERKAS_CHAT_UI = path.join(ROOT, "src/components/features/learning/study-chat.tsx");
```

Tambahkan blok baru di akhir berkas:

```ts
describe("gerbang aturan bantuan pada tutor", () => {
  it("menolak tutor sebelum pesan disimpan dan sebelum model dipanggil", () => {
    const isi = readFileSync(BERKAS_CHAT_ACTION, "utf8");
    expect(isi).toContain('"policy_denied"');
    // Memindahkan gerbang ke setelah penyimpanan mengembalikan celahnya: pesan
    // yang ditolak akan tersimpan di transkrip sebagai bukti permintaan.
    expect(isi.indexOf('"policy_denied"')).toBeLessThan(isi.indexOf("await appendStudyMessage("));
  });

  it("komponen klien punya dua jalur yang mengenal penolakan kebijakan", () => {
    // Tepat dua: `submitMessage` (kosongkan isian) dan `displayedSnapshot`
    // (tampilkan transkrip). Menghapus salah satunya membuat penolakan hilang
    // tanpa error sama sekali, jadi jumlahnya dipatok.
    const isi = readFileSync(BERKAS_CHAT_UI, "utf8");
    expect(isi.match(/"policy_denied"/g) ?? []).toHaveLength(2);
  });
});
```

- [ ] **Step 8: Buktikan static check menangkap penghapusan gerbang**

Hapus sementara blok gerbang dari `learning-chat.ts`, lalu jalankan `npx vitest run src/lib/learning/security.test.ts` — harus **FAIL**. Kembalikan bloknya, jalankan lagi — harus **hijau**.

Lalu hapus satu syarat `"policy_denied"` dari `study-chat.tsx`, pastikan test kedua ikut merah, lalu kembalikan lagi.

- [ ] **Step 9: Commit**

```bash
git add src/lib/learning/chat-types.ts src/actions/learning-chat.ts src/actions/learning-chat.test.ts src/components/features/learning/study-chat.tsx src/lib/learning/security.test.ts
git commit -m "fix(learning): gerbang aturan bantuan pada tutor StudyChat"
```

---

## Task 2: Masa berlaku sesi di store (server-only)

**Files:**
- Modify: `src/lib/learning/akses.ts`
- Modify: `src/lib/learning/akses.test.ts`
- Modify: `src/lib/learning/session.ts`
- Modify: `src/lib/learning/session.test.ts`

**Interfaces:**
- Consumes (sudah ada): `CheckpointMateri`, `KebijakanCourse`, `KJenisKejadian`, `klasifikasiKejadian`.
- Produces:
  - `akses.ts`: `lewatBatas(mulaiAt: string, batasMenit: number, now?: number): boolean` — murni, dipakai klien maupun server.
  - `session.ts`: `BATAS_SESI_BAWAAN_MENIT: number`; `SessionRun.berlaku_hingga?: string` (opsional, supaya berkas lama tidak dianggap korup); `kedaluwarsa(run: Pick<SessionRun, "mulai_at" | "berlaku_hingga">, now?: number): boolean`; `tandaiKedaluwarsa(id: string): Promise<SessionRun | null>`; `mulaiRun(input & { batasMenit?: number }): Promise<SessionRun>`; `cariRunAktif(input)` diekspor; `listRun(): Promise<SessionRun[]>`.

- [ ] **Step 1: Tulis test murni yang gagal**

Tambahkan `lewatBatas` ke impor di `src/lib/learning/akses.test.ts`, lalu tambahkan blok:

```ts
describe("lewatBatas", () => {
  const MULAI = "2026-09-25T10:00:00.000Z";
  const menit = (n: number) => Date.parse(MULAI) + n * 60_000;

  it("belum lewat selama masih di dalam batas", () => {
    expect(lewatBatas(MULAI, 30, menit(29))).toBe(false);
  });

  it("tepat pada menit terakhir masih diterima", () => {
    expect(lewatBatas(MULAI, 30, menit(30))).toBe(false);
  });

  it("sudah lewat setelah batas terlampaui", () => {
    expect(lewatBatas(MULAI, 30, menit(31))).toBe(true);
  });

  it("waktu yang tidak bisa diparse diperlakukan sebagai lewat", () => {
    // Gagal-tertutup: `mulai_at` rusak tidak boleh berarti batasnya tidak
    // berlaku, sehingga bukti tetap sah selamanya.
    expect(lewatBatas("bukan tanggal", 30, menit(1))).toBe(true);
  });
});
```

> Perhatikan yang kedua: batas memakai `>`, jadi peserta yang menyelesaikan tepat pada menit terakhir **tidak** dihukum karena satu milidetik. Test ini mengunci keputusan itu.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/lib/learning/akses.test.ts`
Expected: FAIL — `lewatBatas` bukan ekspor yang dikenal.

- [ ] **Step 3: Implementasikan `lewatBatas`**

Tambahkan ke `src/lib/learning/akses.ts`, tepat setelah fungsi `checkpointTerverifikasi`:

```ts
/**
 * Apakah waktu pengerjaan sebuah modul sudah habis.
 *
 * Dihitung dari `mulai_at` **sesi**, bukan dari waktu halaman dimuat: batas
 * yang dihitung ulang tiap muat ulang bukan batas. `now` bisa disuntikkan
 * supaya aturan ini bisa diuji tanpa memalsukan jam sistem.
 *
 * `mulaiAt` yang tidak bisa diparse dianggap **lewat** (gagal-tertutup): bukti
 * yang tidak bisa diaudit tidak boleh dianggap masih berlaku.
 */
export function lewatBatas(mulaiAt: string, batasMenit: number, now: number = Date.now()): boolean {
  const mulai = Date.parse(mulaiAt);
  if (!Number.isFinite(mulai)) return true;
  return now - mulai > batasMenit * 60_000;
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run src/lib/learning/akses.test.ts`
Expected: PASS.

- [ ] **Step 5: Tulis test store yang gagal**

Tambahkan test ini di dalam `describe("siklus hidup run")` di `src/lib/learning/session.test.ts`:

```ts
  it("mencap masa berlaku dari batas menit yang diberikan", async () => {
    const run = await mod.mulaiRun({
      courseId: "crs-20", owner: "batas@x.test", policyVersion: 1, batasMenit: 45,
    });
    expect(Date.parse(run.berlaku_hingga!) - Date.parse(run.mulai_at)).toBe(45 * 60_000);
  });

  it("menandai run yang lewat batas dan menolaknya sebagai bukti", async () => {
    // `batasMenit: 0` membuat masa berlaku jatuh tepat pada `mulai_at`, jadi
    // batas terlewati tanpa perlu memalsukan jam sistem.
    const run = await mod.mulaiRun({
      courseId: "crs-21", owner: "kedaluwarsa@x.test", policyVersion: 1, batasMenit: 0,
    });
    const token = mod.buktiBaru({
      courseId: "crs-21", owner: "kedaluwarsa@x.test", policyVersion: 1,
    });

    expect(
      await mod.buktikanSesi({ courseId: "crs-21", owner: "kedaluwarsa@x.test", policyVersion: 1, token }),
    ).toBeNull();

    // Statusnya ditulis ke disk, bukan sekadar ditolak: `cariRunAktif`
    // melewatkan run non-aktif, sehingga run ini membersihkan dirinya sendiri
    // dan tidak lagi memblokir run berikutnya milik peserta yang sama.
    expect((await mod.ambilRun(run.id))?.status).toBe("kedaluwarsa");
  });
```

Tambahkan dua blok baru setelah `describe("buktikanSesi")`:

```ts
describe("kedaluwarsa", () => {
  const MULAI = "2026-09-25T10:00:00.000Z";
  const AWAL = Date.parse(MULAI);

  it("memakai batas bawaan untuk run tanpa masa berlaku tersimpan", () => {
    expect(mod.kedaluwarsa({ mulai_at: MULAI }, AWAL)).toBe(false);
    expect(mod.kedaluwarsa({ mulai_at: MULAI }, AWAL + 31 * 60_000)).toBe(true);
  });

  it("menganggap masa berlaku yang rusak sebagai sudah lewat", () => {
    expect(mod.kedaluwarsa({ mulai_at: MULAI, berlaku_hingga: "rusak" }, AWAL)).toBe(true);
  });

  it("menganggap waktu mulai yang rusak sebagai sudah lewat", () => {
    expect(mod.kedaluwarsa({ mulai_at: "rusak", berlaku_hingga: MULAI }, AWAL)).toBe(true);
  });
});

describe("listRun", () => {
  it("mengembalikan seluruh run untuk pembacaan lintas-pemilik oleh staf", async () => {
    const sebelum = (await mod.listRun()).length;
    const run = await mod.mulaiRun({ courseId: "crs-list", owner: "staf@x.test", policyVersion: 1 });
    const sesudah = await mod.listRun();
    expect(sesudah).toHaveLength(sebelum + 1);
    expect(sesudah.some((r) => r.id === run.id)).toBe(true);
  });
});
```

- [ ] **Step 6: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/lib/learning/session.test.ts`
Expected: FAIL — `berlaku_hingga` undefined pada run pertama; `kedaluwarsa` dan `listRun` bukan fungsi yang dikenal.

- [ ] **Step 7: Implementasikan masa berlaku di `session.ts`**

Tambahkan konstanta di bawah `const SESSION_SECRET`:

```ts
/** Batas sesi ketika course tidak punya modul yang menetapkan angka sendiri. */
export const BATAS_SESI_BAWAAN_MENIT = 30;
```

Ubah antarmuka `SessionRun` — sisipkan setelah `mulai_at`:

```ts
  /**
   * Batas masa berlaku, ISO. **Opsional** supaya berkas run yang ditulis
   * sebelum field ini ada tidak ikut dianggap korup — `kedaluwarsa()` sudah
   * menurunkannya ke batas bawaan.
   */
  berlaku_hingga?: string;
```

Tambahkan dua fungsi tepat sebelum `export async function ambilRun`:

```ts
/**
 * Apakah sebuah run sudah melewati masa berlakunya.
 *
 * Run tanpa `berlaku_hingga` (berkas lama) dihitung dari `mulai_at` + batas
 * bawaan. Nilai yang tidak bisa diparse dianggap kedaluwarsa — gagal-tertutup,
 * bukan gagal-terbuka.
 */
export function kedaluwarsa(
  run: Pick<SessionRun, "mulai_at" | "berlaku_hingga">,
  now: number = Date.now(),
): boolean {
  const mulai = Date.parse(run.mulai_at);
  if (!Number.isFinite(mulai)) return true;
  const akhir = run.berlaku_hingga
    ? Date.parse(run.berlaku_hingga)
    : mulai + BATAS_SESI_BAWAAN_MENIT * 60_000;
  if (!Number.isFinite(akhir)) return true;
  return now >= akhir;
}

/** Tutup run sebagai kedaluwarsa; idempoten seperti `akhiriRun`. */
export async function tandaiKedaluwarsa(id: string): Promise<SessionRun | null> {
  const run = await ambilRun(id);
  if (!run) return null;
  if (run.status !== "aktif") return run;
  const berikut: SessionRun = {
    ...run,
    status: "kedaluwarsa",
    berakhir_at: new Date().toISOString(),
    alasan_akhir: "kedaluwarsa_waktu",
  };
  await tulisRun(berikut);
  return berikut;
}
```

Ganti isi fungsi `mulaiRun` agar menerima dan menyimpan batas:

```ts
export async function mulaiRun(input: {
  courseId: string;
  owner: string;
  policyVersion: number;
  /**
   * Menit sejak mulai sampai run kedaluwarsa. Default 30.
   *
   * Nilainya berasal dari `batas_waktu_menit` checkpoint modul — lihat
   * `mulaiSesiAction`. Field itu sudah ada di model dan sudah dijelaskan
   * artinya, jadi inilah pembaca pertamanya.
   */
  batasMenit?: number;
}): Promise<SessionRun> {
  const mulai = new Date();
  const batasMenit = input.batasMenit ?? BATAS_SESI_BAWAAN_MENIT;
  const run: SessionRun = {
    id: `sesi-${randomUUID()}`,
    course_id: input.courseId,
    owner: input.owner.trim().toLowerCase(),
    policy_version: input.policyVersion,
    status: "aktif",
    mulai_at: mulai.toISOString(),
    berlaku_hingga: new Date(mulai.getTime() + batasMenit * 60_000).toISOString(),
    berakhir_at: null,
    kejadian: [],
  };
  await tulisRun(run);
  return run;
}
```

Di `buktikanSesi`, ganti dua baris terakhir sebelum `return run`:

```ts
  const id = await cariRunAktif(input);
  if (!id) return null;
  const run = await ambilRun(id);
  if (!run || run.status !== "aktif") return null;
  // Menulis statusnya bukan kosmetik: `cariRunAktif` melewatkan run non-aktif,
  // sehingga run yang lewat batas membersihkan dirinya sendiri dan tidak lagi
  // memblokir run berikutnya yang dibuat peserta yang sama.
  if (kedaluwarsa(run)) {
    await tandaiKedaluwarsa(id);
    return null;
  }
  return run;
```

Hapus kata `async` dari penanda `cariRunAktif` supaya bisa diimpor, dan tambahkan pembacanya untuk staf tepat setelah fungsi itu:

```ts
/** Semua run tersimpan — pembacaan lintas-pemilik untuk dashboard staf. */
export async function listRun(): Promise<SessionRun[]> {
  let berkas: string[];
  try {
    berkas = await readdir(tempatSesi());
  } catch {
    return [];
  }
  const hasil: SessionRun[] = [];
  for (const nama of berkas) {
    if (!nama.endsWith(".json")) continue;
    const run = await ambilRun(nama.replace(/\.json$/, ""));
    if (run) hasil.push(run);
  }
  return hasil;
}
```

- [ ] **Step 8: Jalankan test untuk memastikan lulus**

Run: `npx vitest run src/lib/learning/session.test.ts src/lib/learning/akses.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/learning/akses.ts src/lib/learning/akses.test.ts src/lib/learning/session.ts src/lib/learning/session.test.ts
git commit -m "fix(learning): masa berlaku sesi dan status kedaluwarsa"
```

---

## Task 3: Satu run aktif per course + batas percobaan per modul

**Files:**
- Modify: `src/actions/learning.ts`
- Modify: `src/actions/learning.test.ts`

**Interfaces:**
- Consumes (Task 2): `cariRunAktif`, `kedaluwarsa`, `tandaiKedaluwarsa`, `BATAS_SESI_BAWAAN_MENIT`, `lewatBatas`. Consumes (sudah ada): `ambilRun`, `mulaiRun`, `buktiBaru`, `catatKejadian`, `modulUntukSumber`, `checkpointEfektif`, `getCourseById`, `session.nama`.
- Produces: `mulaiSesiAction` melanjutkan run yang masih berlaku alih-alih membuat duplikat; `selesaikanMateriAction` menolak lewat `checkpoint.batas_waktu_menit` sebelum ada penulisan apa pun.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan test ini di dalam `describe("mulaiSesiAction")` di `src/actions/learning.test.ts`:

```ts
  it("melanjutkan run yang masih aktif, bukan membuat run kedua", async () => {
    await daftarKursus("crs-1", "crs-1");
    const pertama = await mulaiSesiAction("crs-1");
    const kedua = await mulaiSesiAction("crs-1");
    expect(pertama.ok).toBe(true);
    expect(kedua.ok).toBe(true);
    // Run ganda muncul dari alur normal: status sesi hanya hidup di state
    // React, jadi memuat ulang halaman kursus membuat "Mulai sesi" tampil
    // lagi — dan mengkliknya melahirkan run kedua.
    expect(kedua.runId).toBe(pertama.runId);
  });
```

Tambahkan test ini di dalam `describe("selesaikanMateriAction")`:

```ts
  it("menolak penyelesaian yang sudah melewati batas waktu checkpoint", async () => {
    // Dua modul dengan batas berbeda adalah syarat test ini. Batas sesi memakai
    // **maksimum** course (60 menit), sedangkan batas modul target 5 menit.
    // Memundurkan 10 menit membuat sesi masih sah tetapi modul target sudah
    // lewat — persis perbedaan antara dua mekanisme yang harus dibuktikan.
    //
    // Kalau course hanya punya modul turunan, keduanya sama-sama 30 menit dan
    // test ini tidak bisa memisahkannya: `mulai_at` yang dimundurkan ikut
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
    await daftarKursus("crs-2", "crs-2");

    const mulai = await mulaiSesiAction("crs-2");
    const sebelum = selesaiModul("crs-2");
    await mundurkanSesi(mulai.runId!, 10 * 60_000);

    const hasil = await selesaikanMateriAction({
      courseId: "crs-2", modulId: cepat!.id, bukti: mulai.bukti ?? "",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("batas waktu");
    // Penolakan tidak boleh menulis apa pun. `tandaiModul` adalah toggle,
    // jadi penolakan yang tanpa sengaja menulis akan menghapus centang.
    expect(selesaiModul("crs-2")).toEqual(sebelum);
  });
```

Tambahkan helper ini di `src/actions/learning.test.ts`, dekat helper `selesaiModul` yang sudah ada (sekitar baris 70):

```ts
/** Mundurkan `mulai_at` sebuah run supaya batas waktu bisa diuji tanpa menunggu. */
async function mundurkanSesi(runId: string, milidetik: number) {
  const berkas = path.join(tempatSesi(), `${runId}.json`);
  const isi = JSON.parse(await readFile(berkas, "utf8")) as { mulai_at: string };
  isi.mulai_at = new Date(Date.parse(isi.mulai_at) - milidetik).toISOString();
  await writeFile(berkas, `${JSON.stringify(isi, null, 2)}\n`, "utf8");
}
```

Tambahkan import yang dibutuhkan di kepala berkas:

```ts
import { readFile, writeFile } from "node:fs/promises";
```

```ts
import { tempatSesi } from "@/lib/learning/session";
```

`path` dan `jar`/`decodePendaftaran` sudah dipakai berkas ini.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/actions/learning.test.ts`
Expected: FAIL — `kedua.runId` berbeda dari `pertama.runId`, dan `selesaikanMateriAction` mengembalikan `ok: true` untuk sesi yang sudah lewat batas.

- [ ] **Step 3: Ubah `mulaiSesiAction`**

Di `src/actions/learning.ts`, ganti blok pembuatan run menjadi:

```ts
  const kebijakan = kebijakanKursus(kursus);

  // Sesi berlaku untuk seluruh course, sedangkan `batas_waktu_menit` terikat
  // per modul. Maka angka course diambil **maksimum**nya: kalau dipakai
  // minimum, satu modul berlimit 5 menit akan membuat sesi modul 30 menit ikut
  // kedaluwarsa — membiarkan bukti mati hanya karena ada modul lain.
  const modul = await modulUntukSumber({
    id: kursus.id,
    title: kursus.title,
    tags: kursus.tags,
    duration_min: kursus.duration_min,
    url: kursus.url,
  });
  const batasMenit =
    modul.length === 0
      ? BATAS_SESI_BAWAAN_MENIT
      : Math.max(...modul.map((m) => checkpointEfektif(m).batas_waktu_menit));

  // Satu course = satu run aktif. `mulaiSesiAction` berjalan setiap kali peserta
  // menekan tombol, dan status sesi hanya hidup di state React — memuat ulang
  // halaman membuat tombol itu muncul lagi. Tanpa cabang lanjutkan di sini,
  // tiap muat ulang melahirkan run duplikat, lalu `cariRunAktif` memilih run
  // secara acak berdasarkan urutan `readdir`.
  const eksistingId = await cariRunAktif({ courseId, owner: session.email });
  let run = eksistingId ? await ambilRun(eksistingId) : null;
  if (run && kedaluwarsa(run)) {
    await tandaiKedaluwarsa(run.id);
    run = null;
  }
  if (!run) {
    run = await mulaiRun({
      courseId,
      owner: session.email,
      policyVersion: kebijakan.versi,
      batasMenit,
    });
    await catatKejadian({ runId: run.id, jenis: "sesi_dimulai", visibilitas: "visible" });
  }
```

Baris `return` di bawahnya tidak berubah: `buktiBaru` hanya mengikat course, owner, dan versi kebijakan — bukan id run — jadi bukti segar untuk run yang dilanjutkan tetap sah.

Perbarui import dari `@/lib/learning/session`:

```ts
import {
  BATAS_SESI_BAWAAN_MENIT,
  akhiriRun,
  ambilRun,
  buktiBaru,
  buktikanSesi,
  cariRunAktif,
  catatKejadian,
  kedaluwarsa,
  mulaiRun,
  tandaiKedaluwarsa,
  type SessionRun,
} from "@/lib/learning/session";
```

- [ ] **Step 4: Tegakkan batas per modul**

Di `selesaikanMateriAction`, sisipkan **setelah** blok `if (keputusan.tipe === "ditolak") …` dan **sebelum** blok gerbang pendaftaran:

```ts
  // Batas per modul ditegakkan terpisah dari masa berlaku sesi.
  // `batas_waktu_menit` punya makna yang sudah didokumentasikan ("batas waktu
  // mengerjakan/menyelesaikan"), jadi tidak boleh tetap jadi field yang ditulis
  // lalu tidak pernah dibaca.
  //
  // Batas ini bisa dilewati dengan memulai sesi baru — tetapi itu terlihat
  // jelas: run lama ditutup dan run baru tercatat. Itu pemecatan yang terlihat,
  // bukan pemalsuan tersembunyi, dan konsisten dengan posisi spesifikasi bahwa
  // kontrol memperkuat bukti tanpa menjanjikannya.
  if (bukti && lewatBatas(bukti.mulai_at, checkpoint.batas_waktu_menit)) {
    return {
      ok: false,
      error: "Sesi ini sudah melewati batas waktu pengerjaan. Mulai sesi baru untuk mencoba kembali.",
    };
  }
```

Tambahkan `lewatBatas` ke impor dari `@/lib/learning/akses`:

```ts
import {
  JENIS_KEJADIAN_SAH,
  checkpointEfektif,
  lewatBatas,
  putuskanAkses,
  wajibSesiTerverifikasi,
  type KJenisKejadian,
} from "@/lib/learning/akses";
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npx vitest run src/actions/learning.test.ts`
Expected: PASS. Test lama "accepts a valid proof" tetap lulus karena `mulai_at` tidak dimundurkan di sana.

- [ ] **Step 6: Buktikan penolakan tidak pernah menulis**

Pindahkan blok batas **ke bawah** pemanggilan `tandaiModul`, lalu jalankan test "batas waktu checkpoint" — harus **FAIL**, karena `tandaiModul` sudah sempat menandai modul selesai sebelum batas dicek (dan `selesaiModul` jadi tidak sama dengan `sebelum`). Kembalikan blok ke posisi semula dan jalankan lagi — harus PASS.

- [ ] **Step 7: Gerbang manual**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/actions/learning.ts src/actions/learning.test.ts
git commit -m "fix(learning): satu run aktif per course dan batas waktu per modul"
```

---

# BAGIAN B — Laporan performa & dashboard verifikator

Task 4–9. Bagian B tidak bergantung pada Bagian A; keduanya boleh dikerjakan terpisah.

---

## Task 4: Toko performa (server-only) + isolasi test

**Files:**
- Create: `src/lib/performa/store.ts`
- Create: `src/lib/performa/store.test.ts`
- Modify: `vitest.config.mts`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: tidak ada.
- Produces:
  - `tempatPerforma(): string`
  - `bacaPerforma(owner: string): Promise<RecordPerforma | null>`
  - `tulisPerforma(record: RecordPerforma): Promise<RecordPerforma>`
  - `indeksPerforma(): Promise<RecordPerforma[]>`
  - `catatPenyelesaian(input): Promise<RecordPerforma | null>`
  - `catatSkorKuis(input): Promise<RecordPerforma | null>`
  - `resetPerforma(): Promise<void>`
  - Tipe `RecordPerforma`, `KursusPerforma`, `PenyelesaianModul`, `PercobaanKuis`, `SumberPenyelesaian`, `SumberSkor`.

**Mengapa tidak cookie:** cookie `ls_enroll` hanya bisa dibaca pemiliknya — itulah masalah yang diselesaikan. Cookie juga dibatasi ~4KB, dan data performa tumbuh tanpa batas.

- [ ] **Step 1: Isolasi test lebih dulu**

`src/actions/enrollment.test.ts` memakai **import statis**, jadi `CAREEVO_PERFORMA_DIR` tidak bisa disetel di dalam berkas itu. Ubah `vitest.config.mts` menjadi:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Direktori toko performa dialihkan ke temp **sekali per run test** di sini,
// bukan di dalam tiap berkas test: `src/actions/enrollment.test.ts` memakai
// import statis sehingga env tidak bisa disetel sebelum modul toko dimuat.
const PERFORMA_DIR = mkdtempSync(path.join(tmpdir(), "careevo-performa-"));

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { CAREEVO_PERFORMA_DIR: PERFORMA_DIR },
  },
});
```

- [ ] **Step 2: Tulis test yang gagal**

Buat `src/lib/performa/store.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bacaPerforma,
  catatPenyelesaian,
  catatSkorKuis,
  indeksPerforma,
  resetPerforma,
  tempatPerforma,
} from "./store";

const PEMBELAJAR = "siswa@careevo.test";
const NAMA = "Raka Pratama";

const dasarPenyelesaian = {
  owner: PEMBELAJAR,
  nama: NAMA,
  courseId: "crs-1",
  judulKursus: "Fullstack Web",
  modulId: "crs-1-m1",
};

/**
 * Direktori **per test**, bukan hanya dari `vitest.config.mts`.
 *
 * Env global itu jaring pengaman (menjamin tidak ada test yang menyentuh
 * `.data/` repo), tetapi ia juga dipakai bersama oleh berkas test lain yang
 * berjalan paralel — `resetPerforma()` di sini akan menghapus berkas milik
 * test itu. `tempatPerforma()` membaca env per panggilan, jadi override di
 * `beforeEach` langsung berlaku meski impor modulnya statis.
 */
beforeEach(() => {
  process.env.CAREEVO_PERFORMA_DIR = mkdtempSync(path.join(tmpdir(), "careevo-performa-store-"));
});

describe("toko performa", () => {
  it("mencerminkan penyelesaian dan membedakan sumbernya", async () => {
    resetPerforma();
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "terverifikasi" });
    await catatPenyelesaian({ ...dasarPenyelesaian, modulId: "crs-1-m2", sumber: "informal" });

    const record = await bacaPerforma(PEMBELAJAR);
    expect(record?.kursus).toHaveLength(1);
    expect(record?.kursus[0].selesai).toHaveLength(2);
    expect(record?.kursus[0].selesai.map((s) => s.sumber).sort()).toEqual(["informal", "terverifikasi"]);
  });

  it("tidak menggandakan cermin untuk modul yang sama", async () => {
    resetPerforma();
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "terverifikasi" });
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "terverifikasi" });
    expect((await bacaPerforma(PEMBELAJAR))?.kursus[0].selesai).toHaveLength(1);
  });

  it("melepas cermin ketika pembatalan menandai modul selesai lagi", async () => {
    resetPerforma();
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "terverifikasi" });
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "terverifikasi", batal: true });
    expect((await bacaPerforma(PEMBELAJAR))?.kursus[0].selesai).toHaveLength(0);
  });

  it("menyimpan skor kuis dan mengindeks lintas-pemilik", async () => {
    resetPerforma();
    await catatSkorKuis({
      owner: PEMBELAJAR, nama: NAMA, courseId: "crs-1", judulKursus: "Fullstack Web",
      kuisId: "kuis-1", modulId: "crs-1-m1", nilai: 80, totalSoal: 5,
    });
    const semua = await indeksPerforma();
    expect(semua.some((r) => r.owner === PEMBELAJAR)).toBe(true);
    expect(semua.find((r) => r.owner === PEMBELAJAR)?.kursus[0].kuis[0].sumber).toBe("klien");
  });

  it("menolak skor di luar rentang 0-100", async () => {
    await expect(catatSkorKuis({
      owner: PEMBELAJAR, nama: NAMA, courseId: "crs-1", judulKursus: "F",
      kuisId: "k-1", modulId: "m-1", nilai: 120, totalSoal: 5,
    })).resolves.toBeNull();
  });

  it("menaruh berkas di direktori yang bisa dialihkan", () => {
    expect(tempatPerforma()).toBe(process.env.CAREEVO_PERFORMA_DIR);
  });
});
```

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/lib/performa/store.test.ts`
Expected: FAIL — `Cannot find module './store'`.

- [ ] **Step 4: Implementasikan toko**

Buat `src/lib/performa/store.ts`:

```ts
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Catatan performa peserta — **server-only**, dan **sengaja terpisah** dari
 * cookie pendaftaran.
 *
 * Cookie `ls_enroll` milik peramban peserta: verifikator tidak bisa membacanya,
 * dan itulah alasan cermin ini ada. Yang dicerminkan adalah **hasil**, bukan
 * cookie-nya — `tandaiModul` menulis ke keduanya dalam satu operasi supaya
 * keduanya tidak mungkin berbeda.
 *
 * Direktori dialihkan lewat `CAREEVO_PERFORMA_DIR` (dikonfigurasi di
 * `vitest.config.mts`) supaya test tidak pernah menyentuh `.data/` milik repo.
 */

export type SumberPenyelesaian = "terverifikasi" | "informal";
/** Selalu `"klien"` di pass ini: penilaian server adalah pekerjaan terpisah. */
export type SumberSkor = "klien";

export interface PenyelesaianModul {
  modul_id: string;
  at: string;
  sumber: SumberPenyelesaian;
}

export interface PercobaanKuis {
  kuis_id: string;
  modul_id: string;
  nilai: number;
  total_soal: number;
  at: string;
  sumber: SumberSkor;
}

export interface KursusPerforma {
  course_id: string;
  judul: string;
  selesai: PenyelesaianModul[];
  kuis: PercobaanKuis[];
}

export interface RecordPerforma {
  owner: string;
  nama: string;
  versi_skema: 1;
  kursus: KursusPerforma[];
}

/** Batas percobaan per kuis: yang lebih lama dipangkas, bukan ditolak. */
const MAKS_PERCOBAAN = 50;

export function tempatPerforma(): string {
  return process.env.CAREEVO_PERFORMA_DIR ?? path.join(process.cwd(), ".data", "performa");
}

/**
 * Nama berkas = hash email, jadi email tidak menentukan struktur direktori.
 * Email tetap disimpan di dalam record karena dashboard perlu menampilkannya.
 */
function berkasPerforma(owner: string): string {
  const hash = createHash("sha256").update(owner.trim().toLowerCase()).digest("hex");
  return path.join(tempatPerforma(), `${hash}.json`);
}

function recordKosong(owner: string, nama: string): RecordPerforma {
  return { owner: owner.trim().toLowerCase(), nama, versi_skema: 1, kursus: [] };
}

function isRecord(value: unknown): value is RecordPerforma {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.owner === "string" &&
    typeof c.nama === "string" &&
    c.versi_skema === 1 &&
    Array.isArray(c.kursus)
  );
}

export async function bacaPerforma(owner: string): Promise<RecordPerforma | null> {
  let mentah: string;
  try {
    mentah = await readFile(berkasPerforma(owner), "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(mentah) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function tulisPerforma(record: RecordPerforma): Promise<RecordPerforma> {
  const tujuan = berkasPerforma(record.owner);
  await mkdir(path.dirname(tujuan), { recursive: true });
  const sementara = `${tujuan}.tmp`;
  await writeFile(sementara, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(sementara, tujuan);
  return record;
}

/** Semua peserta yang punya catatan — pembacaan lintas-pemilik untuk staf. */
export async function indeksPerforma(): Promise<RecordPerforma[]> {
  let berkas: string[];
  try {
    berkas = await readdir(tempatPerforma());
  } catch {
    return [];
  }
  const hasil: RecordPerforma[] = [];
  for (const nama of berkas) {
    if (!nama.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(
        await readFile(path.join(tempatPerforma(), nama), "utf8"),
      ) as unknown;
      if (isRecord(parsed)) hasil.push(parsed);
    } catch {
      continue;
    }
  }
  return hasil.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

function entriKursus(record: RecordPerforma, courseId: string, judul: string): KursusPerforma {
  const ada = record.kursus.find((k) => k.course_id === courseId);
  if (ada) {
    if (!ada.judul) ada.judul = judul;
    return ada;
  }
  const baru: KursusPerforma = { course_id: courseId, judul, selesai: [], kuis: [] };
  record.kursus.push(baru);
  return baru;
}

/**
 * Cermin satu penyelesaian modul.
 *
 * `batal` melepas entri yang sudah ada. `tandaiModul` adalah **toggle**:
 * tanpa cabang ini, pembatalan akan meninggalkan cermin yang menyatakan modul
 * selesai, dan dashboard akan menampilkan sesuatu yang tidak lagi berlaku di
 * cookie.
 */
export async function catatPenyelesaian(input: {
  owner: string;
  nama: string;
  courseId: string;
  judulKursus: string;
  modulId: string;
  sumber: SumberPenyelesaian;
  at?: string;
  batal?: boolean;
}): Promise<RecordPerforma | null> {
  const lama = (await bacaPerforma(input.owner)) ?? recordKosong(input.owner, input.nama);
  const entri = entriKursus(lama, input.courseId, input.judulKursus);
  if (input.batal) {
    entri.selesai = entri.selesai.filter((s) => s.modul_id !== input.modulId);
  } else if (!entri.selesai.some((s) => s.modul_id === input.modulId)) {
    entri.selesai.push({
      modul_id: input.modulId,
      at: input.at ?? new Date().toISOString(),
      sumber: input.sumber,
    });
  }
  return tulisPerforma(lama);
}

/**
 * Catat satu skor kuis.
 *
 * `nilai` **dilaporkan klien** dan belum dinilai server (`jawaban_benar` ikut
 * ke perender), jadi yang diperiksa di sini hanya **bentuk** angkanya — rentang
 * 0–100 dan jumlah soal yang masuk akal. Substansinya tidak. Field `sumber`
 * ada supaya penilaian server yang menyusul tidak perlu melabeli ulang catatan
 * lama.
 */
export async function catatSkorKuis(input: {
  owner: string;
  nama: string;
  courseId: string;
  judulKursus: string;
  kuisId: string;
  modulId: string;
  nilai: number;
  totalSoal: number;
  at?: string;
}): Promise<RecordPerforma | null> {
  if (!Number.isFinite(input.nilai) || input.nilai < 0 || input.nilai > 100) return null;
  if (!Number.isInteger(input.totalSoal) || input.totalSoal < 1) return null;

  const lama = (await bacaPerforma(input.owner)) ?? recordKosong(input.owner, input.nama);
  const entri = entriKursus(lama, input.courseId, input.judulKursus);
  entri.kuis = [
    ...entri.kuis,
    {
      kuis_id: input.kuisId,
      modul_id: input.modulId,
      nilai: Math.round(input.nilai),
      total_soal: input.totalSoal,
      at: input.at ?? new Date().toISOString(),
      sumber: "klien",
    },
  ].slice(-MAKS_PERCOBAAN);
  return tulisPerforma(lama);
}

/** Untuk test saja: membuang seluruh direktori toko. */
export async function resetPerforma(): Promise<void> {
  await rm(tempatPerforma(), { recursive: true, force: true });
}
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npx vitest run src/lib/performa/store.test.ts`
Expected: PASS.

- [ ] **Step 6: Pastikan tidak ada yang menyentuh `.data/`**

Run: `npm run check`
Expected: exit 0, dan direktori `.data/performa` **tidak dibuat** di dalam repo.

- [ ] **Step 7: Dokumentasikan di `AGENTS.md`**

Tambahkan satu butir ke daftar "Persistence patterns" di `AGENTS.md`, tepat setelah butir file-based resume store:

```markdown
  - **File-based performance store** (`src/lib/performa/`) — catatan server untuk
    laporan verifikator: cermin progres (`selesai_modul`) beserta jalur
    penyelesaiannya, skor kuis yang dilaporkan klien, dan pembacaan langsung
    `.data/sessions/` untuk integritas. Server-only; tidak boleh memakai
    `dangerouslySetInnerHTML`. Tujuannya satu: halaman verifikator harus bisa
    membaca lintas-pengguna, sedangkan cookie `ls_enroll` hanya bisa dibaca
    pemiliknya. Direktori dialihkan lewat `CAREEVO_PERFORMA_DIR`.
```

Tambahkan satu butir ke bagian "Testing quirks" di `AGENTS.md`:

```markdown
- `vitest.config.mts` mengeset `CAREEVO_PERFORMA_DIR` ke direktori temp baru
  pada setiap run, karena `src/actions/enrollment.test.ts` memakai import statis
  dan tidak bisa menyetel env sebelum modul toko dimuat.
```

- [ ] **Step 8: Commit**

```bash
git add vitest.config.mts src/lib/performa/store.ts src/lib/performa/store.test.ts AGENTS.md
git commit -m "feat(performa): toko catatan performa server-only per peserta"
```

---

## Task 5: Cermin progres di satu-satunya penulisnya

**Files:**
- Modify: `src/lib/courses/enrollment.ts`
- Modify: `src/actions/learning.ts`
- Modify: `src/actions/enrollment.test.ts`

**Interfaces:**
- Consumes (Task 4): `catatPenyelesaian`, `SumberPenyelesaian`. Consumes (sudah ada): `getCourseById` (dari `./store`), `session.nama`.
- Produces: `tandaiModul(courseId: string, modulId: string, owner: string, sumber?: SumberPenyelesaian, nama?: string): Promise<Pendaftaran | null>` — parameter ke-4 dan ke-5 opsional, sehingga semua pemanggil lama tetap sah tanpa perubahan.

**Mengapa di `tandaiModul`:** fungsi ini adalah **satu-satunya** penulis `selesai_modul`. Cermin yang ditulis di dua pemanggil bisa selalu berbeda pada salah satunya saja; cermin yang ditulis di satu tempat tidak mungkin.

- [ ] **Step 1: Tulis test yang gagal**

Di `src/actions/enrollment.test.ts`, baca `beforeEach` (sekitar baris 100) dan catat email sesi yang aktif di sana. Helper `sesiUntuk(email)` sudah ada di berkas itu.

**Tambahkan pengalihan direktori per test** di dalam `beforeEach` yang sudah ada, agar berkas test ini tidak berbagi direktori dengan test toko:

```ts
  process.env.CAREEVO_PERFORMA_DIR = mkdtempSync(path.join(tmpdir(), "careevo-performa-enroll-"));
```

(`mkdtempSync`, `tmpdir`, dan `path` — pastikan sudah diimpor; `path` sudah diimpor di berkas ini, dua lainnya belum.)

Tambahkan dua test:

```ts
  it("mencerminkan penyelesaian ke toko performa dengan sumber informal", async () => {
    setelKebijakan(KURSUS_OPSIONAL, "opsional");
    const modul = await modulMateriBaru(KURSUS_OPSIONAL);
    await daftarKursus(KURSUS_OPSIONAL, KURSUS_OPSIONAL);
    await tandaiModulAction(KURSUS_OPSIONAL, modul.id);

    const { bacaPerforma } = await import("@/lib/performa/store");
    const record = await bacaPerforma("user@careevo.test");
    const selesai = record?.kursus.find((k) => k.course_id === KURSUS_OPSIONAL)?.selesai ?? [];
    expect(selesai).toHaveLength(1);
    expect(selesai[0].sumber).toBe("informal");
  });

  it("melepas cermin ketika peserta membatalkan penandaan", async () => {
    setelKebijakan(KURSUS_OPSIONAL, "opsional");
    const modul = await modulMateriBaru(KURSUS_OPSIONAL);
    await daftarKursus(KURSUS_OPSIONAL, KURSUS_OPSIONAL);
    await tandaiModulAction(KURSUS_OPSIONAL, modul.id);
    await tandaiModulAction(KURSUS_OPSIONAL, modul.id);

    const { bacaPerforma } = await import("@/lib/performa/store");
    const record = await bacaPerforma("user@careevo.test");
    const selesai = record?.kursus.find((k) => k.course_id === KURSUS_OPSIONAL)?.selesai ?? [];
    expect(selesai).toHaveLength(0);
  });
```

> Ganti `"user@careevo.test"` bila `beforeEach` berkas itu memasang sesi lewat `sesiUntuk(...)` untuk email lain. Email itulah pemilik catatannya, jadi test akan gagal bila tidak cocok.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/actions/enrollment.test.ts -t "cermin"`
Expected: FAIL — `record` bernilai `null`, sehingga `selesai` kosong.

- [ ] **Step 3: Tambahkan cermin di `tandaiModul`**

Di `src/lib/courses/enrollment.ts`, ganti fungsi `tandaiModul` beserta dokumentasinya:

```ts
/**
 * Tandai/batalkan satu modul selesai; mengembalikan entri terbaru.
 *
 * `sumber` mencatat **jalur** penyelesaian, bukan hanya hasilnya. Tanpa itu,
 * dashboard tidak bisa membedakan modul yang lolos gerbang sesi terverifikasi
 * dari modul yang peserta tandai sendiri — dan perbedaan itu justru yang
 * membuat laporan ini berguna bagi verifikator.
 *
 * Cermin ke toko performa ditulis di sini, di **satu-satunya** penulis
 * `selesai_modul`, supaya cermin dan cookie tidak bisa berbeda: dua pemanggil
 * yang menulis ke dua tempat bisa selalu berbeda pada salah satunya saja.
 */
export async function tandaiModul(
  courseId: string,
  modulId: string,
  owner: string,
  sumber: SumberPenyelesaian = "informal",
  nama: string = "",
): Promise<Pendaftaran | null> {
  const daftar = await baca();
  const entri = daftar.find(
    (item) => item.course_id === courseId && milikPemilik(item, owner),
  );
  if (!entri) return null;
  const baruDitandai = !entri.selesai_modul.includes(modulId);
  entri.selesai_modul = baruDitandai
    ? [...entri.selesai_modul, modulId]
    : entri.selesai_modul.filter((id) => id !== modulId);
  await tulis(daftar);

  const kursus = await getCourseById(courseId);
  await catatPenyelesaian({
    owner,
    nama,
    courseId,
    judulKursus: kursus?.title ?? courseId,
    modulId,
    sumber,
    batal: !baruDitandai,
  });

  return entri;
}
```

Tambahkan dua import di kepala berkas:

```ts
import { getCourseById } from "./store";
import { catatPenyelesaian, type SumberPenyelesaian } from "@/lib/performa/store";
```

**Perhatikan arah import:** `store.ts` tidak mengimpor `enrollment.ts`, jadi tidak ada siklus.

- [ ] **Step 4: Teruskan sumber dari jalur terverifikasi**

Di `src/actions/learning.ts`, di `selesaikanMateriAction`, ubah pemanggilan:

```ts
    await tandaiModul(kursus.id, input.modulId, session.email, "terverifikasi", session.nama);
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npx vitest run src/actions/enrollment.test.ts`
Expected: PASS. Test lama yang memeriksa `selesai_modul` tidak berubah perilakunya.

- [ ] **Step 6: Buktikan cermin benar-benar sinkron dua arah**

Hapus `batal: !baruDitandai` dan jalankan test "melepas cermin" — harus **FAIL** (cermin tidak pernah dilepas saat pembatalan). Kembalikan. Lalu pindahkan blok `catatPenyelesaian` **ke atas** `await tulis(daftar)` dan jalankan ulang seluruh test enrollment — harus tetap PASS, karena kedua tulisan saling independen; kembalikan ke posisi semula.

- [ ] **Step 7: Gerbang manual**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/lib/courses/enrollment.ts src/actions/learning.ts src/actions/enrollment.test.ts
git commit -m "feat(performa): cermin progres modul beserta jalur penyelesaiannya"
```

---

## Task 6: Skor kuis dilaporkan klien, divalidasi server

**Files:**
- Create: `src/actions/performa.ts`
- Create: `src/actions/performa.test.ts`
- Modify: `src/components/features/learning/kuis-view.tsx`
- Modify: `src/components/features/learning/detail-kursus.tsx`
- Modify: `src/lib/learning/security.test.ts`

**Interfaces:**
- Consumes (sudah ada): `modulUntuk(courseId)`, `cariPendaftaran(courseId, owner)`, `getCourseById(id)`, `getSession()`.
- Consumes (Task 4): `catatSkorKuis`.
- Produces: `simpanNilaiKuisAction(input): Promise<{ ok: boolean; error?: string }>`; `KuisView` menerima dua prop baru **wajib**: `courseId: string`, `modulId: string`.

**Mengapa prop baru wajib:** `KuisView` saat ini hanya menerima `{ kuis, className }` — ia tidak tahu course maupun modul. Tanpa keduanya, catatan skor tidak bisa dikunci dengan benar, dan satu kuis yang terpasang di beberapa modul akan menghasilkan catatan yang tidak bisa dibedakan.

**Kunci record bukan `kuis.id`:** satu kuis sering dipasang di beberapa modul sekaligus (lihat komentar di `kuis-view.tsx`). Kuncinya adalah kombinasi `(courseId, modulId, kuisId)`.

- [ ] **Step 1: Tulis test aksi yang gagal**

Buat `src/actions/performa.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const DIR = mkdtempSync(path.join(tmpdir(), "careevo-performa-act-"));
process.env.CAREEVO_PERFORMA_DIR = DIR;

const mocks = vi.hoisted(() => ({
  modulUntuk: vi.fn(),
  cariPendaftaran: vi.fn(),
  getCourseById: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));
vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/courses/modul-resolver", () => ({ modulUntuk: mocks.modulUntuk }));
vi.mock("@/lib/courses/enrollment", () => ({ cariPendaftaran: mocks.cariPendaftaran }));
vi.mock("@/lib/courses/store", () => ({ getCourseById: mocks.getCourseById }));

const { simpanNilaiKuisAction } = await import("./performa");
const { bacaPerforma, resetPerforma } = await import("@/lib/performa/store");

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

const MODUL = {
  id: "crs-1-m1",
  judul: "Modul",
  kuis: [{ id: "kuis-1", soal: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] }],
};
const SKOR = { courseId: "crs-1", modulId: "crs-1-m1", kuisId: "kuis-1", nilai: 60, totalSoal: 3 };

beforeEach(() => {
  mocks.getSession.mockResolvedValue({
    email: "siswa@careevo.test", nama: "Siswa", username: "siswa", role: "user", iat: 1,
  });
  mocks.modulUntuk.mockResolvedValue([MODUL]);
  mocks.cariPendaftaran.mockResolvedValue({ course_id: "crs-1", selesai_modul: [] });
  mocks.getCourseById.mockResolvedValue({ id: "crs-1", title: "Fullstack Web" });
});

describe("simpanNilaiKuisAction", () => {
  it("menyimpan skor untuk kuis yang benar-benar terpasang di modul", async () => {
    await resetPerforma();
    const hasil = await simpanNilaiKuisAction(SKOR);
    expect(hasil.ok).toBe(true);
    const tersimpan = (await bacaPerforma("siswa@careevo.test"))?.kursus[0].kuis;
    expect(tersimpan?.[0]).toMatchObject({ kuis_id: "kuis-1", nilai: 60, sumber: "klien" });
  });

  it("menolak skor untuk kuis yang tidak terpasang pada modul", async () => {
    mocks.modulUntuk.mockResolvedValue([{ id: "crs-1-m1", judul: "Modul", kuis: [] }]);
    const hasil = await simpanNilaiKuisAction(SKOR);
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("kuis");
  });

  it("menolak skor untuk course yang tidak diikuti", async () => {
    mocks.cariPendaftaran.mockResolvedValue(undefined);
    const hasil = await simpanNilaiKuisAction(SKOR);
    expect(hasil.ok).toBe(false);
  });

  it("menolak jumlah soal yang tidak cocok dengan bank soal", async () => {
    const hasil = await simpanNilaiKuisAction({ ...SKOR, totalSoal: 99 });
    expect(hasil.ok).toBe(false);
  });

  it("menolak modul yang tidak ada pada kurikulum", async () => {
    mocks.modulUntuk.mockResolvedValue([{ id: "lain", judul: "Lain", kuis: [] }]);
    const hasil = await simpanNilaiKuisAction(SKOR);
    expect(hasil.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/actions/performa.test.ts`
Expected: FAIL — `Cannot find module './performa'`.

- [ ] **Step 3: Implementasikan aksi**

Buat `src/actions/performa.ts`:

```ts
"use server";

import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/courses/store";
import { cariPendaftaran } from "@/lib/courses/enrollment";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import { catatSkorKuis } from "@/lib/performa/store";

export interface SimpanNilaiState {
  ok: boolean;
  error?: string;
}

/**
 * Simpan skor kuis yang dihitung di peramban.
 *
 * **Skor ini belum dinilai server.** Kunci jawaban ikut terkirim ke perender,
 * jadi peramban yang menghitung juga bisa memalsukannya. Yang bisa diperiksa
 * di sini hanya **bentuk** angkanya: peserta terdaftar, modul ada, kuisnya
 * benar-benar terpasang, jumlah soal cocok dengan bank, rentang 0–100.
 * Substansi nilainya baru bisa dijamin setelah penilaian pindah ke server;
 * sampai itu terjadi, setiap skor wajib ditampilkan sebagai "dilaporkan klien".
 */
export async function simpanNilaiKuisAction(input: {
  courseId: string;
  modulId: string;
  kuisId: string;
  nilai: number;
  totalSoal: number;
}): Promise<SimpanNilaiState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Masuk dulu untuk menyimpan nilai kuis." };

  const pendaftaran = await cariPendaftaran(input.courseId, session.email);
  if (!pendaftaran) return { ok: false, error: "Daftar kursus ini dulu." };

  const modul = (await modulUntuk(input.courseId)).find((m) => m.id === input.modulId);
  if (!modul) return { ok: false, error: "Modul tidak ditemukan pada kurikulum saat ini." };

  const kuis = modul.kuis.find((k) => k.id === input.kuisId);
  if (!kuis) return { ok: false, error: "Kuis ini tidak terpasang pada modul tersebut." };
  if (kuis.soal.length !== input.totalSoal) return { ok: false, error: "Jumlah soal tidak cocok." };

  const kursus = await getCourseById(input.courseId);
  await catatSkorKuis({
    owner: session.email,
    nama: session.nama,
    courseId: input.courseId,
    judulKursus: kursus?.title ?? input.courseId,
    kuisId: input.kuisId,
    modulId: input.modulId,
    nilai: input.nilai,
    totalSoal: input.totalSoal,
  });

  return { ok: true };
}
```

- [ ] **Step 4: Teruskan konteks ke `KuisView`**

Di `src/components/features/learning/detail-kursus.tsx`, baris ~464, ganti:

```tsx
<KuisView key={kuis.id} kuis={kuis} courseId={kursus.id} modulId={m.id} />
```

`kursus` dan `m` sudah berada dalam cakupan di titik itu — `daftarKuis` dibaca dari `m.kuis` beberapa baris di atasnya.

- [ ] **Step 5: Kirim skor dari `KuisView`**

Di `src/components/features/learning/kuis-view.tsx`, tambahkan import di kepala berkas:

```tsx
import { simpanNilaiKuisAction } from "@/actions/performa";
```

Ganti tanda tangan fungsi:

```tsx
export function KuisView({
  kuis,
  courseId,
  modulId,
  className,
}: {
  kuis: Kuis;
  courseId: string;
  modulId: string;
  className?: string;
}) {
```

Ganti `onClick` tombol periksa jawaban (sekitar baris 115) dari:

```tsx
onClick={() => setNilai(nilaiSekarang())}
```

menjadi:

```tsx
onClick={() => {
  const hasil = nilaiSekarang();
  setNilai(hasil);
  // Fire-and-forget: kegagalan penyimpanan tidak boleh memblokir latihan.
  // Peserta tetap melihat nilainya; yang hilang hanya catatan untuk staf.
  void simpanNilaiKuisAction({
    courseId,
    modulId,
    kuisId: kuis.id,
    nilai: hasil,
    totalSoal: soal.length,
  }).catch(() => undefined);
}}
```

Ganti blok komentar di kepala komponen (sekitar baris 15-22) — yang sekarang menyatakan penilaian tidak dikirim ke mana pun — dengan:

```tsx
/**
 * Penilaian terjadi di peramban lalu **dikirim ke server sebagai catatan** —
 * bukan sebagai nilai terverifikasi. Kunci jawaban ikut terkirim ke perender,
 * jadi peramban yang menghitung juga bisa memalsukannya; server memvalidasi
 * bentuk angkanya saja. Skor seperti ini **wajib** dilabeli "dilaporkan klien"
 * di mana pun ia ditampilkan, dan kuis tetap alat latihan — bukan ujian yang
 * tahan curang.
 */
```

- [ ] **Step 6: Jalankan test**

Run: `npx vitest run src/actions/performa.test.ts && npm run typecheck`
Expected: PASS dan tanpa error tipe.

- [ ] **Step 7: Pastikan kunci jawaban tidak bocor lewat jalur baru**

Tambahkan ke `src/lib/learning/security.test.ts`:

```ts
describe("skor kuis tidak membocorkan kunci", () => {
  it("aksi penyimpanan nilai tidak pernah menyebut kunci jawaban", () => {
    expect(
      readFileSync(path.join(ROOT, "src/actions/performa.ts"), "utf8"),
    ).not.toContain("jawaban_benar");
  });
});
```

Test ini memindai **seluruh teks berkas, termasuk komentar**. Kode di Step 3 sudah ditulis tanpa kata itu (komentarnya memakai "kunci jawaban", bukan `jawaban_benar`). Kalau saat menulis ulang berkas itu kau memakai literal `jawaban_benar` di mana pun — termasuk di dalam kalimat penjelasan — ganti dengan "kunci jawaban", supaya test ini tidak gagal karena alasan yang tidak terlihat.

- [ ] **Step 8: Gerbang manual + build**

Run: `npm run check` lalu `npm run build`
Expected: keduanya exit 0. Build **wajib**, bukan opsional: `kuis-view.tsx` adalah komponen klien yang sekarang mengimpor server action, dan pelanggaran batas server/klien hanya tertangkap build.

- [ ] **Step 9: Commit**

```bash
git add src/actions/performa.ts src/actions/performa.test.ts src/components/features/learning/kuis-view.tsx src/components/features/learning/detail-kursus.tsx src/lib/learning/security.test.ts
git commit -m "feat(performa): simpan skor kuis yang dilaporkan klien"
```

---

## Task 7: Pembaca integritas dari run sesi

**Files:**
- Create: `src/lib/performa/integritas.ts`
- Create: `src/lib/performa/integritas.test.ts`

**Interfaces:**
- Consumes (Task 2): `listRun()`. Consumes type: `SessionRun`.
- Produces: `RingkasanIntegritas`, `RingkasanSesi`, `ringkasIntegritasByOwner(runs: SessionRun[]): Map<string, RingkasanIntegritas>`.

**Kenapa tidak menyalin:** `.data/sessions/` sudah merupakan sumber kebenaran integritas. Menyalinnya ke toko performa membuat dua sumber kebenaran yang bisa berbeda tanpa ada yang memperingatkan.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/performa/integritas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { KejadianIntegritas, SessionRun } from "@/lib/learning/session";
import { ringkasIntegritasByOwner } from "./integritas";

function kejadian(
  jenis: KejadianIntegritas["jenis"],
  jenis_klasifikasi: KejadianIntegritas["jenis_klasifikasi"],
): KejadianIntegritas {
  return { at: "2026-09-25T10:05:00.000Z", jenis, jenis_klasifikasi, visibilitas: "hidden" };
}

function run(partial: Partial<SessionRun> & Pick<SessionRun, "id" | "owner">): SessionRun {
  return {
    course_id: "crs-1",
    policy_version: 1,
    status: "aktif",
    mulai_at: "2026-09-25T10:00:00.000Z",
    berakhir_at: null,
    kejadian: [],
    ...partial,
  };
}

describe("ringkasIntegritasByOwner", () => {
  it("mengelompokkan kejadian dan celah per pemilik", () => {
    const peta = ringkasIntegritasByOwner([
      run({ id: "s1", owner: "a@x.test", kejadian: [kejadian("pindah_tab", "kejadian")] }),
      run({ id: "s2", owner: "a@x.test", status: "kedaluwarsa", kejadian: [kejadian("kamera_gagal", "celah")] }),
      run({ id: "s3", owner: "b@x.test" }),
    ]);

    const a = peta.get("a@x.test");
    expect(a?.sesi).toBe(2);
    expect(a?.kejadian).toBe(1);
    expect(a?.celah).toBe(1);
    expect(a?.kedaluwarsa).toBe(1);
    expect(peta.get("b@x.test")?.sesi).toBe(1);
  });

  it("tidak pernah mengembalikan nilai, skor, atau status kelulusan apa pun", () => {
    const peta = ringkasIntegritasByOwner([run({ id: "s1", owner: "a@x.test" })]);
    // Ringkasan ini untuk ditampilkan. Bentuk field-nya dikunci supaya tidak
    // diam-diam ditambahkan nilai yang nanti terpakai sebagai vonis.
    expect(Object.keys(peta.get("a@x.test")!).sort()).toEqual([
      "celah", "daftar", "kedaluwarsa", "kejadian", "sesi",
    ]);
  });

  it("mengurutkan riwayat sesi dari yang terbaru", () => {
    const peta = ringkasIntegritasByOwner([
      run({ id: "lama", owner: "a@x.test", mulai_at: "2026-09-20T10:00:00.000Z" }),
      run({ id: "baru", owner: "a@x.test", mulai_at: "2026-09-25T10:00:00.000Z" }),
    ]);
    expect(peta.get("a@x.test")?.daftar.map((s) => s.run_id)).toEqual(["baru", "lama"]);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/lib/performa/integritas.test.ts`
Expected: FAIL — `Cannot find module './integritas'`.

- [ ] **Step 3: Implementasikan pembaca**

Buat `src/lib/performa/integritas.ts`:

```ts
import type { SessionRun } from "@/lib/learning/session";

/**
 * Pembacaan integritas untuk laporan staf.
 *
 * Membaca `.data/sessions/` secara langsung dan **menyimpan ulang tidak
 * apa pun** ke toko performa: menyalin akan menciptakan dua sumber kebenaran
 * yang bisa berbeda tanpa ada yang memperingatkan, sedangkan `.data/sessions/`
 * sudah merupakan sumber kebenarannya.
 *
 * Yang dikembalikan adalah **konteks**, bukan vonis. Ringkasan di bawah tidak
 * pernah menjadi skor, tidak pernah memengaruhi kelulusan, dan tidak pernah
 * memengaruhi reputasi. Angka "celah" menjelaskan apa yang tercatat — bukan
 * siapa yang dipercaya.
 */
export interface RingkasanSesi {
  run_id: string;
  course_id: string;
  status: SessionRun["status"];
  mulai_at: string;
  berakhir_at: string | null;
  kejadian: number;
  celah: number;
}

export interface RingkasanIntegritas {
  sesi: number;
  kejadian: number;
  celah: number;
  kedaluwarsa: number;
  daftar: RingkasanSesi[];
}

export function ringkasIntegritasByOwner(runs: SessionRun[]): Map<string, RingkasanIntegritas> {
  const peta = new Map<string, RingkasanIntegritas>();

  for (const run of runs) {
    const isi = peta.get(run.owner) ?? {
      sesi: 0, kejadian: 0, celah: 0, kedaluwarsa: 0, daftar: [],
    };
    const kejadian = run.kejadian.filter((k) => k.jenis_klasifikasi === "kejadian").length;
    const celah = run.kejadian.length - kejadian;

    isi.sesi += 1;
    isi.kejadian += kejadian;
    isi.celah += celah;
    if (run.status === "kedaluwarsa") isi.kedaluwarsa += 1;
    isi.daftar.push({
      run_id: run.id,
      course_id: run.course_id,
      status: run.status,
      mulai_at: run.mulai_at,
      berakhir_at: run.berakhir_at,
      kejadian,
      celah,
    });
    peta.set(run.owner, isi);
  }

  for (const isi of peta.values()) {
    isi.daftar.sort((a, b) => b.mulai_at.localeCompare(a.mulai_at));
  }
  return peta;
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run src/lib/performa/integritas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/performa/integritas.ts src/lib/performa/integritas.test.ts
git commit -m "feat(performa): ringkasan integritas per peserta dari run sesi"
```

---

## Task 8: Dashboard verifikator

**Files:**
- Create: `src/components/features/performa/performa-tabel.tsx`
- Create: `src/app/(verifikator)/performa/page.tsx`
- Create: `src/app/(verifikator)/performa/[owner]/page.tsx`
- Modify: `src/components/ui/dashboard-sidebar.tsx`
- Modify: `src/lib/learning/security.test.ts`

**Interfaces:**
- Consumes (Task 4): `indeksPerforma`, `bacaPerforma`. Consumes (Task 2): `listRun`. Consumes (Task 7): `ringkasIntegritasByOwner`, `RingkasanIntegritas`. Consumes (sudah ada): `AppShell`, `PageHead`, `isStaffRole` (dipakai layout).
- Produces: rute `/performa` dan `/performa/[owner]`; ekspor `PERINGATAN_LAPORAN`, `PeringatanLaporan`, `PerformaTabel`, `BarisPerforma`.

**Gerbang peran gratis:** `(verifikator)/layout.tsx` sudah memanggil `isStaffRole` dan mengalihkan bukan staf. Rute di dalam group itu karena pulangnya.

- [ ] **Step 1: Tulis static check yang gagal**

Tambahkan ke `src/lib/learning/security.test.ts`:

```ts
const BERKAS_PERFORMA = path.join(ROOT, "src/components/features/performa/performa-tabel.tsx");
const BERKAS_DAFTAR_PERFORMA = path.join(ROOT, "src/app/(verifikator)/performa/page.tsx");

describe("laporan performa tidak mengklaim lebih dari yang dilakukan", () => {
  it("menyatakan bahwa skor kuis dilaporkan klien", () => {
    const isi = readFileSync(BERKAS_PERFORMA, "utf8");
    expect(isi).toContain("PERINGATAN_LAPORAN");
    expect(isi).toContain("dilaporkan klien");
  });

  it("menyatakan kejadian integritas bukan dasar penilaian", () => {
    const isi = readFileSync(BERKAS_PERFORMA, "utf8");
    expect(isi).toContain("bukan dasar penilaian");
    expect(isi).toContain("tidak mengurangi skor");
  });

  it("memeriksa sesi sendiri, bukan hanya mengandalkan layout", () => {
    expect(readFileSync(BERKAS_DAFTAR_PERFORMA, "utf8")).toContain("getSession");
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run src/lib/learning/security.test.ts`
Expected: FAIL — `performa-tabel.tsx` belum ada.

- [ ] **Step 3: Buat komponen bersama**

Buat `src/components/features/performa/performa-tabel.tsx`:

```tsx
import type { RecordPerforma } from "@/lib/performa/store";
import type { RingkasanIntegritas } from "@/lib/performa/integritas";

/**
 * Peringatan yang wajib ikut di setiap halaman laporan.
 *
 * Dua klaim di bawah **tidak boleh dibuang** saat halaman ini disunting:
 * skor kuis dihitung di peramban, dan kejadian integritas adalah catatan
 * pengamatan — bukan vonis. Menampilkan keduanya tanpa pengaman membuat
 * dashboard menuduh tanpa bukti.
 */
export const PERINGATAN_LAPORAN = [
  "Skor kuis dilaporkan oleh klien dan belum dinilai server, sehingga belum dapat diperlakukan sebagai nilai terverifikasi.",
  "Kejadian integritas adalah konteks, bukan dasar penilaian: catatan ini tidak mengurangi skor, kelulusan, atau reputasi siapa pun.",
  "Web dan kamera tidak dapat menjamin bebas bantuan AI, joki, atau perangkat kedua.",
] as const;

export interface BarisPerforma extends RecordPerforma {
  integritas?: RingkasanIntegritas;
}

function rataRataKuis(record: RecordPerforma): number | null {
  const nilai = record.kursus.flatMap((k) => k.kuis.map((q) => q.nilai));
  if (nilai.length === 0) return null;
  return Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length);
}

export function PeringatanLaporan() {
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {PERINGATAN_LAPORAN.map((baris) => (
        <li key={baris}>{baris}</li>
      ))}
    </ul>
  );
}

export function PerformaTabel({ baris }: { baris: BarisPerforma[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <th className="p-3">Peserta</th>
            <th className="p-3">Modul selesai</th>
            <th className="p-3">Rata-rata kuis</th>
            <th className="p-3">Sesi</th>
            <th className="p-3">Kejadian / celah</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((record) => {
            const selesai = record.kursus.reduce((n, k) => n + k.selesai.length, 0);
            const terverifikasi = record.kursus.reduce(
              (n, k) => n + k.selesai.filter((s) => s.sumber === "terverifikasi").length,
              0,
            );
            const rata = rataRataKuis(record);
            const i = record.integritas;
            return (
              <tr key={record.owner} className="border-b border-border last:border-0">
                <td className="p-3">
                  <a className="font-medium underline" href={`/performa/${encodeURIComponent(record.owner)}`}>
                    {record.nama}
                  </a>
                  <p className="text-xs text-muted-foreground">{record.owner}</p>
                </td>
                <td className="p-3">
                  {selesai}
                  <p className="text-xs text-muted-foreground">{terverifikasi} terverifikasi</p>
                </td>
                <td className="p-3">
                  {rata === null ? "—" : `${rata}/100`}
                  <p className="text-xs text-muted-foreground">dilaporkan klien</p>
                </td>
                <td className="p-3">{i?.sesi ?? 0}</td>
                <td className="p-3">
                  {i ? `${i.kejadian} / ${i.celah}` : "—"}
                  {i && i.kedaluwarsa > 0 ? (
                    <p className="text-xs text-muted-foreground">{i.kedaluwarsa} kedaluwarsa</p>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {baris.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Belum ada catatan performa.</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Buat halaman daftar**

Buat `src/app/(verifikator)/performa/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import {
  PeringatanLaporan,
  PerformaTabel,
} from "@/components/features/performa/performa-tabel";
import { indeksPerforma } from "@/lib/performa/store";
import { ringkasIntegritasByOwner } from "@/lib/performa/integritas";
import { listRun } from "@/lib/learning/session";

export const metadata: Metadata = {
  title: "Laporan Performa",
};

export default async function PerformaPage() {
  // Gerbang peran datang dari `(verifikator)/layout.tsx`. Pemeriksaan di sini
  // tetap ditulis supaya halaman ini tidak diam-diam terbuka bila dipindah.
  const session = await getSession();
  if (!session) return null;

  const [catatan, runs] = await Promise.all([indeksPerforma(), listRun()]);
  const integritas = ringkasIntegritasByOwner(runs);

  return (
    <AppShell session={session} current="/performa">
      <PageHead
        eyebrow="Area verifikator"
        title="Laporan performa peserta"
        lead="Progres, skor kuis, dan catatan integritas. Angka berasal dari catatan server; baca peringatan di bawah sebelum memakai laporan ini untuk keputusan apa pun."
      />
      <div className="space-y-4">
        <PeringatanLaporan />
        <PerformaTabel
          baris={catatan.map((record) => ({
            ...record,
            integritas: integritas.get(record.owner),
          }))}
        />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Buat halaman detail**

Buat `src/app/(verifikator)/performa/[owner]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { PeringatanLaporan } from "@/components/features/performa/performa-tabel";
import { bacaPerforma } from "@/lib/performa/store";
import { ringkasIntegritasByOwner } from "@/lib/performa/integritas";
import { listRun } from "@/lib/learning/session";

export const metadata: Metadata = {
  title: "Detail Performa",
};

export default async function PerformaDetailPage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { owner } = await params;
  const [record, runs] = await Promise.all([bacaPerforma(owner), listRun()]);
  if (!record) notFound();

  const daftarSesi =
    ringkasIntegritasByOwner(runs.filter((r) => r.owner === record.owner)).get(record.owner)
      ?.daftar ?? [];

  return (
    <AppShell session={session} current="/performa">
      <PageHead
        eyebrow="Area verifikator"
        title={record.nama}
        lead={record.owner}
        actions={
          <Link className="text-sm underline" href="/performa">
            Kembali ke daftar
          </Link>
        }
      />

      <div className="space-y-4">
        <PeringatanLaporan />

        <section className="card" aria-labelledby="performa-kursus">
          <h2 className="card-title" id="performa-kursus">
            Progres &amp; kuis
          </h2>
          {record.kursus.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada course yang tercatat.</p>
          ) : (
            record.kursus.map((kursus) => (
              <div key={kursus.course_id} className="mt-4">
                <h3 className="text-sm font-semibold">{kursus.judul}</h3>
                <ul className="list-app mt-2">
                  {kursus.selesai.map((s) => (
                    <li className="list-app-row" key={s.modul_id}>
                      <span className="row-title">{s.modul_id}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.sumber} · {s.at}
                      </span>
                    </li>
                  ))}
                  {kursus.kuis.map((q) => (
                    <li className="list-app-row" key={`${q.kuis_id}-${q.at}`}>
                      <span className="row-title">
                        {q.kuis_id} — {q.nilai}/100
                      </span>
                      <span className="text-xs text-muted-foreground">
                        dilaporkan klien · {q.total_soal} soal · {q.at}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <section className="card" aria-labelledby="performa-sesi">
          <h2 className="card-title" id="performa-sesi">
            Riwayat sesi
          </h2>
          {daftarSesi.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada sesi tercatat.</p>
          ) : (
            <ul className="list-app">
              {daftarSesi.map((s) => (
                <li className="list-app-row" key={s.run_id}>
                  <span className="row-title">{s.course_id}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.status} · {s.kejadian} kejadian · {s.celah} celah · {s.mulai_at}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 6: Tambahkan navigasi staf**

Di `src/components/ui/dashboard-sidebar.tsx`, tambahkan `BarChart3` ke impor `lucide-react`, lalu tambahkan satu item di grup `Verifikator` pada `STAFF_GROUPS`:

```ts
      { href: "/performa", title: "Laporan Performa", icon: BarChart3 },
```

- [ ] **Step 7: Jalankan test dan typecheck**

Run: `npx vitest run src/lib/learning/security.test.ts && npm run typecheck`
Expected: PASS dan tanpa error tipe.

- [ ] **Step 8: Gerbang manual**

Run: `npm run check` lalu `npm run build`
Expected: keduanya exit 0.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(verifikator)/performa" src/components/features/performa/performa-tabel.tsx src/components/ui/dashboard-sidebar.tsx src/lib/learning/security.test.ts
git commit -m "feat(verifikator): dashboard laporan performa peserta"
```

---

## Task 9: Verifikasi akhir

**Files:**
- Modify: `src/lib/learning/security.test.ts` hanya bila ada invarian yang belum dipatok.

**Interfaces:**
- Consumes: seluruh hasil Task 1-8.
- Produces: bukti bahwa kedua bagian bekerja bersama.

- [ ] **Step 1: Jalankan gerbang lengkap**

Run: `npm run check`
Expected: exit 0 (typecheck → lint → skills:check → test). Catat jumlah berkas test dan total test yang dilaporkan.

- [ ] **Step 2: Jalankan build produksi**

Run: `npm run build`
Expected: exit 0. Wajib, bukan opsional: `kuis-view.tsx` (klien) baru mengimpor server action, dan `detail-kursus.tsx` meneruskan prop baru — pelanggaran batas server/klien hanya tertangkap build.

- [ ] **Step 3: Pastikan seluruh static check hidup**

Run: `npx vitest run src/lib/learning/security.test.ts`
Expected: PASS. Baca keluarannya dan pastikan semua blok `describe` ada: `keamanan jalur ujian`, `gerbang UI sesi terverifikasi`, `gerbang aturan bantuan pada tutor`, `skor kuis tidak membocorkan kunci`, `laporan performa tidak mengklaim lebih dari yang dilakukan`.

- [ ] **Step 4: Cek manual di dev server**

Run: `npm run dev`

Periksa satu per satu:
1. `/performa` sebagai akun verifikator → tabel tampil beserta peringatan.
2. `/performa` sebagai akun peserta → dialihkan oleh layout `(verifikator)`.
3. `/p/<username>` → **tidak** menampilkan data performa apa pun.
4. Course dengan `aturan_bantuan: "tanpa_ai"` → StudyChat menolak dengan pesan kebijakan dan transkrip tidak bertambah.
5. Course `bertutor` → StudyChat tetap melayani.
6. Selesaikan satu modul di course `wajib` → record muncul di `/performa/<email>` dengan sumber `terverifikasi`.

- [ ] **Step 5: Commit terakhir bila ada perubahan**

```bash
git status --short
git add -A
git commit -m "test(performa): invarian laporan dan verifikasi akhir" --allow-empty
```

- [ ] **Step 6: Tutup dengan ringkasan bukti**

Laporkan ke pengguna:
- keluaran `npm run check` (jumlah berkas test dan total test),
- keluaran `npm run build`,
- daftar commit yang dibuat,
- dan **kejujuran yang harus disebut eksplisit**:
  - skor kuis dilaporkan klien dan belum dinilai server;
  - `logAudit` masih stub, sehingga pembacaan laporan oleh staf belum ter-audit;
  - retensi data belum ditetapkan;
  - kamera belum berjalan;
  - kejadian integritas adalah konteks, bukan dasar penilaian.

---

## Appendix A: Pemetaan spesifikasi → task

| Bagian spesifikasi | Task |
|---|---|
| A1 Gerbang chatbot | Task 1 |
| A2 `berlaku_hingga` + status `kedaluwarsa` | Task 2 |
| A2 `lewatBatas` per modul | Task 2 (fungsi), Task 3 (pemasangan) |
| A2 Satu run aktif (resume/restart) | Task 3 |
| B0 Toko performa + isolasi test | Task 4 |
| B1 Cermin progres + provenance | Task 5 |
| B2 Skor kuis (opsi A) | Task 6 |
| B3 Pembaca integritas | Task 7 |
| B4 Dashboard + navigasi + label wajib | Task 8 |
| Kriteria keberhasilan / verifikasi | Task 9 |

## Appendix B: Celah yang sengaja dibiarkan terbuka

Hal-hal berikut **tidak** diperbaiki oleh plan ini. Sebutkan eksplisit saat menutup pekerjaan, supaya tidak terbaca sebagai sesuatu yang sudah aman:

| Celah | Kenapa dibiarkan |
|---|---|
| `jawaban_benar` masih dikirim ke peramban | Memerlukan penilaian server (Opsi B) — keputusan produk tersendiri, sudah disepakati untuk pass berikutnya. |
| `logAudit` masih melempar "belum diimplementasikan" | Pembacaan laporan oleh staf belum ter-audit. |
| Retensi data performa belum ditetapkan | Keputusan produk #3 masih terbuka. |
| Kamera belum berjalan | Di luar cakupan sejak awal; copy sudah menyatakan hal ini. |
| Sesi dan kejadian integritas dilaporkan klien | Sinyal advisory; tidak pernah menurunkan skor. |
| Modul checkpoint `kuis`/`proyek` belum punya jalur penyelesaian server | Terpisah dari pekerjaan ini; `selesaikanMateriAction` masih menolak keduanya. |
| Tidak ada `middleware.ts` | Gerbang tetap di layout route group, sesuai konvensi repo. |
