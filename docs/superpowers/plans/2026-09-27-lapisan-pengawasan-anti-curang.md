# Lapisan Pengawasan Anti-Curang Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambah tiga lapisan deteksi kecurangan di atas yang sudah ada — sinyal browser (Tier 1), kamera (Tier 2), dan pembacaan sinyal lockdown browser (Tier 3) — semuanya tercatat sebagai konteks yang ditinjau manusia, bukan vonis otomatis.

**Architecture:** Semua sinyal baru masuk ke `learning_events` yang **sudah ada** lewat `JENIS_KEJADIAN_SAH` + `payloadRedacted` — tanpa migrasi database. Klien mengirim sinyal; server memvalidasi jenis lewat daftar yang sudah ada, menghitung turunan yang bisa diandalkan (jarak ketik↔paste) dari `detail` yang sudah terpotong 300 karakter, dan menurunkan `temuanSesi` yang sudah ada. `AturanPengawasan` mendapat nilai ketiga `wajib_kamera` yang **diturunkan** per course — `completion_path` di database tetap dua nilai karena punya CHECK constraint.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest 5 (node env, tanpa jsdom), Drizzle ORM + PostgreSQL, HMAC-SHA256, MediaPipe Tasks Vision (face detection, client-side), `navigator.mediaDevices` (kamera).

**Spec:** `docs/superpowers/specs/2026-09-27-lapisan-pengawasan-anti-curang-design.md`

## Global Constraints

- **Copy berbahasa Indonesia** (`id`) dan `<html lang>` tetap `id`.
- **Modul klien (`akses.ts`, `kebijakan.ts`, `pengawasan-klien.ts`) harus tetap MURNI** — satu impor nilai dari modul `node:fs` menjatuhkan bundel klien. `npm run build` adalah gerbangnya; `npm run check` bukan.
- **Tidak ada `dangerouslySetInnerHTML`** di mana pun (repo tidak punya sanitizer).
- **`jenis` kejadian divalidasi di wire** terhadap `JENIS_KEJADIAN_SAH` sebelum menyentuh database (`learning.ts:168`). Jenis baru harus masuk array itu, bukan lolos lewat jalur lain.
- **`detail` dipotong 300 karakter di service** (`run-service.ts:197`) — payload sinyal baru ikut terpotong, jadi jangan mengirim data besar.
- **Kejadian integritas tidak pernah menurunkan skor, reputasi, atau kelulusan** (P2 spec). Sinyal baru adalah konteks.
- **Tidak boleh ada kata vonis** (`curang`, `menyalin`, `mencontek`, `bersalah`, `penyalahgunaan`) di output yang dilihat staf maupun peserta — dijaga test `integritas.test.ts:129-151`.
- **Setiap sumber sinyal wajib menampilkan asalnya** (P3 spec): `browser`, `kamera`, `luar`, `server`.
- **`completion_path` tetap dua nilai** (`terverifikasi`, `informal`) — CHECK constraint di `schema.ts:473`. Jalur kamera **diturunkan**, tidak disimpan.
- **Kamera tidak pernah aktif secara default** (P5 spec) dan butuh persetujuan terpisah.
- **Frame kamera tidak pernah dikirim ke server** pada pass ini — hanya angka turunan.
- **Aturan biznis berbahasa Indonesia, infra/UI bahasa Inggris** — ikuti bahasa berkas yang ada.
- **Test tidak boleh menulis ke `data/` atau `.data/`** milik repo.
- **Jalankan `npm run check` sebelum setiap commit** yang menutup satu task, dan `npm run build` setelah task yang menyentuh impor klien/server.
- **Pra-kondisi gate (per 2026-09-27, sudah rusak sebelum plan ini):** `npm run skills:check` gagal karena `.agents/skills/careevo-auth-db/` ada sebagai direktori **kosong** tanpa `SKILL.md`, dan `npm run typecheck` / `npm run lint` menyaring berkas di `backend/web/` dan `engine/`. Ketiganya **bukan** hasil perubahan pada plan ini. Selesaikan dulu atau catat sebagai baseline yang sudah rusak, lalu bandingkan **perubahan** jumlah galat sebelum/sesudah setiap task — jangan menganggap gate merah sebagai kegagalan task.
- **Jangan push** ke remote tanpa izin eksplisit pengguna.

## Peta File

**Create:**
- `src/lib/learning/pengawasan-klien.ts` — utilitas murni untuk klasifikasi sinyal browser (tanpa DOM): `sinyalPaste`, `sinyalPintasan`, `sinyalSalin`, `sejakDetikTerakhirMengetik`.
- `src/lib/learning/pengawasan-klien.test.ts` — tes utilitas murni.
- `src/lib/learning/kamera-klien.ts` — pembungkus MediaPipe face detection + `getUserMedia`. Klien saja.
- `src/lib/learning/sumber-sinyal.ts` — pemeta `KJenisKejadian` → asal sinyal (`browser`/`kamera`/`luar`/`server`) + batas yang wajib ditulis.
- `src/lib/learning/sumber-sinyal.test.ts` — tes pemeta dan kelengkapan batas.
- `src/components/features/learning/kamera-izin.tsx` — dialog persetujuan kamera + tombol nyalakan.

**Modify:**
- `src/lib/learning/akses.ts` — `JENIS_KEJADIAN_SAH` +7 jenis; `klasifikasiKejadian` recognises jenis baru; `KonteksAkses` + `adaBuktiKamera`; `putuskanAkses` + cabang `wajib_kamera`; `KeputusanAkses` + `perlu_kamera`.
- `src/lib/learning/akses.test.ts` — tes klasifikasi jenis baru + cabang `wajib_kamera`.
- `src/types/course.ts` — `AturanPengawasan` + `wajib_kamera`.
- `src/lib/courses/kebijakan.ts` — `LABEL_ATURAN_PENGAWASAN` + label baru; `PESAN_POLICY` + pesan `wajib_kamera`.
- `src/actions/learning.ts` — `selesaikanMateriAction`+: cek `wajib_kamera`; `catatKejadianAction` menerima `asal` dan `detail` terstruktur.
- `src/lib/learning/run-service.ts` — `catatKejadianDb` menerima payload sinyal terstruktur.
- `src/components/features/learning/course-session.tsx` — pasang listener Tier 1; integrasikan kamera opsional; ganti copy "kamera belum aktif" jadi jujur.
- `src/lib/performa/integritas.ts` — `temuanSesi` menambah temuan turunan untuk jenis baru; `LABEL_KEJADIAN` + label baru.
- `src/lib/performa/integritas.test.ts` — tes temuan baru, uji kata vonis diperluas.
- `src/lib/learning/dashboard.ts` — `kejadianDariEvent` membaca `asal` dari payload.
- `src/lib/learning/security.test.ts` — static check: copy "belum aktif" hilang hanya setelah `getUserMedia` ada; tidak ada kata vonis di komponen.
- `src/components/features/learning/kejadian-panel.tsx` — `LABEL_JENIS` + 7 label baru (map `Record<KJenisKejadian,string>` exhaustive; wajib ikut berubah saat Task 2 menambah jenis, kalau tidak typecheck merah).
- `src/components/features/performa/performa-integritas.tsx` — tampilkan asal sinyal di detail.
- `src/components/features/settings/settings-form.tsx` — perbarui paragraf kamera.
- `AGENTS.md` — dokumentasikan lapisan pengawasan & `wajib_kamera`.

---

# BAGIAN A — Lapisan 1: sinyal browser

Task 1–3. Tidak butuh izin, tidak butuh media, tidak menyentuh database. Bagian B dan C bergantung pada A.

---

## Task 1: Klasifikasi sinyal browser sebagai fungsi murni

Buat fungsi murni yang memutuskan apakah sebuah peristiwa browser layak dicatat. Ini adalah inti Tier 1: Threshold dan daftarCombination adalah keputusan bisnis, jadi ia harus **murni dan teruji**, bukan logika yang tersembunyi di dalam `addEventListener` (yang tidak bisa diuji di repo ini — lihat `careevo-browser-verify`).

**Files:**
- Create: `src/lib/learning/pengawasan-klien.ts`
- Create: `src/lib/learning/pengawasan-klien.test.ts`

**Interfaces:**
- Consumes: tidak ada (modul baru, murni).
- Produces:
  - `const AMBANG_PASTE_MINIMAL: number` = `200`
  - `const PINTAKAN_TERLARANG: readonly string[]` = `["c", "v", "x", "s", "p", "a", "tab"]`
  - `type SinyalFullscreen = { jenis: "keluar_fullscreen"; jumlah_keluar: number }`
  - `type SinyalPaste = { jenis: "paste_massal"; panjang: number; sejak_mengetik_detik: number }`
  - `type SinyalPintasan = { jenis: "pintasan_terlarang"; kombinasi: string }`
  - `type SinyalSalin = { jenis: "salin_terlarang"; panjang: number }`
  - `type SinyalBrowser = SinyalFullscreen | SinyalPaste | SinyalPintasan | SinyalSalin`
  - `function sinyalPaste(panjang: number, sejakMengetikDetik: number): SinyalPaste | null`
  - `function sinyalPintasan(e: { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean; key: string }): SinyalPintasan | null`
  - `function sinyalSalin(panjang: number): SinyalSalin | null`
  - `function sejakDetikTerakhirMengetik(terakhir: number | null, sekarang: number): number`

- [x] **Step 1: Write the failing test**

Buat `src/lib/learning/pengawasan-klien.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AMBANG_PASTE_MINIMAL,
  PINTAKAN_TERLARANG,
  sejakDetikTerakhirMengetik,
  sinyalPaste,
  sinyalPintasan,
  sinyalSalin,
} from "./pengawasan-klien";

describe("sinyalPaste", () => {
  it("mencatat paste yang panjangnya di atas ambang", () => {
    const hasil = sinyalPaste(400, 30);
    expect(hasil).toEqual({ jenis: "paste_massal", panjang: 400, sejak_mengetik_detik: 30 });
  });

  it("mengabaikan paste pendek", () => {
    expect(sinyalPaste(AMBANG_PASTE_MINIMAL - 1, 5)).toBeNull();
  });

  it("mencatat tepat di ambang", () => {
    // Batas inklusif: 200 karakter adalah pola "menyalin satu paragraf".
    expect(sinyalPaste(AMBANG_PASTE_MINIMAL, 1)).not.toBeNull();
  });

  it("tidak pernah melaporkan jeda negatif", () => {
    // Jam bisa melompat mundur (NTP, pergantian jam Sommer). Angka negatif akan
    // tampil di laporan sebagai "jeda -5 detik", yang tidak berarti apa pun.
    const hasil = sinyalPaste(500, -12);
    expect(hasil?.sejak_mengetik_detik).toBe(0);
  });
});

describe("sinyalPintasan", () => {
  it("mencatat ctrl+v dan meta+v", () => {
    expect(sinyalPintasan({ ctrl: true, meta: false, alt: false, shift: false, key: "v" }))
      .toEqual({ jenis: "pintasan_terlarang", kombinasi: "ctrl+v" });
    expect(sinyalPintasan({ ctrl: false, meta: true, alt: false, shift: false, key: "v" }))
      .toEqual({ jenis: "pintasan_terlarang", kombinasi: "meta+v" });
  });

  it("mencatat alt+tab", () => {
    expect(sinyalPintasan({ ctrl: false, meta: false, alt: true, shift: false, key: "tab" }))
      .toEqual({ jenis: "pintasan_terlarang", kombinasi: "alt+tab" });
  });

  it("mengabaikan tombol modifier sendirian", () => {
    // `key` modifier hanya ditekan, belum ada aksi — mencatatnya akan memenuhi
    // kuota kejadian dengan sinyal yang tidak berisi informasi apa pun.
    expect(sinyalPintasan({ ctrl: true, meta: false, alt: false, shift: false, key: "Control" })).toBeNull();
  });

  it("mengabaikan ketikan biasa tanpa modifier", () => {
    // Ini menjaga guard `if (!e.ctrl && !e.meta && !e.alt) return null;`.
    // Tanpa guard itu, ketikan `v` polos jatuh ke cabang `pengenal = "alt"`
    // dan TERCATAT sebagai `alt+v` — false positive untuk setiap huruf v/c/x
    // yang diketik normal. Tanpa test ini, guardnya bisa dihapus dan suite
    // tetap hijau.
    expect(sinyalPintasan({ ctrl: false, meta: false, alt: false, shift: false, key: "v" })).toBeNull();
  });

  it("mengabaikan kombinasi yang tidak masuk daftar", () => {
    expect(sinyalPintasan({ ctrl: true, meta: false, alt: false, shift: true, key: "r" })).toBeNull();
  });

  it("mendeteksi seluruh daftar terlarang", () => {
    for (const key of PINTAKAN_TERLARANG) {
      expect(sinyalPintasan({ ctrl: true, meta: false, alt: false, shift: false, key })).not.toBeNull();
    }
  });
});

describe("sinyalSalin", () => {
  it("mencatat menyalin di atas ambang", () => {
    expect(sinyalSalin(300)).toEqual({ jenis: "salin_terlarang", panjang: 300 });
  });

  it("mengabaikan menyalin pendek", () => {
    expect(sinyalSalin(AMBANG_PASTE_MINIMAL - 1)).toBeNull();
  });
});

describe("sejakDetikTerakhirMengetik", () => {
  it("menghitung detik sejak ketikan terakhir", () => {
    expect(sejakDetikTerakhirMengetik(1_000, 31_000)).toBe(30);
  });

  it("mengembalikan ambang besar saat belum ada ketikan", () => {
    // Tanpa ketikan sebelumnya, jeda tidak diketahui — bukan nol. Nilai besar
    // membuat paste pertama terlihat mencurigakan, yang memang Formatsnya benar:
    // menempel 400 karakter tanpa pernah mengetik bukan menulis.
    expect(sejakDetikTerakhirMengetik(null, 0)).toBe(9999);
  });

  it("tidak pernah negatif", () => {
    expect(sejakDetikTerakhirMengetik(10_000, 1_000)).toBe(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/learning/pengawasan-klien.test.ts`
Expected: FAIL — `Cannot find module '@/lib/learning/pengawasan-klien'`

- [x] **Step 3: Write minimal implementation**

Buat `src/lib/learning/pengawasan-klien.ts`:

```ts
/**
 * Klasifikasi sinyal browser untuk pemantauan anti-curang — **murni**.
 *
 * Modul ini tidak menyentuh DOM, `window`, `document`, `node:fs`, atau
 * `next/headers`. Ia hanya menerima angka dan bentuk peristiwa, lalu
 * memutuskan apakah peristiwa itu layak dicatat sebagai kejadian integritas.
 *
 * **Mengapa logikanya di sini, bukan di dalam `addEventListener`.** Repo ini
 * tidak punya harness render (Vitest `include` persis `src` dengan akhiran `.test.ts`,
 * environment `node`, tanpa jsdom), jadi logika yang hanya hidup di dalam
 * event listener tidak pernah diuji — persis kelas defect yang dicatat
 * `careevo-browser-verify`. Ambang dan daftar kombinasi adalah keputusan
 * bisnis, jadi ia harus bisa diuji tanpa browser.
 *
 * **Sinyal di sini adalah self-report.** Peramban peserta yang mengirimi
 * peristiwa-peristiwa ini bisa dimatikan melekat di peramban peserta. Karena itu tidak
 * satu pun dari sinyal ini boleh dipakai untuk menghukum: semuanya konteks
 * untuk ditinjau manusia.
 */

/** Panjang minimum (karakter) paste/salin yang dianggap bukan mengetik sendiri. */
export const AMBANG_PASTE_MINIMAL = 200;

/** Tombol yang dipetakan ke nama kanonik untuk payload. */
const NAMA_TOMBOL: Record<string, string> = {
  c: "c", v: "v", x: "x", s: "s", p: "p", a: "a", tab: "tab",
};

/**
 * Kombinasi yang paling sering dipakai membawa jawaban ke luar dari halaman
 * ujian: salin, tempel, potong, cetak layar, dan pindah jendela.
 */
export const PINTAKAN_TERLARANG: readonly string[] = ["c", "v", "x", "s", "p", "a", "tab"];

/**
 * Jeda "tidak diketahui" saat belum ada ketikan sama sekali.
 *
 * Angka besar, bukan nol: menempel 400 karakter tanpa pernah mengetik di
 * halaman itu bukan menulis. Menitipkan `0` akan membaca sebaliknya.
 */
export const JEDA_TIDAK_DIKETAHUI = 9999;

export interface SinyalFullscreen {
  jenis: "keluar_fullscreen";
  jumlah_keluar: number;
}
export interface SinyalPaste {
  jenis: "paste_massal";
  panjang: number;
  sejak_mengetik_detik: number;
}
export interface SinyalPintasan {
  jenis: "pintasan_terlarang";
  kombinasi: string;
}
export interface SinyalSalin {
  jenis: "salin_terlarang";
  panjang: number;
}

export type SinyalBrowser = SinyalFullscreen | SinyalPaste | SinyalPintasan | SinyalSalin;

function tidakSah(nilai: number): boolean {
  return !Number.isFinite(nilai) || nilai < 0;
}

/** Detik sejak ketikan terakhir; tidak pernah negatif dan tidak pernah `NaN`. */
export function sejakDetikTerakhirMengetik(terakhir: number | null, sekarang: number): number {
  if (terakhir === null || tidakSah(terakhir) || tidakSah(sekarang)) return JEDA_TIDAK_DIKETAHUI;
  const detik = Math.floor((sekarang - terakhir) / 1000);
  return detik < 0 ? 0 : detik;
}

/** Sinyal paste, atau `null` bila belum di ambang. */
export function sinyalPaste(panjang: number, sejakMengetikDetik: number): SinyalPaste | null {
  if (tidakSah(panjang) || panjang < AMBANG_PASTE_MINIMAL) return null;
  return {
    jenis: "paste_massal",
    panjang,
    sejak_mengetik_detik: sejakMengetikDetik < 0 ? 0 : sejakMengetikDetik,
  };
}

/** Sinyal salin/cut, atau `null` bila belum di ambang. */
export function sinyalSalin(panjang: number): SinyalSalin | null {
  if (tidakSah(panjang) || panjang < AMBANG_PASTE_MINIMAL) return null;
  return { jenis: "salin_terlarang", panjang };
}

export interface BaganPintasan {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

/**
 * Sinyal pintasan terlarang, atau `null`.
 *
 * Kombinasi yang sampai ke sini di-*normalkan* ke nama kanonik kecil
 * (`Ctrl` dan `V` → `"v"`), jadi satu kombinasi tidak bisa tercatat dua kali
 * hanya karena kapitalitasnya berbeda.
 */
export function sinyalPintasan(e: BaganPintasan): SinyalPintasan | null {
  if (!e.ctrl && !e.meta && !e.alt) return null;
  const tombol = NAMA_TOMBOL[String(e.key ?? "").toLowerCase()];
  if (!tombol || !PINTAKAN_TERLARANG.includes(tombol)) return null;
  const pengenal = e.ctrl ? "ctrl" : e.meta ? "meta" : "alt";
  return { jenis: "pintasan_terlarang", kombinasi: `${pengenal}+${tombol}` };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/learning/pengawasan-klien.test.ts`
Expected: PASS — 15 test hijau

- [x] **Step 5: Verify the test actually covers the logic (mutation check)**

Buat salinan, lalu hapus `sejakDetikTerakhirMengetik` dari `sinyalPaste` (ubah baris `sejak_mengetik_detik: sejakMengetikDetik < 0 ? 0 : sejakMengetikDetik` menjadi `sejak_mengetik_detik: 0`):

```bash
cp src/lib/learning/pengawasan-klien.ts /tmp/pengawasan-fixed.ts
# ganti baris di file dengan Assignment yang benar-benar salah
# (lihat langkah di bawah)
npx vitest run src/lib/learning/pengawasan-klien.test.ts
# harus FAIL pada test "mencatat paste yang panjangnya di atas ambang"
# (test "tidak pernah melaporkan jeda negatif" tetap hijau karena mutasinya
#  menghasilkan 0, persis yang diharapkan test itu)
cp /tmp/pengawasan-fixed.ts src/lib/learning/pengawasan-klien.ts
npx vitest run src/lib/learning/pengawasan-klien.test.ts
# harus PASS lagi
```

Lalu lakukan mutasi kedua: hapus baris `if (!e.ctrl && !e.meta && !e.alt) return null;` dari `sinyalPintasan` dan konfirmasi test "mengabaikan ketikan biasa tanpa modifier" jadi merah. **Kalau sebuah mutasi tidak membuat test merah, test itu tidak menutup logika itu.**

- [x] **Step 6: Commit**

```bash
git add src/lib/learning/pengawasan-klien.ts src/lib/learning/pengawasan-klien.test.ts
git commit -m "feat(learning): klasifikasi sinyal browser anti-curang sebagai fungsi murni"
```

---

## Task 2: Jenis kejadian baru + sumber sinyal

Perluas daftar jenis yang sah dan tambahkan peta asal-usul sinyal (P3 spec: setiap sumber wajib menampilkan asalnya).

**Files:**
- Modify: `src/lib/learning/akses.ts:136-161`
- Modify: `src/lib/learning/akses.test.ts`
- Create: `src/lib/learning/sumber-sinyal.ts`
- Create: `src/lib/learning/sumber-sinyal.test.ts`

**Interfaces:**
- Consumes: `KJenisKejadian` (dari `akses.ts`, sudah ada).
- Produces:
  - `KJenisKejadian` sekarang **juga** berisi: `"keluar_fullscreen"`, `"paste_massal"`, `"pintasan_terlarang"`, `"salin_terlarang"`, `"wajah_tidak_terdeteksi"`, `"wajah_kedua"`, `"seb_aktif"`.
  - `klasifikasiKejadian` mengenali jenis baru.
  - Dari `sumber-sinyal.ts`: `type AsalSinyal = "browser" | "kamera" | "luar" | "server"`, `ASAL_SINYAL: Record<KJenisKejadian, AsalSinyal>`, `BATAS_SINYAL: Record<AsalSinyal, string>`, `function asalSinyal(jenis: KJenisKejadian): AsalSinyal`.

- [x] **Step 1: Write the failing tests**

Tambahkan ke `src/lib/learning/akses.test.ts` (di dalam file yang sudah ada, setelah `describe("klasifikasiKejadian")` yang berakhir di baris 120):

```ts
describe("klasifikasiKejadian untuk sinyal browser", () => {
  it("mencatat paste dan pintasan sebagai kejadian, bukan celah", () => {
    // Sinyal yang dipicu peserta sendiri masih "kejadian": ia teramati, hanya
    // tidak selalu berarti curang. Celah dipakai saat pengawasan BERHENTI.
    expect(klasifikasiKejadian("paste_massal", null)).toBe("kejadian");
    expect(klasifikasiKejadian("pintasan_terlarang", null)).toBe("kejadian");
    expect(klasifikasiKejadian("salin_terlarang", null)).toBe("kejadian");
    expect(klasifikasiKejadian("keluar_fullscreen", null)).toBe("kejadian");
  });

  it("mencatat wajah yang hilang sebagai celah pengawasan", () => {
    // Wajah hilang berarti catatan yang kita punya tidak lengkap pada saat itu —
    // itu definisi "celah", bukan bukti perbuatan salah apa pun.
    expect(klasifikasiKejadian("wajah_tidak_terdeteksi", "hidden")).toBe("celah");
  });

  it("mencatat wajah kedua sebagai kejadian", () => {
    expect(klasifikasiKejadian("wajah_kedua", "visible")).toBe("kejadian");
  });
});
```

Buat `src/lib/learning/sumber-sinyal.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { JENIS_KEJADIAN_SAH } from "./akses";
import { ASAL_SINYAL, BATAS_SINYAL, asalSinyal, type AsalSinyal } from "./sumber-sinyal";

describe("asalSinyal", () => {
  it("memetakan tiap jenis yang sah ke tepat satu asal", () => {
    // Tidak ada jenis yang boleh lolos tanpa asal: tanpa asal, laporan
    // menampilkan "3 sinyal" tanpa menyebut dari mana, dan pembaca akan
    // menganggap semuanya sekuat.
    for (const jenis of JENIS_KEJADIAN_SAH) {
      expect(Object.hasOwn(ASAL_SINYAL, jenis)).toBe(true);
    }
  });

  it("menggolongkan sinyal self-report browser sebagai browser", () => {
    expect(asalSinyal("pindah_tab")).toBe("browser");
    expect(asalSinyal("paste_massal")).toBe("browser");
    expect(asalSinyal("pintasan_terlarang")).toBe("browser");
    expect(asalSinyal("keluar_fullscreen")).toBe("browser");
  });

  it("menggolongkan sinyal turunan model sebagai kamera", () => {
    expect(asalSinyal("wajah_tidak_terdeteksi")).toBe("kamera");
    expect(asalSinyal("wajah_kedua")).toBe("kamera");
  });

  it("menggolongkan sinyal dari luar aplikasi sebagai luar", () => {
    expect(asalSinyal("seb_aktif")).toBe("luar");
  });

  it("menggolongkan sinyal yang dihitung server sebagai server", () => {
    expect(asalSinyal("sesi_dimulai")).toBe("server");
    expect(asalSinyal("sesi_diakhiri")).toBe("server");
  });

  it("memakai asal server untuk jenis yang tidak dikenal, bukan melompat", () => {
    // Jenis asing diabaikan saat baca laporan; kalau sampai ke sini, "server"
    // adalah pilihan paling tidak menuduh, dan `BATAS_SINYAL` selalu punya
    // teks untuk asal mana pun.
    expect(asalSinyal("jenis_masa_depan" as never)).toBe("server");
  });
});

describe("BATAS_SINYAL", () => {
  it("memiliki teks untuk setiap asal", () => {
    const asal: AsalSinyal[] = ["browser", "kamera", "luar", "server"];
    for (const a of asal) {
      expect(BATAS_SINYAL[a].length).toBeGreaterThan(20);
    }
  });

  it("menyatakan bahwa sinyal browser bisa dihentikan peserta", () => {
    // Ini batas yang paling sering hilang saat disunting, dan yang paling
    // penting: tanpa itu, "sesi bersih" dibaca sebagai bukti tidak curang.
    expect(BATAS_SINYAL.browser).toContain("dihentikan");
  });

  it("menyatakan bahwa deteksi kamera bisa salah dan tidak mengidentifikasi orang", () => {
    expect(BATAS_SINYAL.kamera).toContain("bisa salah");
    expect(BATAS_SINYAL.kamera).toContain("tidak mengidentifikasi");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/learning/akses.test.ts src/lib/learning/sumber-sinyal.test.ts`
Expected: FAIL — `sumber-sinyal` tidak ditemukan; `klasifikasiKejadian` tidak mengenali `"paste_massal"`

- [x] **Step 3: Extend `JENIS_KEJADIAN_SAH` and `klasifikasiKejadian`**

Di `src/lib/learning/akses.ts`, ganti array `JENIS_KEJADIAN_SAH` (baris 136-144) menjadi:

```ts
export const JENIS_KEJADIAN_SAH = [
  "pindah_tab",
  "fokus_hilang",
  "kamera_mulai",
  "kamera_berhenti",
  "kamera_gagal",
  "sesi_dimulai",
  "sesi_diakhiri",
  // Lapisan 1 — browser (self-report, tanpa izin media).
  "keluar_fullscreen",
  "paste_massal",
  "pintasan_terlarang",
  "salin_terlarang",
  // Lapisan 2 — kamera (diturunkan model, butuh persetujuan).
  "wajah_tidak_terdeteksi",
  "wajah_kedua",
  // Lapisan 3 — sinyal dari lockdown browser di luar aplikasi.
  "seb_aktif",
] as const;
```

Lalu ganti `klasifikasiKejadian` (baris 157-161) menjadi:

```ts
export function klasifikasiKejadian(jenis: KJenisKejadian, visibilitas: "visible" | "hidden" | null): JenisKejadian {
  if (jenis === "kamera_berhenti" || jenis === "kamera_gagal") return "celah";
  // Wajah yang tidak terdeteksi berarti catatan kita tidak lengkap pada saat
  // itu — itu definisi "celah", bukan bukti apa pun tentang peserta.
  if (jenis === "wajah_tidak_terdeteksi") return "celah";
  if (jenis === "pindah_tab") return visibilitas === "hidden" ? "kejadian" : "celah";
  return "kejadian";
}
```

- [x] **Step 4: Create the signal-source module**

Buat `src/lib/learning/sumber-sinyal.ts`:

```ts
import type { KJenisKejadian } from "./akses";

/**
 * Asal-usul tiap sinyal integritas — **murni**.
 *
 * Prinsip P3 di spec 2026-09-27: "keluar tab 3×" (dilaporkan peramban) dan
 * "wajah kedua terdeteksi" (diturunkan model ML) **bukan klaim yang setara**.
 * Menampilkan keduanya sebagai angka yang sama tanpa asal-usulnya membuat
 * pembaca menimbang keduanya sama, dan itu tidak benar.
 *
 * Modul ini tidak boleh mengimpor `node:fs` atau apa pun server-only: label ini
 * dirender di komponen klien (`kamera-izin.tsx`) maupun di halaman laporan staf.
 */

/** Keempat sumber sinyal, dengan tingkat keyakinan yang berbeda. */
export type AsalSinyal = "browser" | "kamera" | "luar" | "server";

export const ASAL_SINYAL: Record<KJenisKejadian, AsalSinyal> = {
  pindah_tab: "browser",
  fokus_hilang: "browser",
  keluar_fullscreen: "browser",
  paste_massal: "browser",
  pintasan_terlarang: "browser",
  salin_terlarang: "browser",
  kamera_mulai: "kamera",
  kamera_berhenti: "kamera",
  kamera_gagal: "kamera",
  wajah_tidak_terdeteksi: "kamera",
  wajah_kedua: "kamera",
  seb_aktif: "luar",
  sesi_dimulai: "server",
  sesi_diakhiri: "server",
};

/**
 * Batas yang wajib ditulis per asal. Satu kalimat pendek, seperti
 * `PERINGATAN_INTEGRITAS`: laporan ini dibaca orang yang sedang menilai, dan
 * kalimat panjang di sana hanya menunda keputusan.
 */
export const BATAS_SINYAL: Record<AsalSinyal, string> = {
  browser:
    "Dilaporkan peramban peserta, jadi bisa dihentikan sepihak dan tidak melihat tab lain.",
  kamera:
    "Dihitung model di perangkat peserta: bisa salah, dan tidak mengidentifikasi siapa pun.",
  luar:
    "Hanya terlihat kalau pengujian benar-benar berjalan di lockdown browser; tanpa itu, tidak ada yang dicek.",
  server:
    "Dihitung server dari yang tercatat; tidak melihat apa pun di luar halaman ini.",
};

/**
 * Asal satu jenis kejadian. `Object.hasOwn` (bukan `in`) supaya nilai tak
 * dikenal tidak mengambil prototipe — lihat `careevo-review` §1.
 */
export function asalSinyal(jenis: KJenisKejadian): AsalSinyal {
  return Object.hasOwn(ASAL_SINYAL, jenis) ? ASAL_SINYAL[jenis] : "server";
}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/learning/akses.test.ts src/lib/learning/sumber-sinyal.test.ts src/lib/learning/pengawasan-klien.test.ts`
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add src/lib/learning/akses.ts src/lib/learning/akses.test.ts src/lib/learning/sumber-sinyal.ts src/lib/learning/sumber-sinyal.test.ts
git commit -m "feat(learning): jenis kejadian anti-curang baru + peta asal-usul sinyal"
```

---

## Task 3: Pasang listener browser di sesi aktif

Sambungkan fungsi murni Task 1 ke `CourseSessionProvider` dan teruskan detail terstruktur ke server.

**Files:**
- Modify: `src/lib/learning/run-service.ts:177-199` (`catatKejadianDb`)
- Modify: `src/actions/learning.ts:154-200` (`catatKejadianAction`)
- Modify: `src/components/features/learning/course-session.tsx:232-249`

**Interfaces:**
- Consumes: `SinyalBrowser`, `sinyalPaste`, `sinyalPintasan`, `sinyalSalin`, `sejakDetikTerakhirMengetik` dari Task 1.
- Produces:
  - `catatKejadianDb(input: { principal; runId; jenis; visibilitas; detail?; asal? })` — `asal?: string` baru, masuk ke payload.
  - `catatKejadianAction(input: { runId; jenis; visibilitas; detail?; asal? })` — `asal?: string` baru.
  - `SinyalBrowser` dianotasi ke `detail` sebagai teks ringkas: `` `${panjang} karakter, jeda ${sejak_mengetik_detik}s` ``.

- [x] **Step 1: Write the failing test**

Tambahkan ke `src/lib/learning/sumber-sinyal.test.ts` — atau, lebih tepat, buat `src/lib/learning/run-service.test.ts` baru. Tulis ini di `src/lib/learning/run-service.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ambilRun: vi.fn(),
  catatKejadianRun: vi.fn(),
}));

vi.mock("./repository", () => ({
  ambilRun: mocks.ambilRun,
  catatKejadianRun: mocks.catatKejadianRun,
  akhiriRun: vi.fn(),
  ambilEnrollmentById: vi.fn(),
  ambilRunAktif: vi.fn(),
  buatRun: vi.fn(),
  listRun: vi.fn(),
}));

vi.mock("./session", () => ({
  BATAS_SESI_BAWAAN_MENIT: 30,
  buktiBaru: vi.fn(() => "bukti"),
  verifikasiBuktiSesi: vi.fn(),
}));

import { catatKejadianDb } from "./run-service";

const PRINCIPAL = { userId: "u1", email: "a@x.test", nama: "A" } as never;

describe("catatKejadianDb dengan sinyal browser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ambilRun.mockResolvedValue({ id: "r1", userId: "u1", state: "active" });
    mocks.catatKejadianRun.mockReturnValue({ id: "e1" });
  });

  it("membawa asal sinyal ke dalam payload", () => {
    return catatKejadianDb({
      principal: PRINCIPAL,
      runId: "r1",
      jenis: "paste_massal",
      visibilitas: "visible",
      detail: "400 karakter, jeda 30s",
      asal: "browser",
    }).then(() => {
      const p = mocks.catatKejadianRun.mock.calls[0][0].payloadRedacted;
      expect(p.asal).toBe("browser");
    });
  });

  it("memakai asal yang dihitung server bila klien tidak mengirim", () => {
    // `asal` dari klien tidak dipercaya penuh: ia hanya boleh membatasi nilai
    // ke empat asal yang sah, dan `server` adalah nilai gagal-tertutup yang
    // tidak menuduh.
    return catatKejadianDb({
      principal: PRINCIPAL,
      runId: "r1",
      jenis: "pindah_tab",
      visibilitas: "hidden",
    }).then(() => {
      const p = mocks.catatKejadianRun.mock.calls[0][0].payloadRedacted;
      expect(p.asal).toBe("server");
    });
  });

  it("menolak asal yang tidak dikenal dan memaksa ke server", () => {
    return catatKejadianDb({
      principal: PRINCIPAL,
      runId: "r1",
      jenis: "pindah_tab",
      visibilitas: "hidden",
      asal: "injeksi" as never,
    }).then(() => {
      const p = mocks.catatKejadianRun.mock.calls[0][0].payloadRedacted;
      expect(p.asal).toBe("server");
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/learning/run-service.test.ts`
Expected: FAIL — `p.asal` adalah `undefined`

- [x] **Step 3: Extend `catatKejadianDb`**

Di `src/lib/learning/run-service.ts`, tambahkan import di blok import yang sudah ada:

```ts
import type { AsalSinyal } from "./sumber-sinyal";
```

Lalu ganti signature `catatKejadianDb` (baris 177-199) menjadi:

```ts
export async function catatKejadianDb(input: {
  principal: SessionPrincipal;
  runId: string;
  jenis: KJenisKejadian;
  visibilitas: "visible" | "hidden" | null;
  detail?: string;
  /**
   * Asal sinyal yang diklaim klien. **Tidak dipercaya penuh**: nilai di luar
   * empat asal yang sah turun ke `"server"`, yang tidak menuduh dan selalu ada
   * untuk setiap jenis kejadian.
   */
  asal?: string;
}): Promise<LearningEvent | null> {
  if (!(JENIS_KEJADIAN_SAH as readonly string[]).includes(input.jenis)) return null;

  const run = await ambilRun(input.runId);
  if (!run) return null;
  if (run.userId !== input.principal.userId) return null;

  return catatKejadianRun({
    runId: input.runId,
    kind: input.jenis,
    payloadRedacted: {
      jenis_klasifikasi: klasifikasiKejadian(input.jenis, input.visibilitas),
      visibilitas: input.visibilitas,
      asal: asalValid(input.asal),
      ...(input.detail ? { detail: input.detail.slice(0, 300) } : {}),
    },
  });
}
```

Tambahkan helper ini tepat di atas `catatKejadianDb`:

```ts
/** Empat asal yang sah; nilai lain apa pun turun ke `"server"`. */
const ASAL_SAH: ReadonlySet<string> = new Set(["browser", "kamera", "luar", "server"]);

function asalValid(nilai: string | undefined): AsalSinyal {
  return nilai && ASAL_SAH.has(nilai) ? (nilai as AsalSinyal) : "server";
}
```

- [x] **Step 4: Pass `asal` through the action**

Di `src/actions/learning.ts`, ganti signature `catatKejadianAction` (baris 154-160) menjadi:

```ts
export async function catatKejadianAction(input: {
  runId: string;
  jenis: KJenisKejadian;
  visibilitas: "visible" | "hidden" | null;
  detail?: string;
  asal?: string;
}): Promise<SesiActionState> {
```

Dan teruskan `asal` pada pemanggilan `catatKejadianDb` (baris 181-189) — tambahkan satu baris setelah `visibilitas: input.visibilitas,`:

```ts
      asal: input.asal,
```

- [x] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/learning/run-service.test.ts`
Expected: PASS — 3 test hijau

- [x] **Step 6: Wire the client listeners**

Di `src/components/features/learning/course-session.tsx`, tambahkan import di blok import yang sudah ada:

```ts
import {
  sejakDetikTerakhirMengetik,
  sinyalPaste,
  sinyalPintasan,
  sinyalSalin,
} from "@/lib/learning/pengawasan-klien";
```

Tambahkan `ketikRef` sebagai ref di dalam `CourseSessionProvider`, tepat setelah `const runRef = useRef<string | null>(null);`:

```ts
  /**
   * Waktu ketikan terakhir di halaman ini.
   *
   * Dipakai untuk menghitung jeda saat paste. Tanpa ini, "menempel 400 karakter"
   * dan "mengetik 400 karakter lalu menyisipkan beberapa kata" terlihat sama —
   * padahal hanya yang pertama yang biasanya bukan pekerjaan peserta.
   */
  const ketikRef = useRef<number | null>(null);
```

Lalu tambahkan effect kedua, tepat setelah effect `visibilitychange` yang berakhir di baris 249:

```ts
  useEffect(() => {
    if (status !== "aktif") return;

    // Tandai ketikan terakhir **hanya** untuk tombol karakter (bukan modifier).
    // `keydown` ctrl+v datang sebagai dua kejadian — `Control` lalu `v` — dan
    // menandai keduanya sebagai "ketikan" akan membuat paste yang mengikuti
    // pintasan itu dilaporkan berjeda 0 detik, padahal bukan itu yang terjadi.
    const padaKetik = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;
      ketikRef.current = Date.now();
    };
    // Keluar dari layar penuh = peserta melihat sesuatu yang bukan halaman ini.
    const padaFullscreen = () => {
      if (!document.fullscreenElement) {
        kirimSinyal({ jenis: "keluar_fullscreen", jumlah_keluar: 1 });
      }
    };
    const padaPaste = (e: ClipboardEvent) => {
      const teks = e.clipboardData?.getData("text") ?? "";
      const sinyal = sinyalPaste(
        teks.length,
        sejakDetikTerakhirMengetik(ketikRef.current, Date.now()),
      );
      if (sinyal) kirimSinyal(sinyal);
    };
    const padaSalin = (e: ClipboardEvent) => {
      const teks = e.clipboardData?.getData("text") ?? "";
      const sinyal = sinyalSalin(teks.length);
      if (sinyal) kirimSinyal(sinyal);
    };
    const padaPintasan = (e: KeyboardEvent) => {
      const sinyal = sinyalPintasan({
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
        key: e.key,
      });
      if (sinyal) kirimSinyal(sinyal);
    };

    document.addEventListener("keydown", padaKetik);
    document.addEventListener("fullscreenchange", padaFullscreen);
    document.addEventListener("paste", padaPaste);
    document.addEventListener("copy", padaSalin);
    document.addEventListener("cut", padaSalin);
    document.addEventListener("keydown", padaPintasan);
    return () => {
      document.removeEventListener("keydown", padaKetik);
      document.removeEventListener("fullscreenchange", padaFullscreen);
      document.removeEventListener("paste", padaPaste);
      document.removeEventListener("copy", padaSalin);
      document.removeEventListener("cut", padaSalin);
      document.removeEventListener("keydown", padaPintasan);
    };
  }, [status, kirimSinyal]);
```

Tambahkan `kirimSinyal` tepat setelah `kirimKejadian` (yang berakhir di baris 172), di dalam komponen:

```ts
  /**
   * Kirim satu sinyal browser ke server.
   *
   * Fire-and-forget seperti `kirimKejadian` — pencatatan tidak boleh memblokir
   * UI. `asal` selalu `"browser"` karena semua sinyal di sini datang dari
   * listener peramban, dan `detail` diringkas supaya tidak melewati batas 300
   * karakter di service.
   */
  const kirimSinyal = useCallback(
    (sinyal: SinyalBrowser) => {
      const id = runRef.current;
      if (!id) return;
      void catatKejadianAction({
        runId: id,
        jenis: sinyal.jenis,
        visibilitas: "visible",
        asal: "browser",
        detail: ringkasSinyal(sinyal),
      })
        .then((hasil) => {
          if (hasil.ok && hasil.run) setKejadian(kejadianDariRun(hasil.run));
        })
        .catch(() => undefined);
    },
    [],
  );
```

Tambahkan import tipe `SinyalBrowser` di blok import yang sudah ada:

```ts
import type { SinyalBrowser } from "@/lib/learning/pengawasan-klien";
```

Dan tambahkan fungsi peringkas modul di luar komponen, tepat setelah fungsi `ringkas`:

```ts
/**
 * Ringkas satu sinyal browser menjadi detail yang muat di `detail`.
 *
 * Service memotong `detail` 300 karakter, jadi angka panjang harus diringkas
 * di sini — bukan berharap server menampungnya. Nilai diagnostik yang disimpan:
 * panjang paste dan jeda mengetik, yang dua-duanya dipakai untuk melihat pola.
 */
export function ringkasSinyal(sinyal: SinyalBrowser): string {
  switch (sinyal.jenis) {
    case "keluar_fullscreen":
      return "Keluar layar penuh";
    case "paste_massal":
      return `${sinyal.panjang} karakter, jeda ${sinyal.sejak_mengetik_detik}s`;
    case "pintasan_terlarang":
      return `Pintasan ${sinyal.kombinasi}`;
    case "salin_terlarang":
      return `${sinyal.panjang} karakter`;
  }
}
```

- [x] **Step 7: Run the full gate**

Run: `npm run check`
Expected: exit 0

Run: `npm run build`
Expected: build sukses — ini yang menangkap impor server-only yang bocor ke bundel klien.

- [x] **Step 7b: Perbarui copy panel kejadian (jangan berbohong tentang apa yang dicatat)**

`src/components/features/learning/kejadian-panel.tsx` baris 108–117 masih menyebut
"Yang dicatat saat ini: pindah tab dan fokus yang hilang." Setelah listener Tier 1
terpasang, kalimat itu sudah tidak benar — sesi juga mencatat keluar layar penuh,
paste/salin panjang, dan pintasan terlarang. Ganti paragraf itu menjadi:

```tsx
      <p className="mt-3 text-sm leading-relaxed text-gray-700">
        Pindah tab, keluar layar penuh, menempel/menyalin teks panjang, dan pintasan tertentu
        dicatat untuk konteks. Kejadian ini tidak otomatis menggagalkan penilaian dan tidak
        mengurangi reputasimu.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-gray-600">
        Yang dicatat saat ini: pindah tab, fokus yang hilang, keluar layar penuh, dan pola
        menempel/menyalin teks panjang. Careevo <strong>belum</strong> mengakses kameramu — tidak
        ada aliran gambar yang dibuka, tidak ada wajah yang direkam, dan tidak ada yang dianalisis.
        Laporan kamera di bawah hanya mencatat apa yang kamu alami sendiri, supaya pengajar tahu
        konteksnya.
      </p>
```

(Paragraf kamera di sini ikut berubah lagi di Task 6 saat kamera benar-benar jalan;
untuk Task 3 cukup menyebut sinyal browser yang baru.)

- [~] **Step 8: Verify in a real browser (wajib — `careevo-browser-verify`)**

```bash
npm run dev
```

Masuk sebagai peserta, buka `/belajar/r1`, tekan "Mulai sesi terverifikasi", lalu jalankan probe ini di browser:

```js
// Provoke setiap sinyal sekali, lalu baca apa yang server terima.
const run = async () => {
  // 1. paste massal
  document.querySelector('[contenteditable]')?.focus();
  const dt = new DataTransfer();
  dt.setData('text/plain', 'x'.repeat(400));
  document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  // 2. pintasan terlarang
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }));
  // 3. keluar fullscreen (kalau tidak sedang fullscreen, ini tidak memicu apa pun)
  await new Promise((r) => setTimeout(r, 800));
  return 'terkirim';
};
run();
```

Lalu verifikasi **di server** (bukan di layar) bahwa kejadian sampai:

```bash
# ganti user id dengan milikmu sendiri
psql "$DATABASE_URL" -c \
  "select kind, payload_redacted from learning_events order by occurred_at desc limit 5;"
```

Yang harus terbukti: `kind` berisi `paste_massal` / `pintasan_terlarang`, dan `payload_redacted.asal` bernilai `"browser"`. Kalau `kind` masih `pindah_tab` saja, listener tidak terpasang — cek konsol browser untuk error hydration.

- [x] **Step 9: Commit**

```bash
git add src/components/features/learning/course-session.tsx src/actions/learning.ts src/lib/learning/run-service.ts src/lib/learning/run-service.test.ts
git commit -m "feat(learning): catat sinyal browser (fullscreen, paste, pintasan, salin) di sesi aktif"
```

---

# BAGIAN B — Lapisan 2: kamera (opsional)

Task 4–6. Semua **butuh persetujuan** dan tidak pernah aktif secara default (P5 spec). Copynya hanya boleh diganti setelah kameranya benar-benar jalan.

---

## Task 4: Aturan `wajib_kamera` di mesin akses

Tambahkan nilai ketiga `AturanPengawasan` dan gerbangnya. **Nilai `completion_path` tidak berubah** — lihat spec §"Kamera tidak menambah nilai `completion_path`".

**Files:**
- Modify: `src/types/course.ts:313`
- Modify: `src/lib/courses/kebijakan.ts:17-27`
- Modify: `src/lib/learning/akses.ts:14-24, 102-118`
- Modify: `src/lib/learning/akses.test.ts`

**Interfaces:**
- Consumes: tidak ada.
- Produces:
  - `AturanPengawasan = "wajib" | "opsional" | "wajib_kamera"`
  - `KonteksAkses` + `adaBuktiKamera?: boolean`
  - `KeputusanAkses` + varian `{ tipe: "perlu_kamera"; pesan: string }`
  - `function butuhKamera(kebijakan: KebijakanCourse): boolean`
  - `PESAN_POLICY.wajib_kamera`

- [ ] **Step 1: Write the failing tests**

Tambahkan ke `src/lib/learning/akses.test.ts`:

```ts
describe("aturan wajib_kamera", () => {
  const kams = { ...kebijakanDefault(), aturan_pengawasan: "wajib_kamera" as const };

  it("menahan kamera yang tidak menyala pada course wajib_kamera", () => {
    const keputusan = putuskanAkses({
      jenisKegiatan: "materi",
      kebijakan: kams,
      adaBuktiSesi: true,
      adaBuktiKamera: false,
    });
    expect(keputusan.tipe).toBe("perlu_kamera");
  });

  it("melepas gerbang setelah sesi dan kamera keduanya ada", () => {
    const keputusan = putuskanAkses({
      jenisKegiatan: "materi",
      kebijakan: kams,
      adaBuktiSesi: true,
      adaBuktiKamera: true,
    });
    expect(keputusan.tipe).toBe("bebas");
  });

  it("tetap menolak bantuan AI di course wajib_kamera", () => {
    // `wajib_kamera` menambah syarat kamera; ia tidak pernah melonggarkan aturan AI.
    const keputusan = putuskanAkses({
      jenisKegiatan: "bantuan_akademik",
      kebijakan: { ...kebijakanDefault(), aturan_bantuan: "tanpa_ai", aturan_pengawasan: "wajib_kamera" },
      adaBuktiSesi: true,
      adaBuktiKamera: true,
    });
    expect(keputusan.tipe).toBe("ditolak");
  });

  it("tidak menuntut kamera pada course wajib yang biasa", () => {
    // Ini yang menjaga `wajib` tetap berarti "wajib" dan bukan "wajib kamera":
    // peserta yang menolak kamera tidak kehilangan akses belajar.
    const keputusan = putuskanAkses({
      jenisKegiatan: "materi",
      kebijakan: { ...kebijakanDefault(), aturan_pengawasan: "wajib" },
      adaBuktiSesi: true,
      adaBuktiKamera: false,
    });
    expect(keputusan.tipe).toBe("bebas");
  });

  it("butuhKamera hanya benar untuk wajib_kamera", () => {
    expect(butuhKamera(kams)).toBe(true);
    expect(butuhKamera({ ...kebijakanDefault(), aturan_pengawasan: "wajib" })).toBe(false);
    expect(butuhKamera({ ...kebijakanDefault(), aturan_pengawasan: "opsional" })).toBe(false);
  });
});
```

Tambahkan import di kepala `src/lib/learning/akses.test.ts`:

```ts
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import { butuhKamera } from "./akses";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/learning/akses.test.ts`
Expected: FAIL — `butuhKamera` is not exported / `perlu_kamera` tidak dikenal

- [ ] **Step 3: Add the type**

Di `src/types/course.ts`, ganti baris 313:

```ts
export type AturanPengawasan = "wajib" | "opsional" | "wajib_kamera";
```

Dan perbarui komentar di atasnya (baris 305-312) menjadi:

```ts
/**
 * Aturan pengawasan: apakah hasil hanya sah bila dikerjakan di sesi
 * terverifikasi.
 *
 * `wajib`/`opsional`/`wajib_kamera` (bukan daftar kontrol kamera) supaya
 * kebijakan yang tersimpan stabil saat detail teknis sesi berubah — detail
 * kamera hidup di mesin akses, bukan di data course.
 *
 * `wajib_kamera` nilai ketiga yang menambah satu syarat saja: kamera harus
 * menyala. Ia **tidak** menambah nilai `completion_path` — jalur kamera
 * diturunkan dari kejadian run, bukan disimpan (lihat spec
 * 2026-09-27-lapisan-pengawasan-anti-curang-design.md).
 */
```

- [ ] **Step 4: Extend the access decision machine**

Di `src/lib/learning/akses.ts`, ganti `KonteksAkses` (baris 14-20):

```ts
export interface KonteksAkses {
  jenisKegiatan: JenisKegiatan;
  kebijakan: KebijakanCourse;
  /** True bila ada bukti sesi yang valid & cocok dengan kebijakan saat ini. */
  adaBuktiSesi: boolean;
  /**
   * True bila kamera menyala dalam sesi yang sedang berjalan.
   *
   * **Hanya relevan untuk `wajib_kamera`.** Field ini opsional supaya
   * pemanggil lama (course `wajib`/`opsional`) tidak perlu menyentuhnya, dan
   * `opsional` di bawah mengabaikannya sepenuhnya.
   */
  adaBuktiKamera?: boolean;
}
```

Ganti `KeputusanAkses` (baris 21-24):

```ts
export type KeputusanAkses =
  | { tipe: "bebas" }
  | { tipe: "perlu_sesi"; pesan: string }
  | { tipe: "perlu_kamera"; pesan: string }
  | { tipe: "ditolak"; pesan: string };
```

Tambahkan helper setelah `wajibSesiTerverifikasi` (yang berakhir di baris 72):

```ts
/**
 * Apakah kebijakan course ini menuntut kamera menyala.
 *
 * Satu tempat, supaya baik mesin akses maupun UI memakai definisi yang sama.
 * Hanya `wajib_kamera` yang true — lihat catatan P5 di spec 2026-09-27.
 */
export function butuhKamera(kebijakan: KebijakanCourse): boolean {
  return kebijakan.aturan_pengawasan === "wajib_kamera";
}
```

Ganti `putuskanAkses` (baris 102-118):

```ts
export function putuskanAkses({ jenisKegiatan, kebijakan, adaBuktiSesi, adaBuktiKamera }: KonteksAkses): KeputusanAkses {
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
  // Kamera baru diminta **setelah** sesi: tanpa sesi, tidak ada run tempat
  // kejadian kamera dicatat, jadi menagih kamera lebih dulu hanya menambah
  // satu langkah yang pasti gagal.
  if (butuhKamera(kebijakan) && !adaBuktiKamera) {
    return { tipe: "perlu_kamera", pesan: PESAN_POLICY.wajib_kamera };
  }
  return { tipe: "bebas" };
}
```

- [ ] **Step 5: Add the label and message**

Di `src/lib/courses/kebijakan.ts`, ganti `LABEL_ATURAN_PENGAWASAN` (baris 17-20):

```ts
export const LABEL_ATURAN_PENGAWASAN: Record<AturanPengawasan, string> = {
  wajib: "Wajib sesi terverifikasi (kamera opsional)",
  wajib_kamera: "Wajib sesi terverifikasi dengan kamera",
  opsional: "Sesi terverifikasi opsional",
};
```

Dan tambahkan entri baru ke `PESAN_POLICY` (setelah entri `wajib` di baris 23-25):

```ts
  wajib_kamera:
    "Course ini menuntut sesi terverifikasi dengan kamera menyala. Kamera dipakai untuk menghitung apakah wajahmu ada di depan layar — bukan merekam atau mengenali wajahmu, dan videonya tidak pernah meninggalkan perangkatmu.",
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/lib/learning/akses.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/types/course.ts src/lib/courses/kebijakan.ts src/lib/learning/akses.ts src/lib/learning/akses.test.ts
git commit -m "feat(learning): aturan pengawasan wajib_kamera + gerbang perlu_kamera"
```

---

## Task 5: Deteksi wajah client-side (MediaPipe)

Pembungkus murni-untuk-logika + tipis untuk DOM. Model berjalan di perangkat; yang dikirim hanya angka.

**Files:**
- Create: `src/lib/learning/kamera-klien.ts`
- Create: `src/lib/learning/kamera-klien.test.ts`

**Interfaces:**
- Consumes: `KJenisKejadian` (untuk tipe sinyal).
- Produces:
  - `const AMBANG_WAJAH_HILANG_DETIK = 10`
  - `type StatusWajah = "tidak_ada" | "satu" | "lebih_dari_satu"`
  - `function statusWajah(jumlahWajah: number): StatusWajah`
  - `function perluCatatWajahHilang(status: StatusWajah, tanpaWajahSejak: number | null, sekarang: number): { durasi_detik: number } | null`
  - `class PemantauWajah` dengan constructor `(padaHasil: (h: { status: StatusWajah; sejakMs: number }) => void)`, `mulai(video: HTMLVideoElement): Promise<boolean>`, `berhenti(): void`
  - `const praMuatModelWajah: () => Promise<unknown | null>`

- [ ] **Step 1: Write the failing test**

Buat `src/lib/learning/kamera-klien.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AMBANG_WAJAH_HILANG_DETIK,
  perluCatatWajahHilang,
  statusWajah,
} from "./kamera-klien";

describe("statusWajah", () => {
  it("membedakan tidak ada, satu, dan lebih dari satu", () => {
    expect(statusWajah(0)).toBe("tidak_ada");
    expect(statusWajah(1)).toBe("satu");
    expect(statusWajah(3)).toBe("lebih_dari_satu");
  });

  it("menganggap jumlah negatif tidak ada", () => {
    // Modeloccasionally mengembalikan nilai di luar rentang; perlakukan sebagai
    // "tidak ada" agar tidak menciptakan `wajah_kedua` dari angka negatif.
    expect(statusWajah(-1)).toBe("tidak_ada");
  });
});

describe("perluCatatWajahHilang", () => {
  const mulai = 1_000_000;

  it("tidak mencatat sebelum ambang 10 detik", () => {
    const sejakMs = mulai + (AMBANG_WAJAH_HILANG_DETIK - 1) * 1000;
    expect(perluCatatWajahHilang("tidak_ada", sejakMs, mulai)).toBeNull();
  });

  it("mencatat tepat di ambang dengan durasi dalam detik", () => {
    const sejakMs = mulai - AMBANG_WAJAH_HILANG_DETIK * 1000;
    const hasil = perluCatatWajahHilang("tidak_ada", sejakMs, mulai);
    expect(hasil).toEqual({ durasi_detik: AMBANG_WAJAH_HILANG_DETIK });
  });

  it("tidak mencatat ketika wajah ada", () => {
    const sejakMs = mulai - 60_000;
    expect(perluCatatWajahHilang("satu", sejakMs, mulai)).toBeNull();
  });

  it("tidak mencatat bila belum pernah ada wajah sama sekali", () => {
    // `null` = tidak tahu kapan wajah terakhir terlihat (mis. kamera baru
    // dinyalakan di tengah sesi). Mencatat durasi dari `null` akan mengarang
    // angka yang tidak pernah diukur.
    expect(perluCatatWajahHilang("tidak_ada", null, mulai)).toBeNull();
  });

  it("tidak menghasilkan durasi negatif saat jam melompat mundur", () => {
    const sejakMs = mulai + 10_000;
    const hasil = perluCatatWajahHilang("tidak_ada", sejakMs, mulai);
    expect(hasil?.durasi_detik).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/learning/kamera-klien.test.ts`
Expected: FAIL — `Cannot find module '@/lib/learning/kamera-klien'`

- [ ] **Step 3: Write the implementation**

Buat `src/lib/learning/kamera-klien.ts`:

```ts
/**
 * Pemantauan kamera untuk lapisan anti-curang — **klien saja**.
 *
 * Modul ini menyentuh `HTMLVideoElement`, `navigator.mediaDevices`, dan
 * WebAssembly, jadi ia **hanya boleh diimpor dari komponen klien**. Jangan
 * pernah mengimpornya dari server action atau server component: build akan
 * menjatuhkannya, dan kalau somehow jalan, peserta bisa membaca aturan
 * integritas yang seharusnya otoritatif di server.
 *
 * **Yang dikirim ke server hanya ANGKA** — jumlah wajah, durasi, status.
 * Frame video tidak pernah keluar dari perangkat pada pass ini (lihat bagian
 * Retensi di spec 2026-09-27). Retensi gambar adalah task terpisah dengan
 * keputusan produk tersendiri.
 *
 * **Yang ini tetap bukan bukti.** Face *detection* bukan face *recognition*:
 * model ini memberitahu "ada wajah di frame", tidak "wajah siapa". Deteksinya
 * juga bisa salah, terutama pada pencahayaan rumah — dan itu batas yang wajib
 * tertulis di laporan, bukan asumsi senyap.
 */

/** Berapa lama wajah boleh absen sebelum dicatat sebagai celah. */
export const AMBANG_WAJAH_HILANG_DETIK = 10;

export type StatusWajah = "tidak_ada" | "satu" | "lebih_dari_satu";

/** Jumlah wajah yang dilaporkan model menjadi status. Nilai di bawah 0 = tidak ada. */
export function statusWajah(jumlahWajah: number): StatusWajah {
  if (!Number.isFinite(jumlahWajah) || jumlahWajah <= 0) return "tidak_ada";
  return jumlahWajah === 1 ? "satu" : "lebih_dari_satu";
}

export interface TemuanWajahHilang {
  durasi_detik: number;
}

/**
 * Apakah kondisi "wajah tidak ada" sudah cukup lama untuk dicatat.
 *
 * Mengembalikan `null` untuk semuanya yang tidak layak dicatat — termasuk
 * `sejakMs === null`, karena "kapan wajah terakhir terlihat" memang tidak
 * diketahui dan mengarang durasi dari `null` berarti mengarang bukti.
 */
export function perluCatatWajahHilang(
  status: StatusWajah,
  sejakMs: number | null,
  sekarang: number,
): TemuanWajahHilang | null {
  if (status !== "tidak_ada" || sejakMs === null) return null;
  const milidetik = Math.max(0, sekarang - sejakMs);
  const detik = Math.floor(milidetik / 1000);
  if (detik < AMBANG_WAJAH_HILANG_DETIK) return null;
  return { durasi_detik: detik };
}

type HasilWajah = { status: StatusWajah; sejakMs: number };

/**
 * Bentuk minimal yang dipakai model. Sengaja bukan tipe resmi MediaPipe:
 * modul ini dimuat lewat `import()` dinamis, jadi tipe resminya tidak selalu
 * tersedia saat modul ini dikompilasi, dan bentuk yang dibutuhkan hanya ini.
 */
type DeteksiWajah = { detectForVideo(video: unknown, waktuMs: number): { detections?: unknown[] } };

let detektorCache: DeteksiWajah | null = null;

/**
 * Muat model sekali lalu pakai ulang.
 *
 * `import()` dinamis dipakai supaya modul MediaPipe **tidak ikut** di bundel
 * awal: peserta yang tidak menyalakan kamera tidak pernah mengunduhnya.
 *
 * Mengembalikan `null` (bukan melempar) bila model gagal dimuat — jaringan
 * buruk atau CSP adalah kondisi nyata, dan melempar akan menghentikan
 * penghitungan tanpa memberi tahu apa pun ke pemanggil.
 */
export async function praMuatModelWajah(): Promise<DeteksiWajah | null> {
  if (detektorCache) return detektorCache;
  try {
    const vision = await import("@mediapipe/tasks-vision");
    const berkas = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm",
    );
    detektorCache = (await vision.FaceDetector.createFromOptions(berkas, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
    })) as unknown as DeteksiWajah;
    return detektorCache;
  } catch {
    return null;
  }
}

/**
 * Hitung wajah pada satu frame.
 *
 * Selalu mengembalikan angka dan tidak pernah melempar. 0 berarti "tidak ada
 * wajah yang terdeteksi", dan sistem memperlakukannya sebagai **celah**, bukan
 * sebagai bukti.
 */
function hitungWajah(detektor: DeteksiWajah, video: HTMLVideoElement, waktuMs: number): number {
  try {
    return detektor.detectForVideo(video, waktuMs).detections?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Pemantau wajah berbasis MediaPipe, berjalan sepenuhnya di perangkat.
 */
export class PemantauWajah {
  private readonly padaHasil: (h: HasilWajah) => void;
  private video: HTMLVideoElement | null = null;
  private detektor: DeteksiWajah | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private sejakWajahTerakhir: number | null = null;
  private berjalan = false;

  constructor(padaHasil: (h: HasilWajah) => void) {
    this.padaHasil = padaHasil;
  }

  /**
   * Minta akses kamera, muat model, lalu mulai menghitung wajah.
   *
   * Mengembalikan `false` (bukan melempar) bila model gagal dimuat, izin
   * ditolak, atau kamera tidak ada. Pemanggil mencatatnya sebagai
   * `kamera_gagal` — yang berbeda dari "produk tidak pernah meminta" (lihat
   * `statusPersetujuan` di `src/lib/performa/integritas.ts`).
   */
  async mulai(video: HTMLVideoElement): Promise<boolean> {
    if (this.berjalan) return true;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;

    const detektor = await praMuatModelWajah();
    if (!detektor) return false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
    } catch {
      return false;
    }

    this.detektor = detektor;
    this.stream = stream;
    this.video = video;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => undefined);
    this.berjalan = true;
    void this.putar();
    return true;
  }

  private putar(): void {
    if (!this.berjalan || !this.detektor || !this.video) return;
    const status = statusWajah(hitungWajah(this.detektor, this.video, Date.now()));
    const sekarang = Date.now();
    if (status === "tidak_ada") {
      // Hanya di-*set* sekali: bila di-set ulang tiap frame, durasi yang
      // dilaporkan selalu nol dan celah tidak pernah terdeteksi.
      if (this.sejakWajahTerakhir === null) this.sejakWajahTerakhir = sekarang;
    } else {
      this.sejakWajahTerakhir = null;
    }
    this.padaHasil({ status, sejakMs: this.sejakWajahTerakhir });
    this.raf = requestAnimationFrame(() => this.putar());
  }

  /** Hentikan kamera dan lepaskan stream. Aman dipanggil berkali-kali. */
  berhenti(): void {
    this.berjalan = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video = null;
    this.detektor = null;
    this.sejakWajahTerakhir = null;
  }
}
```

- [ ] **Step 4: Add the dependency**

```bash
npm install @mediapipe/tasks-vision
```

Perhatikan: ini menambah dependensi runtime. Kalau `npm run build` gagal karena model, revise cara impor di langkah sebelumnya (dynamic import sudah dipakai).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/learning/kamera-klien.test.ts`
Expected: PASS — 7 test hijau

- [ ] **Step 6: Commit**

```bash
git add src/lib/learning/kamera-klien.ts src/lib/learning/kamera-klien.test.ts package.json package-lock.json
git commit -m "feat(learning): deteksi wajah client-side via MediaPipe (angka saja ke server)"
```

---

## Task 6: Dialog izin + integrasi kamera ke sesi

**Files:**
- Create: `src/components/features/learning/kamera-izin.tsx`
- Modify: `src/components/features/learning/course-session.tsx`
- Modify: `src/components/features/settings/settings-form.tsx:63-70`
- Modify: `src/lib/learning/security.test.ts`

**Interfaces:**
- Consumes: `PemantauWajah`, `statusWajah`, `perluCatatWajahHilang`, `AMBANG_WAJAH_HILANG_DETIK` dari Task 5; `butuhKamera` dari Task 4; `catatKejadianAction` yang sudah menerima `asal` (Task 3).
- Produces: `KameraIzin` — komponen klien dengan props `{ on: (aktif: boolean) => void }`, merender `<video>` tersembunyi + tombol.

- [ ] **Step 1: Write the failing static check**

Tambahkan ke `src/lib/learning/security.test.ts`:

```ts
describe("pengawasan kamera tidak pernah mengklaim lebih dari yang dilakukan", () => {
  const BERKAS_KAMERA = path.join(ROOT, "src/lib/learning/kamera-klien.ts");
  const BERKAS_PENGATURAN = path.join(ROOT, "src/components/features/settings/settings-form.tsx");

  it("kamera benar-benar meminta akses media", () => {
    // Gate ini menjaga arah lain: copy tentang kamera harus berubah **setelah**
    // `getUserMedia` benar-benar ada. Menghapus pemanggilan ini tanpa
    // mengembalikan copy adalah membohongi peserta.
    expect(readFileSync(BERKAS_KAMERA, "utf8")).toContain("getUserMedia");
  });

  it("copy pengaturan berhenti mengklaim kamera belum berjalan", () => {
    // Guardian: selama `getUserMedia` ada, kalimat "belum berjalan di aplikasi
    // ini" adalah kebohongan. Hapus kalimat itu — bukan tambahkan excuse.
    const isi = readFileSync(BERKAS_PENGATURAN, "utf8");
    expect(isi).not.toContain("belum berjalan di aplikasi ini");
  });

  it("menyatakan kamera tidak merekam atau mengenali wajah", () => {
    const isi = readFileSync(BERKAS_PENGATURAN, "utf8");
    expect(isi).toContain("tidak dipakai untuk mengenali wajah");
    expect(isi).toContain("tidak pernah meninggalkan");
  });

  it("tidak mengirim frame video ke server", () => {
    // Yang dikirim hanya angka. Kalau ini jadi merah, ada jalur yang mengunggah
    // gambar — dan itu butuh keputusan retensi yang belum pernah diambil.
    const isi = readFileSync(BERKAS_KAMERA, "utf8");
    expect(isi).not.toMatch(/toBlob|FormData|createImageBitmap/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/learning/security.test.ts`
Expected: FAIL pada "copy pengaturan berhenti mengklaim kamera belum berjalan"

- [ ] **Step 3: Create the consent component**

Buat `src/components/features/learning/kamera-izin.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { PemantauWajah, type StatusWajah } from "@/lib/learning/kamera-klien";

/**
 * Dialog persetujuan kamera untuk sesi terverifikasi.
 *
 * **Izin adalah dua langkah yang terpisah, dan itu disengaja.** "Mulai sesi"
 * tidak pernah otomatis menyalakan kamera: kamera merekam wajah orang, itu data
 * pribadi, dan persetujuan untuk rekam kegiatan belajar berbeda dari persetujuan
 * untuk merekam wajah.
 *
 * Menolak tidak pernah error dan tidak memblokir belajar — pada course `wajib`
 * biasa, peserta yang menolak kamera tetap menyelesaikan modul lewat jalur
 * `terverifikasi`. Hanya course `wajib_kamera` yang menuntutnya.
 *
 * Yang dikirim ke server hanya **angka** (jumlah wajah, durasi). Video tidak
 * pernah meninggalkan perangkat ini.
 */
export function KameraIzin({ on }: { on: (aktif: boolean) => void }) {
  const [status, setStatus] useState<"mati" | "menyala" | "gagal">("mati");
  const [wajah, setWajah] = useState<StatusWajah>("tidak_ada");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pemantauRef = useRef<PemantauWajah | null>(null);

  useEffect(() => {
    return () => pemantauRef.current?.berhenti();
  }, []);

  async function nyalakan() {
    const video = videoRef.current;
    if (!video) return;
    const pemantau = new PemantauWajah((h) => setWajah(h.status));
    pemantauRef.current = pemantau;
    const ok = await pemantau.mulai(video);
    if (!ok) {
      setStatus("gagal");
      on(false);
      return;
    }
    setStatus("menyala");
    on(true);
  }

  function matikan() {
    pemantauRef.current?.berhenti();
    pemantauRef.current = null;
    setStatus("mati");
    setWajah("tidak_ada");
    on(false);
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-sky-900">Pengawasan kamera</span>
        <span className="text-xs text-sky-800">
          {status === "menyala"
            ? wajah === "satu"
              ? "Wajah terdeteksi."
              : wajah === "lebih_dari_satu"
                ? "Lebih dari satu wajah terdeteksi — ini dicatat sebagai catatan."
                : "Wajah belum terlihat di depan kamera."}
            : status === "gagal"
              ? "Kamera tidak bisa dinyalakan. Dicatat sebagai gangguan teknis, bukan tanda kamu menolak."
              : "Kamera dipakai untuk menghitung apakah wajah ada, bukan merekam atau mengenali wajahmu."}
        </span>
        <button
          type="button"
          onClick={() => void nyalakan()}
          disabled={status === "menyala"}
          className="ml-auto cursor-pointer rounded-full bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {status === "menyala" ? "Kamera menyala" : "Nyalakan kamera"}
        </button>
        {status === "menyala" ? (
          <button
            type="button"
            onClick={matikan}
            className="cursor-pointer text-xs font-semibold text-sky-900 underline"
          >
            Matikan
          </button>
        ) : null}
      </div>
      {/* Video hanya untuk pemrosesan lokal. `hidden` mencegah frame tampil,
          dan `aria-hidden` menahannya di luar accessibility tree. */}
      <video ref={videoRef} hidden aria-hidden="true" className="sr-only" />
    </div>
  );
}
```

- [ ] **Step 4: Wire it into the session provider**

Di `src/components/features/learning/course-session.tsx`, tambahkan di `SessionKonteks` (setelah `ringkasanKejadian`):

```ts
  /** True ketika kamera menyala di sesi ini (course `wajib_kamera`). */
  kameraAktif: boolean;
  /** Setter dari dialog izin; provider meneruskannya ke mesin akses. */
  setKameraAktif: (aktif: boolean) => void;
```

Tambahkan state di dalam provider, setelah `const [kejadian, setKejadian] = useState<KejadianSesi[]>([]);`:

```ts
  const [kameraAktif, setKameraAktif] = useState(false);
```

Ganti callback `boleh` (baris 251-256) menjadi:

```ts
  const boleh = useCallback(
    (jenis: JenisKegiatan) =>
      putuskanAkses({
        jenisKegiatan: jenis,
        kebijakan,
        adaBuktiSesi: Boolean(bukti),
        adaBuktiKamera: kameraAktif,
      }),
    [kebijakan, bukti, kameraAktif],
  );
```

Dan tambahkan `kameraAktif` + `setKameraAktif` ke objek context yang di-provide:

```tsx
        ringkasanKejadian: ringkas(kejadian),
        kameraAktif,
        setKameraAktif,
```

Tambahkan satu effect yang mencatat kejadian kamera, tepat setelah effect Tier 1 (yang berakhir di Task 3 Step 6):

```ts
  /**
   * Catat `kamera_mulai` saat kamera benar-benar menyala.
   *
   * `runRef.current` diperiksa lebih dulu: tanpa run aktif, `runId: ""` akan
   * terkirim ke server dan ditolak — dan penolakan itu tidak terlihat di sini,
   * jadi kamera akan terlihat "aktif" tanpa satu pun kejadian yang tercatat.
   */
  useEffect(() => {
    const id = runRef.current;
    if (!kameraAktif || !id) return;
    void catatKejadianAction({
      runId: id,
      jenis: "kamera_mulai",
      visibilitas: "visible",
      asal: "kamera",
    })
      .then((hasil) => {
        if (hasil.ok && hasil.run) setKejadian(kejadianDariRun(hasil.run));
      })
      .catch(() => undefined);
  }, [kameraAktif]);
```

- [ ] **Step 5: Update the settings copy to be true**

Di `src/components/features/settings/settings-form.tsx`, ganti paragraf pada baris 63-70 (yang memuat "belum berjalan di aplikasi ini") menjadi:

```tsx
  Kamera dirancang hanya aktif di dalam sesi terverifikasi yang kamu setujui, dan tidak pernah menyala di luarnya. Pencatatan yang berjalan: pindah tab, fokus yang hilang, paste dan pintasan yang/dlilarang, dan — kalau kamu menyalakannya — apakah wajahmu ada di depan kamera. Deteksi wajah berjalan di perangkatmu dan hanya angkanya yang dikirim; videonya tidak pernah meninggalkan perangkat. Kamera tidak dipakai untuk mengenali wajah. Bukti sesi hanya dilihat peserta dan staf berwenang, dan kamu bisa mengajukan keberatan lewat halaman pengaturan ini.
```

- [ ] **Step 7: Run the gate**

Run: `npm run check`
Expected: exit 0

Run: `npm run build`
Expected: sukses

- [ ] **Step 8: Verify in a real browser (wajib)**

Buka `/pengaturan`, konfirmasi paragraf kamera sudah yang baru dan tidak lagi menyebut "belum berjalan". Lalu buka `/belajar/r1`, mulai sesi, dan:

```js
// Apakah dialog izin ada, dan apakah menolak kamera memblokir belajar?
({ adaTombolKamera: !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Nyalakan kamera')) });
```

Klik "Nyalakan kamera" lalu izinkan di prompt browser, dan pastikan:

```js
// Kamera benar-benar mengalir (bukan hanya UI yang berubah)
const v = document.querySelector('video');
({ adaVideo: !!v, flowing: v ? v.videoWidth > 0 : false });
```

`flowing: true` adalah bukti bahwa `getUserMedia` benar-benar jalan. Kalau `false`, kamera tidak berjalan dan copy baru **telah berbohong** — kembalikan Task 6.

- [ ] **Step 9: Commit**

```bash
git add src/components/features/learning/kamera-izin.tsx src/components/features/learning/course-session.tsx src/components/features/settings/settings-form.tsx src/lib/learning/security.test.ts
git commit -m "feat(learning): dialog izin kamera + pencatatan kejadian kamera di sesi"
```

---

# BAGIAN C — Lapisan 3: pembacaan sinyal lockdown browser (SEB)

Task 7. SEB hanya **dibaca**, tidak dibangun.

---

## Task 7: Deteksi sesi berjalan di Safe Exam Browser

SEB (open source, MPL) mengirim header `X-SafeExamBrowser` saat ujian berjalan di dalamnya. Kita tidak membangun aplikasinya.

**Files:**
- Modify: `src/lib/learning/sumber-sinyal.ts`
- Modify: `src/lib/learning/sumber-sinyal.test.ts`

**Interfaces:**
- Consumes: `JENIS_KEJADIAN_SAH` (Task 2, sudah berisi `seb_aktif`).
- Produces:
  - `const HEADER_SEB = "x-safeexambrowser"`
  - `function deteksiSeb(headers: { get(nama: string): string | null }): boolean`
  - `function versiSeb(headers: { get(nama: string): string | null }): string | null`

- [ ] **Step 1: Write the failing test**

Tambahkan ke `src/lib/learning/sumber-sinyal.test.ts`:

```ts
describe("deteksiSeb", () => {
  const headers = (peta: Record<string, string>) => ({
    get: (nama: string) => peta[nama.toLowerCase()] ?? null,
  });

  it("mengenali sesi yang berjalan di SEB", () => {
    expect(deteksiSeb(headers({ "x-safeexambrowser": "1" }))).toBe(true);
  });

  it("tidak mengenali sesi di browser biasa", () => {
    // Tidaknya header **tidak** berarti SEB tidak dipakai — hanya berarti kita
    // tidak punya bukti. Keduanya dibedakan di laporan lewat `asal` sinyal.
    expect(deteksiSeb(headers({}))).toBe(false);
  });

  it("membaca versi SEB untuk disimpan sebagai detail", () => {
    expect(versiSeb(headers({ "x-safeexambrowser": "SEB_3_5_0" }))).toBe("SEB_3_5_0");
  });

  it("mengembalikan null versi saat tidak ada", () => {
    expect(versiSeb(headers({}))).toBeNull();
  });
});
```

Tambahkan import di kepala file:

```ts
import { deteksiSeb, versiSeb } from "./sumber-sinyal";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/learning/sumber-sinyal.test.ts`
Expected: FAIL — `deteksiSeb` is not exported

- [ ] **Step 3: Implement**

Tambahkan di akhir `src/lib/learning/sumber-sinyal.ts`:

```ts
/**
 * Header yang dikirim Safe Exam Browser (SEB) ke LMS ketika ujian berjalan di
 * dalamnya.
 *
 * SEB adalah aplikasi open source (MPL-2.0) yang mengunci komputer selama
 * ujian: taskbar, Alt+Tab, Alt+F4, Ctrl+Alt+Del, cetak, dan navigasi browser
 * dimatikan. Careevo **tidak membangun dan tidakuyama** SEB — ia hanya membaca
 * sinyal bahwa ujian memang berjalan di dalamnya.
 *
 * Sinyal ini opsional dan **tidak pernah wajib**: ketiadaan header berarti "tidak
 * ada bukti", bukan "tidak dipakai". Lihat `BATAS_SINYAL.luar`.
 */
export const HEADER_SEB = "x-safeexambrowser";

type PembacaHeader = { get(nama: string): string | null };

/** True bila ada header SEB, apa pun isinya. */
export function deteksiSeb(headers: PembacaHeader): boolean {
  return headers.get(HEADER_SEB) !== null;
}

/** Nilai mentah header SEB (biasanya `SEB_3_5_0`), atau `null`. */
export function versiSeb(headers: PembacaHeader): string | null {
  return headers.get(HEADER_SEB);
}
```

- [ ] **Step 4: Record it in `mulaiSesiAction`**

Di `src/actions/learning.ts`, tambahkan import di blok yang sudah ada:

```ts
import { headers } from "next/headers";
import { deteksiSeb, versiSeb } from "@/lib/learning/sumber-sinyal";
```

Lalu, di `mulaiSesiAction`, setelah blok `if (kejadianLama.length === 0) { ... }` (baris 138-146) dan **sebelum** baris `const kejadian =`:

```ts
  // Sesi yang berjalan di Safe Exam Browser dilaporkan sekali per run, tepat
  // seperti `sesi_dimulai`. Sinyal ini informatif — ia tidak mengubah
  // keputusan akses, dan course `wajib_kamera` tetap butuh kamera, bukan SEB.
  if (kejadianLama.length === 0) {
    const hdr = await headers();
    if (deteksiSeb(hdr)) {
      await catatKejadianDb({
        principal: session,
        runId: run.id,
        jenis: "seb_aktif",
        visibilitas: "visible",
        asal: "luar",
        detail: `Safe Exam Browser ${versiSeb(hdr) ?? "tanpa versi"}`,
      });
    }
  }
```

- [ ] **Step 5: Run the gate**

Run: `npm run check && npm run build`
Expected: both hijau

- [ ] **Step 6: Verify the header path with a real request**

```bash
npm run dev
# di terminal lain — tanpa header SEB:
curl -sI http://localhost:3000/belajar | grep -i safeexam || echo "tidak ada header (benar)"
# dengan header SEB:
curl -sI -H "X-SafeExamBrowser: SEB_3_5_0" http://localhost:3000/belajar | grep -i safeexam
```

Lalu cek di database apakah `seb_aktif` tercatat setelah memulai sesi:

```bash
psql "$DATABASE_URL" -c \
  "select kind, payload_redacted->>'asal' as asal, payload_redacted->>'detail' as detail
   from learning_events where kind = 'seb_aktif' order by occurred_at desc limit 5;"
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/learning/sumber-sinyal.ts src/lib/learning/sumber-sinyal.test.ts src/actions/learning.ts
git commit -m "feat(learning): catat sinyal Safe Exam Browser saat sesi dimulai"
```

---

# BAGIAN D — Laporan: menyampaikan sinyal baru ke staf

Task 8. Tanpa ini, Task 1–7 menambah data yang tidak pernah dilihat manusia.

---

## Task 8: Temuan baru + asal sinyal di laporan integritas

**Files:**
- Modify: `src/lib/performa/integritas.ts:93-101, 231-277`
- Modify: `src/lib/performa/integritas.test.ts`
- Modify: `src/components/features/performa/performa-integritas.tsx`
- Modify: `src/lib/learning/dashboard.ts:276-302` (`kejadianDariEvent`)

**Interfaces:**
- Consumes: `asalSinyal`, `BATAS_SINYAL`, `AsalSinyal` dari Task 2.
- Produces:
  - `LABEL_KEJADIAN` + 8 label baru.
  - `KodeTemuan` + 4 kode baru: `"keluar_fullscreen"`, `"paste_massal"`, `"pintasan_terlarang"`, `"wajah_kedua"`.
  - `RingkasanSesi` + `perAsal: Record<AsalSinyal, number>`.
  - `KejadianIntegritas` (di `session.ts`) + `asal?: AsalSinyal`.

- [ ] **Step 1: Write the failing test**

Tambahkan ke `src/lib/performa/integritas.test.ts`:

```ts
describe("temuanSesi untuk sinyalLapisan baru", () => {
  it("menyatakan keluar layar penuh tanpa menyebut navigasi", () => {
    const daftar = temuanSesi(
      run({ id: "s1", owner: "o@x.test", kejadian: [kejadian("keluar_fullscreen", "kejadian")] }),
    );
    const t = daftar.find((x) => x.kode === "keluar_fullscreen");
    expect(t?.label).toBe("Keluar layar penuh 1×");
    // Yang diketahui: keluar dari layar penuh. Yang tidak: apa yang dibuka.
    expect(t?.detail).toContain("Tidak diketahui");
  });

  it("menyatakan paste massal beserta jeda ketik", () => {
    const daftar = temuanSesi(
      run({
        id: "s1",
        owner: "o@x.test",
        kejadian: [
          { ...kejadian("paste_massal", "kejadian"), detail: "400 karakter, jeda 30s" },
        ],
      }),
    );
    const t = daftar.find((x) => x.kode === "paste_massal");
    expect(t?.label).toContain("Paste panjang");
    expect(t?.detail).toContain("400");
  });

  it("menyatakan wajah kedua sebagai catatan, bukan tuduhan", () => {
    const daftar = temuanSesi(
      run({ id: "s1", owner: "o@x.test", kejadian: [kejadian("wajah_kedua", "kejadian")] }),
    );
    const t = daftar.find((x) => x.kode === "wajah_kedua");
    // Kata "wajah kedua" adalah fakta terukur; "ada orang lain yang membantu"
    // adalah kesimpulan yang **tidak** boleh keluar dari aritmetika.
    expect(t?.detail).toContain("Tidak diketahui");
    expect(t?.detail).not.toContain("membantu");
  });

  it("tidak memakai kata vonis untuk sinyal baru mana pun", () => {
    const semua = temuanSesi(
      run({
        id: "s1",
        owner: "o@x.test",
        kejadian: [
          kejadian("keluar_fullscreen", "kejadian"),
          kejadian("paste_massal", "kejadian"),
          kejadian("pintasan_terlarang", "kejadian"),
          kejadian("wajah_kedua", "kejadian"),
        ],
      }),
    );
    for (const t of semua) {
      for (const kata of ["curang", "menyalin", "mencontek", "penyalahgunaan", "bersalah", "membantu"]) {
        expect(`${t.label} ${t.detail}`.toLowerCase()).not.toContain(kata);
      }
    }
  });
});
```

Tambahkan juga test untuk pengelompokan asal:

```ts
describe("ringkasanIntegritasByOwner mengelompokkan asal sinyal", () => {
  it("memisahkan sinyal peramban dari turunan kamera", () => {
    const peta = ringkasIntegritasByOwner([
      run({
        id: "s1",
        owner: "o@x.test",
        kejadian: [
          { ...kejadian("pindah_tab", "kejadian"), asal: "browser" },
          { ...kejadian("wajah_kedua", "kejadian"), asal: "kamera" },
        ],
      }),
    ]);
    const isi = peta.get("o@x.test");
    expect(isi?.perAsal.browser).toBe(1);
    expect(isi?.perAsal.kamera).toBe(1);
  });

  it("menghitung kejadian tanpa asal sebagai sinyal server", () => {
    // Baris lama (sebelum `asal` ada) tidak boleh hilang dari hitungan.
    const peta = ringkasIntegritasByOwner([
      run({ id: "s1", owner: "o@x.test", kejadian: [kejadian("sesi_dimulai", "kejadian")] }),
    ]);
    expect(peta.get("o@x.test")?.perAsal.server).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/performa/integritas.test.ts`
Expected: FAIL — kode temuan baru tidak dikenal, `perAsal` tidak ada

- [ ] **Step 3: Add the labels and codes**

Di `src/lib/performa/integritas.ts`, tambahkan import:

```ts
import { asalSinyal, type AsalSinyal } from "@/lib/learning/sumber-sinyal";
```

Ganti `LABEL_KEJADIAN` (baris 93-101) dengan label baru:

```ts
export const LABEL_KEJADIAN: Record<KejadianIntegritas["jenis"], string> = {
  pindah_tab: "Keluar tab",
  fokus_hilang: "Fokus hilang",
  kamera_mulai: "Kamera menyala",
  kamera_berhenti: "Kamera berhenti",
  kamera_gagal: "Kamera gagal",
  sesi_dimulai: "Sesi dimulai",
  sesi_diakhiri: "Sesi diakhiri",
  keluar_fullscreen: "Keluar layar penuh",
  paste_massal: "Paste panjang",
  pintasan_terlarang: "Pintasan terlarang",
  salin_terlarang: "Salin bahan",
  wajah_tidak_terdeteksi: "Wajah tidak terlihat",
  wajah_kedua: "Wajah kedua terdeteksi",
  seb_aktif: "Berjalan di lockdown browser",
};
```

Ganti `KodeTemuan` (baris 103-108):

```ts
export type KodeTemuan =
  | "kamera_tidak_aktif"
  | "pindah_tab"
  | "fokus_hilang"
  | "celah_pengawasan"
  | "kedaluwarsa"
  | "keluar_fullscreen"
  | "paste_massal"
  | "pintasan_terlarang"
  | "wajah_kedua";
```

Tambahkan `asal?: AsalSinyal` ke `KejadianIntegritas` di `src/lib/learning/session.ts` (baris 33-40):

```ts
export interface KejadianIntegritas {
  at: string;
  jenis: KJenisKejadian;
  jenis_klasifikasi: "kejadian" | "celah";
  visibilitas: "visible" | "hidden" | null;
  /**
   * Asal sinyal, sudah tervalidasi server terhadap empat asal yang sah
   * (`run-service.asalValid`). `undefined` untuk baris lama yang ditulis
   * sebelum field ini ada — pembaca harus memperlakukannya sebagai `server`,
   * bukan membuangnya.
   */
  asal?: AsalSinyal;
  detail?: string;
}
```

Tambahkan import di `src/lib/learning/session.ts`:

```ts
import type { AsalSinyal } from "./sumber-sinyal";
```

- [ ] **Step 4: Read `asal` in the DB adapter**

Di `src/lib/learning/dashboard.ts`, di dalam `kejadianDariEvent` (baris 276-302), tambahkan sebelum `return`:

```ts
  const asalMentah = payload.asal;
  const asal =
    asalMentah === "browser" || asalMentah === "kamera" || asalMentah === "luar" || asalMentah === "server"
      ? asalMentah
      : asalSinyal(jenis);
```

Dan tambahkan `asal,` ke objek yang dikembalikan, serta import:

```ts
import { asalSinyal } from "./sumber-sinyal";
```

- [ ] **Step 5: Count per source in the summary**

Di `src/lib/performa/integritas.ts`, tambahkan ke `RingkasanSesi`:

```ts
  /** Jumlah kejadian per asal sinyal — dasar untuk "dari mana angka ini". */
  perAsal: Record<AsalSinyal, number>;
```

Di dalam `ringkasIntegritasByOwner`, tambahkan di awal loop (setelah `const celah = ...`):

```ts
    const perAsal: Record<AsalSinyal, number> = { browser: 0, kamera: 0, luar: 0, server: 0 };
    for (const k of run.kejadian) perAsal[asalSinyal(k.jenis)] += 1;
```

Dan tambahkan `perAsal,` ke objek yang di-push ke `isi.daftar`.

- [ ] **Step 6: Extend `temuanSesi`**

Di `src/lib/performa/integritas.ts`, tambahkan sebelum `return hasil;` di `temuanSesi` (baris 276):

```ts
  const fullscreen = run.kejadian.filter((k) => k.jenis === "keluar_fullscreen").length;
  if (fullscreen > 0) {
    hasil.push({
      kode: "keluar_fullscreen",
      label: `Keluar layar penuh ${fullscreen}×`,
      detail: "Tidak diketahui apa yang dibuka: exits dari layar penuh tidak berarti kehilangan fokus.",
    });
  }

  const paste = run.kejadian.filter((k) => k.jenis === "paste_massal");
  if (paste.length > 0) {
    const terpanjang = paste.reduce((m, k) => {
      const n = Number(k.detail?.match(/^(\d+)/)?.[1] ?? 0);
      return n > m ? n : m;
    }, 0);
    hasil.push({
      kode: "paste_massal",
      label: `Paste panjang ${paste.length}×`,
      detail: `Panjang terpanjang ${terpanjang} karakter. Menempel teks panjang tanpa mengetik berbeda dari menulis, tapi menyalin catatan sendiri juga mungkin.`,
    });
  }

  const pintasan = run.kejadian.filter((k) => k.jenis === "pintasan_terlarang").length;
  if (pintasan > 0) {
    hasil.push({
      kode: "pintasan_terlarang",
      label: `Pintasan terlarang ${pintasan}×`,
      detail: "Tidak diketahui pintasan mana yang dipakai atau untuk apa.",
    });
  }

  const wajahKedua = run.kejadian.filter((k) => k.jenis === "wajah_kedua").length;
  if (wajahKedua > 0) {
    hasil.push({
      kode: "wajah_kedua",
      label: `Wajah kedua terdeteksi ${wajahKedua}×`,
      detail: "Tidak diketahui siapa orang kedua itu atau apakah ia sengaja masuk frame.",
    });
  }
```

- [ ] **Step 7: Show the source in the report UI**

Di `src/components/features/performa/performa-integritas.tsx`, tambahkan import:

```ts
import { BATAS_SINYAL, type AsalSinyal } from "@/lib/learning/sumber-sinyal";
```

Di `src/app/(verifikator)/performa/integritas/[owner]/page.tsx`, hitung dulu
jumlah per asal **seluruh sesi** peserta itu. Tambahkan tepat setelah baris
`const ringkas = ringkasan.get(emailPemilik);` (baris 67):

```tsx
  // Jumlah sinyal per asal, dijumlahkan di seluruh sesi — bukan hanya sesi
  // terbaru. Menjumlahkan per sesi di dalam JSX membuat angka yang sama ditulis
  // ulang per sesi, dan yang dirender cuma sesi pertama: peserta dengan lima
  // sesi akan melihat hitungan yang salah lima kali.
  const perAsal = (Object.keys(BATAS_SINYAL) as AsalSinyal[]).reduce(
    (acc, asal) => {
      acc[asal] = ringkas?.daftar.reduce((n, s) => n + s.perAsal[asal], 0) ?? 0;
      return acc;
    },
    {} as Record<AsalSinyal, number>,
  );
  const asalTerpakai = (Object.keys(perAsal) as AsalSinyal[]).filter((a) => perAsal[a] > 0);
```

Lalu tambahkan `<li>` ini di dalam `Ringkasan` section, setelah `<li>` "Persetujuan kamera":

```tsx
            <li className="list-app-row">
              <span className="row-title">Asal sinyal</span>
              <span className="text-xs text-muted-foreground">
                {asalTerpakai.length === 0
                  ? "—"
                  : asalTerpakai.map((asal) => `${perAsal[asal]} ${asal}`).join(" · ")}
              </span>
            </li>
```

Dan tambahkan blok batas asal tepat setelah `</ul>` penutup `Ringkasan`, di
dalam `<section>` yang sama — **setelah** `asalTerpakai` dihitung, supaya teks
yang ditampilkan bisa berhenti di asal yang benar-benar muncul:

```tsx
          {asalTerpakai.length > 0 ? (
            <ul className="list-app text-xs text-muted-foreground">
              {asalTerpakai.map((asal) => (
                <li key={asal}>
                  <span className="font-medium">{asal}:</span> {BATAS_SINYAL[asal]}
                </li>
              ))}
            </ul>
          ) : null}
```

Menampilkan batas hanya untuk asal yang muncul itu disengaja: empat baris
batas untuk empat sumber membuat pembaca mengira semua sumber aktif, dan itu
klaim yang tidak benar untuk peserta yang belum pernah menyalakan kamera.

- [ ] **Step 8: Run the gate**

Run: `npm run check && npm run build`
Expected: both hijau

- [ ] **Step 9: Verify in a real browser (wajib)**

Buka `/performa/integritas` sebagai verifikator, masuk ke detail satu peserta yang punya sesi, dan konfirmasi:

```js
// Batas asal tampil, dan hanya untuk asal yang benar-benar muncul
({ batasBrowser: document.body.innerText.includes("bisa dihentikan sepihak") });
```

Lalu provoke `paste_massal` di browser, muat ulang halaman detail peserta itu,
dan konfirmasi hitungan `browser` ikut naik — kalau tidak, `perAsal` sedang
dihitung dari satu sesi saja.

- [ ] **Step 10: Commit**

```bash
git add src/lib/performa/integritas.ts src/lib/performa/integritas.test.ts src/lib/learning/session.ts src/lib/learning/dashboard.ts src/components/features/performa/performa-integritas.tsx "src/app/(verifikator)/performa/integritas/[owner]/page.tsx"
git commit -m "feat(performa): laporan integritas menampilkan asal tiap sinyal"
```

---

## Task 9: Dokumentasi

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: semuanya.
- Produces: entri di bagian "Architecture" yang menjelaskan `wajib_kamera`, lapisan sinyal, dan aturan bahwa `completion_path` tetap dua nilai.

- [ ] **Step 1: Add the documentation**

Di `AGENTS.md`, tambahkan sub-bagian baru di bawah "## Stubs — do not assume these work":

```markdown
## Lapisan pengawasan anti-curang

Sesi terverifikasi punya **empat lapisan deteksi**, semuanya tercatat sebagai
kejadian di `learning_events` dan **tidak pernah** menurunkan skor atau reputasi.

| Lapisan | Sinyal | Asal |
|---|---|---|
| 0 (dasar) | `pindah_tab`, `fokus_hilang` | `browser` |
| 1 (browser) | `keluar_fullscreen`, `paste_massal`, `pintasan_terlarang`, `salin_terlarang` | `browser` |
| 2 (kamera) | `wajah_tidak_terdeteksi`, `wajah_kedua` | `kamera` |
| 3 (luar) | `seb_aktif` (Safe Exam Browser) | `luar` |

Aturan yang tidak boleh dilanggar:

- **`JENIS_KEJADIAN_SAH` (`src/lib/learning/akses.ts`) adalah daftar tunggal.**
  Jenis baru = satu entri baru. Validasi wire sudah membacanya, jadi tidak ada
  daftar kedua.
- **`asalSinyal` selalu wajib.** `ASAL_SINYAL` memetakan tiap jenis ke
  `browser`/`kamera`/`luar`/`server`, dan `BATAS_SINYAL` menyatakan batasnya.
  Tanpa asal, "wajah kedua" (model) dan "keluar tab" (self-report) dibaca
  sekuat satu sama lain — dan itu tidak benar.
- **Klasifikasi browser adalah fungsi murni** (`pengawasan-klien.ts`), bukan
  logika di dalam `addEventListener`: repo tidak punya harness render, jadi
  logika listener tidak pernah teruji.
- **`wajib_kamera` menambah nilai `AturanPengawasan`, bukan `completion_path`.**
  Kolom `completion_path` punya CHECK constraint database (`schema.ts:473`) dan
  hanya punya dua nilai; jalur kamera **diturunkan** dari kejadian run.
- **Kamera tidak pernah aktif secara default** dan butuh persetujuan terpisah
  dari "Mulai sesi". Menolaknya pada course `wajib` biasa tidak kehilangan akses
  belajar.
- **Frame kamera tidak pernah dikirim ke server.** Hanya angka turunan yang
  dikirim. Retensi gambar belum pernah ditetapkan — jangan akui sudah ada.
- **Tidak ada sinyal yang menghukum otomatis.** Hold modul hanya lewat temuan
  yang `dikokohkan` staf yang berbeda dari pengaju.
```

- [ ] **Step 2: Run the skills + doc gate**

Run: `npm run skills:check && npm run check`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: lapisan pengawasan anti-curang"
```

---

## Verifikasi akhir (wajib sebelum menyatakan selesai)

Semua ini **wajib** — `npm run check` saja sudah pernah hijau saat UI rusak.

```bash
npm run check          # typecheck + lint + skills + test
npm run build          # menangkap impor server-only di bundel klien
```

Lalu, terhadap `npm run dev` yang berjalan:

1. **Alur happy** — mulai sesi, kerjakan materi, selesaikan: `selesai` naik, `terverifikasi` tercatat.
2. **Sinyal tercatat** — provoke paste + pintasan, lalu cek di `learning_events` bahwa `kind` dan `payload_redacted.asal` benar.
3. **Kamera** — nyalakan, izinkan, konfirmasi `videoWidth > 0`; matikan; konfirmasi `kamera_berhenti` tercatat sebagai `celah`.
4. **Penolakan kamera** — pada course `wajib` biasa, menolak kamera **tetap bisa** menyelesaikan modul.
5. **Mobile** — resize ke 390×844; panel pengawasan tidak boleh menimpa jawaban (probe geometri, bukan `looks fine`).
6. **Laporan** — `/performa/integritas` menampilkan blok asal + batasnya.

**Laporkan dengan jujur apa yang tidak diperiksa.** Contoh yang sering terlewat: jalur gagal kamera, komposisi IME, perilaku tanpa JavaScript, dan apa pun yang tidak pernah melihat merah.
