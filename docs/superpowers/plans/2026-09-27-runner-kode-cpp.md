# Runner Kode C++ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyediakan layanan terpisah yang mengompilasi dan menjalankan kode C++ peserta di dalam kontainer terisolasi, lalu menyambungkannya ke blok `kode` lewat satu route API.

**Architecture:** Runner adalah proses `.mjs` terpisah yang hanya mendengarkan di `127.0.0.1`, dijaga rahasia bersama, dan menjalankan tiap program di kontainer rootless podman tanpa jaringan, tanpa filesystem di luar, dengan batas proses, memori, dan waktu. Next.js tidak pernah menulis kode peserta ke disk. Ia hanya meneruskan sumber lewat HTTP, lalu memetakan status semantik ke pesan bahasa Indonesia. Antarmuka ditulis sebagai port murni supaya `npm test` tetap hijau tanpa podman.

**Tech Stack:** Node.js 22 `node:http`, rootless podman, image `docker.io/library/gcc:13`, Next.js 16 route handler, Zod 4, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-27-editor-kode-cpp-design.md`

> **Prasyarat.** `docs/superpowers/plans/2026-09-27-blok-kode-cpp.md` harus selesai lebih dulu. Plan ini memakai `KodeView` dan tipe blok `kode` dari sana.
>
> **Status produksi.** Runner tidak punya rumah di produksi M0. `docs/adr/0001-topologi-deployment-produksi.md` bagian 1.0 menyatakan API VPS tidak dapat dijangkau browser selama M0. Plan ini menargetkan mesin lokal dan demo. Memberinya rumah di produksi adalah amandemen ADR, bukan bagian dari plan ini.

## Global Constraints

- **Copy berbahasa Indonesia.** Angka `255` dan `137` tidak boleh pernah sampai ke peserta (P4 spec).
- **Runner hanya bind `127.0.0.1`.** Port yang terjangkau jaringan berarti siapa pun bisa menjalankan kode di mesin ini (P2 spec).
- **`CAREEVO_RUNNER_SECRET` wajib dibandingkan di setiap permintaan** (P2 spec).
- **Semua flag podman dibangun di satu fungsi murni** yang diekspor, supaya seluruh permukaan audit ada di satu berkas (P7 spec).
- **Next.js tidak pernah menulis kode peserta ke disk** (P3 spec).
- **`npm test` harus tetap hijau tanpa podman dan tanpa g++.**
- **Route handler Next.js tidak punya perlindungan CSRF bawaan.** `originDiizinkan` wajib disalin dari `src/app/api/unggah/route.ts` (T5 spec).
- **`vitest.integration.config.mts` tidak boleh dilebarkan.** Glob `src/**/*.integration.test.ts` adalah kontrak.
- **Tidak ada `dangerouslySetInnerHTML`.**
- **Jangan push** ke remote tanpa izin eksplisit pengguna.
- **Bukti terukur sudah ada** di spec bagian "Bukti terukur". Plan ini tidak mengulang spike. Ia mengunci flag yang sudah terukur.

## Fakta yang sudah diverifikasi di mesin ini

Semuanya diuji langsung pada 2026-09-27, bukan diasumsikan. Jangan mengubahnya tanpa menguji ulang.

| Fakta | Bukti |
|---|---|
| Rootless podman jalan | `podman info` melaporkan `rootless: true`, graph driver `overlay` |
| Image ada | `docker.io/library/gcc:13` sudah ter-pull, 1.41 GB |
| Mount perlu sufiks `:z` | Tanpa sufiks itu mount ditolak SELinux dengan `Permission denied` pada berkas 0644 yang bisa dibaca (T8 spec) |
| Berkas `.mjs` di luar `tsconfig` | `tsconfig.json` hanya menyertakan `**/*.ts`, `**/*.tsx`, `**/*.mts`. `*.mjs` tidak ikut, jadi runner tidak di-`typecheck` (T6 spec) |
| Vitest bisa mengimpor modul `server-only` | Diuji dengan mengimpor `@/lib/auth/session` dari sebuah test. Lulus |
| **`*.test.mjs` tidak terlihat `npm test`** | `vitest.config.mts` punya `include: ["src/**/*.test.ts"]`. Berkas `.test.mjs` menghasilkan "No test files found" |
| `SessionPrincipal.email` wajib | `src/lib/auth/principal.ts:30`. Field `email: string`, bukan opsional |

Baris keenam adalah jebakan. Test sandbox **harus** `.test.ts`. Kalau ia `.test.mjs`, test itu terlihat ada tapi tidak pernah jalan, dan `npm test` tetap hijau. Itu lebih buruk daripada tidak punya test.

## Peta File

**Create:**
- `src/lib/exec/port.ts` — tipe dan antarmuka port. Murni, aman untuk klien.
- `src/lib/exec/port.test.ts` — pemetaan status ke pesan bahasa Indonesia.
- `src/lib/exec/sandbox.test.ts` — assertion statis atas `runner/soal.mjs`. Ekstensi `.ts` demi alasan di atas.
- `src/lib/exec/proses-lokal.ts` — satu-satunya implementasi port. Server-only.
- `src/lib/exec/proses-lokal.test.ts` — uji dengan `fetch` tiruan.
- `src/lib/exec/index.ts` — barrel untuk sisi server.
- `src/lib/exec/runner/package.json` — paket terpisah, di luar build Next.
- `src/lib/exec/runner/soal.mjs` — satu-satunya tempat flag podman dibangun.
- `src/lib/exec/runner/server.mjs` — HTTP server, antrean, siklus hidup spool.

**Modify:**
- `src/lib/rate-limit/kebijakan.ts` — `NAMA_KEBIJAKAN` dan `AMBANG` untuk `jalankanKode`.
- `src/lib/rate-limit/rate-limit.test.ts` — dua test untuk kebijakan baru.
- `src/app/api/jalankan/route.ts` — route handler baru.
- `src/components/features/learning/kode-view.tsx` — tombol Jalankan, pane keluaran, ruang latihan.
- `src/lib/learning/kode-view.test.ts` — assertion baru untuk mode jalankan.
- `src/components/features/learning/halaman-view.tsx` — teruskan `dapatJalankan` dan `kunci` ke `KodeView`.
- `eslint.config.mjs` — abaikan `src/lib/exec/runner/**`.
- `AGENTS.md` — catat runner sebagai proses ketiga yang harus hidup.

---

### Task 1: Port murni dan pemetaan status

Semua yang tidak butuh podman. Setelah task ini, kontrak eksekusi terkunci dan bisa diuji.

**Files:**
- Create: `src/lib/exec/port.ts`, `src/lib/exec/port.test.ts`

**Interfaces:**
- Consumes: `BahasaKode` dari `@/types/course`
- Produces:
  ```ts
  export type StatusJalankan =
    | "sukses" | "gagal_kompilasi" | "waktu_habis" | "memori_habis"
    | "proses_habis" | "ditolak" | "galat_runner";

  export type NadaJalankan = "sukses" | "galat" | "info";

  export interface MintaJalankan {
    bahasa: BahasaKode;
    kode: string;
    stdin?: string;
  }

  export interface HasilJalankan {
    status: StatusJalankan;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    durasiMs: number;
  }

  export interface PortJalankan {
    jalankan(minta: MintaJalankan): Promise<HasilJalankan>;
  }

  export function hasilGagal(status: StatusJalankan, stderr?: string): HasilJalankan;
  export function petakanStatus(status: StatusJalankan): {
    judul: string;
    nada: NadaJalankan;
    detail?: string;
  };
  ```

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/exec/port.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hasilGagal, petakanStatus, type StatusJalankan } from "./port";

const SEMUA: StatusJalankan[] = [
  "sukses",
  "gagal_kompilasi",
  "waktu_habis",
  "memori_habis",
  "proses_habis",
  "ditolak",
  "galat_runner",
];

describe("petakanStatus", () => {
  it("memetakan setiap status ke judul yang tidak kosong", () => {
    for (const status of SEMUA) {
      expect(petakanStatus(status).judul.length).toBeGreaterThan(0);
    }
  });

  it("tidak pernah menampilkan angka exit mentah ke peserta", () => {
    // P4 spec. Angka 255 dan 137 adalah detail internal podman. Kalau angka
    // ini bocor ke peserta, peserta membaca angka yang tidak menjelaskan apa pun.
    for (const status of SEMUA) {
      const petakan = petakanStatus(status);
      expect(petakan.judul).not.toMatch(/\b(124|137|255)\b/);
      expect(petakan.detail ?? "").not.toMatch(/\b(124|137|255)\b/);
    }
  });

  it("menyatakan batas pelayanan tanpa menyalahkan peserta", () => {
    // Batas 10 detik dan 512 MB adalah limit layanan, bukan kesalahan orang.
    const terlarang = /kamu|kamu salah|tidak mampu|gagal mengerjakan/;
    for (const status of ["waktu_habis", "memori_habis", "proses_habis"] as const) {
      expect(petakanStatus(status).judul.toLowerCase()).not.toMatch(terlarang);
    }
  });

  it("menyatakan angka batasnya sendiri", () => {
    expect(petakanStatus("waktu_habis").detail).toContain("10 detik");
    expect(petakanStatus("memori_habis").detail).toContain("512 MB");
    expect(petakanStatus("proses_habis").detail).toContain("64 proses");
  });

  it("hanya sukses yang bernada sukses", () => {
    expect(petakanStatus("sukses").nada).toBe("sukses");
    for (const status of SEMUA.filter((s) => s !== "sukses")) {
      expect(petakanStatus(status).nada).not.toBe("sukses");
    }
  });

  it("gagal_kompilasi tidak meringkas pesan compiler", () => {
    // Yang ditampilkan adalah stderr GCC apa adanya. Ringkasan akan jadi
    // penurunan kualitas, jadi pemeta tidak boleh menimpanya dengan detail.
    const petakan = petakanStatus("gagal_kompilasi");
    expect(petan.detail).toBeUndefined();
    expect(petan.nada).toBe("galat");
  });
});

describe("hasilGagal", () => {
  it("mengisi stdout kosong dan durasi nol", () => {
    const hasil = hasilGagal("memori_habis");
    expect(hasil.stdout).toBe("");
    expect(hasil.durasiMs).toBe(0);
    expect(hasil.status).toBe("memori_habis");
  });

  it("menyimpan stderr bila diberikan", () => {
    expect(hasilGagal("gagal_kompilasi", "error: expected ';'").stderr).toBe(
      "error: expected ';'",
    );
  });

  it("tidak mengarang exitCode untuk status semantik", () => {
    // Status semantik sudah membawa artinya. Mengisi exitCode di sini hanya
    // menciptakan jalan bagi UI untuk menampilkannya.
    expect(hasilGagal("waktu_habis").exitCode).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
npx vitest run src/lib/exec/port.test.ts
```

Expected: FAIL. `src/lib/exec/port.ts` belum ada.

- [ ] **Step 3: Tulis `port.ts`**

Buat `src/lib/exec/port.ts`:

```ts
import type { BahasaKode } from "@/types/course";

/**
 * Kontrak eksekusi kode.
 *
 * Berkas ini **murni**. Tidak ada I/O, tidak ada `node:*`, tidak ada `fetch`.
 * Komponen klien mengimpornya, jadi satu impor server akan menjatuhkan build.
 * Implementasinya ada di `proses-lokal.ts` yang server-only.
 */

/**
 * Status semantik, bukan exit code.
 *
 * Angka exit dari podman adalah detail internal. Angka 255 muncul saat
 * kontainer dihentikan karena batas waktu, dan 137 saat kehabisan memori.
 * Meneruskannya ke peserta berarti peserta membaca angka yang tidak
 * menjelaskan apa pun (P4 spec).
 */
export type StatusJalankan =
  | "sukses"
  | "gagal_kompilasi"
  | "waktu_habis"
  | "memori_habis"
  | "proses_habis"
  | "ditolak"
  | "galat_runner";

export interface MintaJalankan {
  bahasa: BahasaKode;
  /** Sumber yang akan dikompilasi. Teks polos. */
  kode: string;
  stdin?: string;
}

export interface HasilJalankan {
  status: StatusJalankan;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durasiMs: number;
}

export interface PortJalankan {
  jalankan(minta: MintaJalankan): Promise<HasilJalankan>;
}

/** Nada visual, supaya komponen tidak memilih warna dari teks. */
export type NadaJalankan = "sukses" | "galat" | "info";

export interface PetakanStatus {
  judul: string;
  nada: NadaJalankan;
  detail?: string;
}

/**
 * Hasil untuk kegagalan yang tidak menghasilkan keluaran program.
 *
 * `exitCode` sengaja `null`. Status semantik sudah membawa artinya, dan
 * mengisinya di sini hanya menciptakan jalan bagi UI untuk menampilkannya.
 */
export function hasilGagal(status: StatusJalankan, stderr = ""): HasilJalankan {
  return { status, stdout: "", stderr, exitCode: null, durasiMs: 0 };
}

/**
 * Pesan untuk peserta.
 *
 * Kalimatnya menyatakan peristiwa, bukan menyalahkan orang, karena batas
 * 10 detik dan 512 MB adalah limit pelayanan. Angka batasnya ditulis di
 * `detail` supaya peserta tahu apa yang terjadi, bukan menebak.
 *
 * `gagal_kompilasi` sengaja tidak memakai `detail`. Yang ditampilkan untuk
 * status itu adalah stderr GCC apa adanya, bukan ringkasan.
 */
export function petakanStatus(status: StatusJalankan): PetakanStatus {
  switch (status) {
    case "sukses":
      return { judul: "Program selesai tanpa galat.", nada: "sukses" };
    case "gagal_kompilasi":
      return { judul: "Program belum bisa dikompilasi.", nada: "galat" };
    case "waktu_habis":
      return {
        judul: "Program dihentikan karena berjalan terlalu lama.",
        nada: "galat",
        detail: "Batas layanan adalah 10 detik per percobaan.",
      };
    case "memori_habis":
      return {
        judul: "Program dihentikan karena memakai terlalu banyak memori.",
        nada: "galat",
        detail: "Batas layanan adalah 512 MB per percobaan.",
      };
    case "proses_habis":
      return {
        judul: "Program dihentikan karena membuat terlalu banyak proses.",
        nada: "galat",
        detail: "Batas layanan adalah 64 proses untuk satu program.",
      };
    case "ditolak":
      return { judul: "Blok kode ini belum bisa dijalankan.", nada: "info" };
    case "galat_runner":
      return {
        judul: "Layanan eksekusi sedang tidak tersedia.",
        nada: "galat",
        detail: "Coba lagi sebentar lagi.",
      };
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan hijau**

```bash
npx vitest run src/lib/exec/port.test.ts
```

Expected: PASS, sembilan test.

- [ ] **Step 5: Commit**

```bash
npm run typecheck
git add src/lib/exec/port.ts src/lib/exec/port.test.ts
git commit -m "feat(exec): port eksekusi dan pemetaan status semantik"
```

---

### Task 2: Kebijakan rate limit

Route tanpa rate limit untuk endpoint yang menjalankan kompilator adalah lubang yang menunggu diisi. Union tertutup `NAMA_KEBIJAKAN` memaksa entri ini ada, jadi `typecheck` gagal kalau tertinggal.

**Files:**
- Modify: `src/lib/rate-limit/kebijakan.ts`, `src/lib/rate-limit/rate-limit.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces: kebijakan `"jalankanKode"` untuk `batasiRequestMasuk(request, "jalankanKode", …)`

- [ ] **Step 1: Tambahkan nama dan ambang**

Di `NAMA_KEBIJAKAN`, tambahkan `"jalankanKode"` di akhir daftar.

Di `AMBANG`, tambahkan entri ini:

```ts
  // Kompilasi C++ memakan CPU dan hanya berguna sebentar. 20 percobaan per 10
  // menit cukup untuk belajar sambil bereksperimen, dan menahan program yang
  // sengaja didesain untuk menguras mesin.
  //
  // `bucketPrincipal: true` itu wajib, bukan pilihan. Satu kelas belajar
  // berada di satu jaringan, jadi pengelompokan per IP akan membatasi satu
  // geng dan membiarkan penyalahguna berpindah IP.
  //
  // `failOpen: false` karena endpoint ini menjalankan biner. Lebih baik
  // menolak daripada membuka kompilator.
  jalankanKode: {
    limit: 20,
    window: "10 m",
    resetDetik: 600,
    failOpen: false,
    bucketPrincipal: true,
    label: "Jalankan kode",
  },
```

- [ ] **Step 2: Tambahkan dua test**

Buka `src/lib/rate-limit/rate-limit.test.ts`. Tambahkan test berikut di `describe` yang sudah menguji `AMBANG`, dan pastikan `AMBANG` sudah diimpor:

```ts
  it("jalankanKode dikelompokkan per principal, bukan per IP", () => {
    // Satu kelas belajar berada di satu jaringan. Pengelompokan per IP akan
    // membatasi satu geng dan membiarkan penyalahguna berpindah IP.
    expect(AMBANG.jalankanKode.bucketPrincipal).toBe(true);
  });

  it("jalankanKode gagal tertutup, karena endpoint ini menjalankan biner", () => {
    expect(AMBANG.jalankanKode.failOpen).toBe(false);
  });
```

- [ ] **Step 3: Jalankan test dan `typecheck`**

```bash
npx vitest run src/lib/rate-limit/rate-limit.test.ts && npm run typecheck
```

Expected: PASS dan hijau. Tanpa entri `AMBANG` baru, `typecheck` merah karena `AMBANG` bertipe `Record<NamaKebijakan, …>`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/rate-limit/kebijakan.ts src/lib/rate-limit/rate-limit.test.ts
git commit -m "feat(rate-limit): kebijakan jalankanKode per principal"
```

---

### Task 3: Flag sandbox dalam satu berkas

Ini seluruh permukaan audit (P7 spec). Test-nya mengunci setiap flag. Menghapus test ini berarti batas keamanan kehilangan penjaganya.

**Files:**
- Create: `src/lib/exec/runner/package.json`, `src/lib/exec/runner/soal.mjs`, `src/lib/exec/sandbox.test.ts`
- Modify: `eslint.config.mjs`

**Interfaces:**
- Consumes: tidak ada
- Produces, dari `soal.mjs`:
  ```js
  export const IMAGE_KOMPILASI;                       // string
  export const BATAS;                                 // objek angka dan string
  export function namaBerkas(bahasa);                 // "cpp" -> "main.cpp"
  export function bangunArgumenPodman({ bahasa, direktori, timeoutDetik });
  export function petakanExitCode({ exitCode, stdout, stderr });
  export function potongKeluaran(teks, maks);
  ```

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/exec/sandbox.test.ts`. Ekstensi `.ts` itu wajib, karena `vitest.config.mts` hanya menyertakan `src/**/*.test.ts`.

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Assertion statis atas `runner/soal.mjs`.
 *
 * Dua alasan berkas ini ada dalam bentuknya sekarang.
 *
 * Pertama, `vitest.config.mts` hanya menyertakan `src/**/*.test.ts`. Berkas
 * `.test.mjs` tidak akan terlihat `npm test` sama sekali, dan test yang tidak
 * jalan lebih buruk daripada test yang tidak ada, karena ia terlihat lulus.
 *
 * Kedua, mengimpor `.mjs` dari `.ts` butuh deklarasi tipe yang tidak ada di
 * repo. Membaca sumbernya sebagai teks menghindari keduanya, dan untuk
 * mengunci flag keamanan, memverifikasi bahwa literal flag itu benar-benar
 * ada adalah assertion yang tepat.
 */
const sumber = readFileSync(
  fileURLToPath(new URL("./runner/soal.mjs", import.meta.url)),
  "utf8",
);

describe("sandbox di soal.mjs", () => {
  it("tidak pernah memberi jaringan", () => {
    expect(sumber).toContain("--network=none");
  });

  it("tidak pernah menulis ke filesystem kontainer", () => {
    expect(sumber).toContain("--read-only");
  });

  it("menjalankan sebagai pengguna tanpa hak, bukan root", () => {
    expect(sumber).toContain("--user=65534:65534");
  });

  it("membuang seluruh kapabilitas Linux", () => {
    expect(sumber).toContain("--cap-drop=all");
  });

  it("menonaktifkan eskalasi hak", () => {
    expect(sumber).toContain("no-new-privileges");
  });

  it("membatasi jumlah proses", () => {
    expect(sumber).toContain("--pids-limit=");
  });

  it("membatasi memori", () => {
    expect(sumber).toContain("--memory=");
  });

  it("membatasi CPU", () => {
    expect(sumber).toContain("--cpus=");
  });

  it("membatasi waktu", () => {
    expect(sumber).toContain("--timeout=");
  });

  it("memblokir eksekusi dari /tmp", () => {
    // Binary hasil kompilasi ada di /w, bukan /tmp. Jadi /tmp boleh noexec
    // sementara /w tetap harus bisa mengeksekusi.
    expect(sumber).toContain("/tmp:rw,noexec");
    expect(sumber).toContain("/w:rw,nosuid,nodev");
  });

  it("memakai sufiks :z pada mount, karena SELinux membutuhkannya", () => {
    // Tanpa sufiks ini mount ditolak dengan "Permission denied" di mesin ini.
    // Sudah diverifikasi pada 2026-09-27.
    expect(sumber).toContain("/src:ro,z");
  });

  it("menyediakan satu fungsi yang membangun seluruh flag", () => {
    // P7 spec. Kalau flag sandbox muncul di berkas lain, jawabannya tidak lagi
    // bisa diberikan dengan membaca satu berkas.
    expect(sumber).toContain("bangunArgumenPodman");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
npx vitest run src/lib/exec/sandbox.test.ts
```

Expected: FAIL. `runner/soal.mjs` belum ada.

- [ ] **Step 3: Abaikan runner di eslint**

Buka `eslint.config.mjs` dan tambahkan entri ke `globalIgnores`, setelah entri `engine/**`:

```js
    // careevo runner: proses Node `.mjs` terpisah yang menjalankan podman.
    // Ia di luar build graph Next (orchestrated dari route handler lewat HTTP),
    // dan aturannya milik Node, bukan aturan browser. Aturan `nextTs` akan
    // salah menilai kode Node sebagai kode klien.
    "src/lib/exec/runner/**",
```

- [ ] **Step 4: Tulis `package.json` runner**

Buat `src/lib/exec/runner/package.json`:

```json
{
  "name": "careevo-runner",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Layanan eksekusi C++ terisolasi. Proses terpisah, di luar Next.js.",
  "scripts": {
    "start": "node server.mjs"
  }
}
```

- [ ] **Step 5: Tulis `soal.mjs`**

Buat `src/lib/exec/runner/soal.mjs`:

```js
/**
 * Seluruh permukaan audit sandbox dalam satu berkas.
 *
 * Pertanyaan "apa yang boleh dilakukan kode peserta" harus bisa dijawab dengan
 * membaca satu berkas ini saja (P7 spec). Karena itu tidak ada flag podman
 * lain di repo mana pun. Flag yang tersebar tidak bisa diaudit, dan
 * `src/lib/exec/sandbox.test.ts` mengunci setiap flag yang disebut di bawah.
 *
 * Angka di sini bukan tebakan. Semuanya sudah diukur di mesin ini pada
 * 2026-09-27, dan hasilnya tercatat di spec bagian "Bukti terukur".
 */

/** Image yang berisi g++. Satu image, satu bahasa. */
export const IMAGE_KOMPILASI = "docker.io/library/gcc:13";

/** Batas keras. Dipotong di runner, bukan di Next. */
export const BATAS = {
  baris: 20_000,
  karakter: 200_000,
  stdinKarakter: 8_192,
  keluaranKarakter: 65_536,
  timeoutDetik: 10,
  memori: "512m",
  proses: 64,
  cpu: "1",
  antrean: 3,
};

const BERKAS_BAHASA = { cpp: "main.cpp" };

/** Nama berkas sumber untuk sebuah bahasa. Melempar untuk bahasa tak dikenal. */
export function namaBerkas(bahasa) {
  const nama = BERKAS_BAHASA[bahasa];
  if (!nama) throw new Error(`Bahasa tidak dikenal: ${bahasa}`);
  return nama;
}

/**
 * Argumen `podman run` untuk satu eksekusi.
 *
 * Setiap flag di sini punya alasan, dan alasannya diuji di `sandbox.test.ts`:
 *
 * - `--network=none`. Kode peserta tidak butuh jaringan sama sekali.
 * - `--read-only`. Filesystem kontainer tidak boleh berubah.
 * - `--user=65534:65534`. Nobody. Root di dalam kontainer rootless masih
 *   terisolasi, tapi tidak perlu dipakai.
 * - `--cap-drop=all` dan `no-new-privileges`. Menutup jalur eskalasi hak.
 * - `--pids-limit`. Menahan fork bomb. Tanpa itu satu program bisa meledakkan
 *   jumlah proses mesin.
 * - `--memory` dan `--cpus`. Menahan program yang rakus.
 * - `/tmp` diberi `noexec` supaya tidak ada biner yang dieksekusi dari sana.
 *   Direktori kerja **harus** boleh exec, karena binary hasil kompilasi
 *   dijalankan dari sana. Membalik dua hal ini membuat sandbox tidak berguna.
 * - `--volume=...:/src:ro,z`. Mount hanya-baca, dan sufiks `z` wajib di mesin
 *   ini karena SELinux. Tanpa itu mount ditolak dengan Permission denied
 *   bahkan untuk berkas 0644 yang bisa dibaca.
 */
export function bangunArgumenPodman({
  bahasa,
  direktori,
  timeoutDetik = BATAS.timeoutDetik,
}) {
  const berkas = namaBerkas(bahasa);
  return {
    args: [
      "run",
      "--rm",
      "--network=none",
      "--read-only",
      "--cap-drop=all",
      "--security-opt=no-new-privileges",
      "--pids-limit=" + String(BATAS.proses),
      "--memory=" + BATAS.memori,
      "--cpus=" + BATAS.cpu,
      "--user=65534:65534",
      "--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777",
      "--tmpfs=/w:rw,nosuid,nodev,size=32m,mode=1777",
      "--env=HOME=/tmp",
      "--env=TMPDIR=/tmp",
      "--volume=" + direktori + ":/src:ro,z",
      "--workdir=/w",
      "--timeout=" + String(timeoutDetik),
      IMAGE_KOMPILASI,
      "sh",
      "-c",
      ["cp /src/" + berkas + " /w/" + berkas, "g++ -std=c++20 -O0 -o a.out " + berkas, "./a.out"].join(
        " && ",
      ),
    ],
  };
}

/**
 * Exit code podman menjadi status semantik.
 *
 * Angka yang tidak dikenal dipetakan ke `galat_runner`, bukan diteruskan.
 * Meneruskan angka yang tidak dipahami berarti menampilkan angka yang tidak
 * menjelaskan apa pun (P4 spec).
 *
 * Pemetaan di bawah sudah diukur, bukan ditebak:
 * - `137` adalah 128 + 9, yaitu SIGKILL dari cgroup saat kehabisan memori.
 * - `255` adalah podman yang Killed, yaitu batas waktu `--timeout` habis.
 * - Galat kompilasi selalu disertai stdout kosong dan `error:` di stderr.
 */
export function petakanExitCode({ exitCode, stdout, stderr }) {
  if (exitCode === 0) return "sukses";
  if (exitCode === 137) return "memori_habis";
  if (exitCode === 124) return "waktu_habis";
  if (exitCode === 255) return /killed/i.test(stderr) ? "waktu_habis" : "galat_runner";
  if (stdout === "" && /error:/i.test(stderr)) return "gagal_kompilasi";
  if (stdout === "" && /fork|process/i.test(stderr)) return "proses_habis";
  return "galat_runner";
}

/** Potong keluaran ke batas, dengan penanda bahwa pemotongan terjadi. */
export function potongKeluaran(teks, maks = BATAS.keluaranKarakter) {
  if (teks.length <= maks) return teks;
  return teks.slice(0, maks) + "\n… keluaran dipotong pada batas layanan";
}
```

- [ ] **Step 6: Jalankan test, pastikan hijau**

```bash
npx vitest run src/lib/exec/sandbox.test.ts
```

Expected: PASS, dua belas test.

- [ ] **Step 7: Commit**

```bash
npm run check
git add src/lib/exec/runner/package.json src/lib/exec/runner/soal.mjs \
  src/lib/exec/sandbox.test.ts eslint.config.mjs
git commit -m "feat(runner): flag sandbox podman dalam satu berkas yang diaudit"
```

---

### Task 4: Server runner dengan antrean dan siklus hidup spool

**Files:**
- Create: `src/lib/exec/runner/server.mjs`

**Interfaces:**
- Consumes: `BATAS`, `IMAGE_KOMPILASI`, `bangunArgumenPodman`, `namaBerkas`, `petakanExitCode`, `potongKeluaran` dari `soal.mjs`
- Produces: HTTP di `127.0.0.1:8021` dengan `GET /sehat` dan `POST /jalankan`

- [ ] **Step 1: Tulis server**

Buat `src/lib/exec/runner/server.mjs`:

```js
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BATAS,
  IMAGE_KOMPILASI,
  bangunArgumenPodman,
  namaBerkas,
  petakanExitCode,
  potongKeluaran,
} from "./soal.mjs";

/**
 * Layanan eksekusi C++.
 *
 * Proses terpisah, di luar Next.js, karena dua alasan. Jalur permintaan Next
 * tidak boleh pernah bisa menjalankan biner (P3 spec). Dan kode peserta butuh
 * batas proses, memori, serta waktu yang tidak bisa dipenuhi Next. Next adalah
 * route handler biasa, bukan sandbox.
 *
 * Ia hanya mendengarkan di loopback. Port yang terjangkau jaringan berarti
 * siapa pun bisa menjalankan kode di mesin ini (P2 spec).
 */

const HOST = "127.0.0.1";
const PORT = Number(process.env.CAREEVO_RUNNER_PORT ?? 8021);
const RAHASIA = process.env.CAREEVO_RUNNER_SECRET ?? "";

/**
 * Antrean sederhana dengan lebar `BATAS.antrean`.
 *
 * Tanpa ini, sepuluh peserta menekan Jalankan bersamaan berarti sepuluh proses
 * g++ di satu laptop. Ini kegagalan kelas kelas, jadi ditangani di runner.
 */
let berjalan = 0;
const antrean = [];

function jalankanDalamAntrean(tugas) {
  return new Promise((selesai) => {
    antrean.push({ tugas, selesai });
    kosongkan();
  });
}

function kosongkan() {
  while (berjalan < BATAS.antrean && antrean.length > 0) {
    const pekerjaan = antrean.shift();
    berjalan += 1;
    pekerjaan
      .tugas()
      .then(pekerjaan.selesai, pekerjaan.selesai)
      .finally(() => {
        berjalan -= 1;
        kosongkan();
      });
  }
}

function kirim(res, kode, badan) {
  res.writeHead(kode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(badan));
}

async function bacaBadan(req, maks) {
  const bagian = [];
  let total = 0;
  for await (const potongan of req) {
    total += potongan.length;
    if (total > maks) throw new Error("badan terlalu besar");
    bagian.push(potongan);
  }
  return Buffer.concat(bagian).toString("utf8");
}

const kosong = { stdout: "", stderr: "", exitCode: null };

/** Satu eksekusi: tulis sumber, jalankan podman, bersihkan. */
async function eksekusi({ bahasa, kode, stdin }) {
  if (!RAHASIA) return { status: "galat_runner", ...kosong, durasiMs: 0 };

  if (kode.split("\n").length > BATAS.baris || kode.length > BATAS.karakter) {
    return { status: "ditolak", ...kosong, durasiMs: 0 };
  }
  const masukan = stdin ?? "";
  if (masukan.length > BATAS.stdinKarakter) {
    return { status: "ditolak", ...kosong, durasiMs: 0 };
  }

  const dir = await mkdtemp(join(tmpdir(), "careevo-exec-"));
  const mulai = Date.now();
  try {
    await writeFile(join(dir, namaBerkas(bahasa)), kode, "utf8");
    const { args } = bangunArgumenPodman({ bahasa, direktori: dir });
    const hasil = await jalankanPodman(args, masukan);
    return {
      status: petakanExitCode(hasil),
      stdout: potongKeluaran(hasil.stdout),
      stderr: potongKeluaran(hasil.stderr),
      exitCode: hasil.exitCode,
      durasiMs: Date.now() - mulai,
    };
  } finally {
    // Wajib ada di `finally`. Tanpa itu, galat di tengah jalan meninggalkan
    // berkas sumber peserta di disk tanpa batas waktu.
    await rm(dir, { recursive: true, force: true });
  }
}

function jalankanPodman(args, masukan) {
  return new Promise((selesai) => {
    const child = spawn("podman", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let ditutup = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c) => {
      stdout += c;
    });
    child.stderr.on("data", (c) => {
      stderr += c;
    });

    // Kirim masukan lalu tutup. Program yang membaca sampai baris kosong harus
    // melihat akhir stream, kalau tidak ia menggantung sampai batas waktu.
    child.stdin.on("error", () => {});
    child.stdin.end(masukan);

    const tutup = (exitCode) => {
      if (ditutup) return;
      ditutup = true;
      selesai({ stdout, stderr, exitCode });
    };

    child.on("error", (galat) => {
      stderr += String(galat.message);
      tutup(null);
    });
    child.on("close", (code) => tutup(code));
  });
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/sehat") {
    kirim(res, 200, { ok: true, image: IMAGE_KOMPILASI, antrean: antrean.length });
    return;
  }

  if (req.method !== "POST" || req.url !== "/jalankan") {
    kirim(res, 404, { ok: false, error: "Tidak ditemukan" });
    return;
  }

  // Perbandingan rahasia sebelum body disentuh. Tanpa ini, proses lokal lain
  // bisa mengendarai runner (P2 spec).
  if (!RAHASIA || req.headers["x-runner-secret"] !== RAHASIA) {
    kirim(res, 401, { ok: false, error: "Rahasia runner salah atau belum diisi" });
    return;
  }

  bacaBadan(req, BATAS.karakter + BATAS.stdinKarakter + 4096)
    .then((mentah) => {
      const minta = JSON.parse(mentah);
      if (minta?.bahasa !== "cpp" || typeof minta?.kode !== "string") {
        kirim(res, 400, { ok: false, error: "Permintaan tidak sah" });
        return null;
      }
      return jalankanDalamAntrean(() => eksekusi(minta));
    })
    .then((hasil) => {
      if (hasil) kirim(res, 200, { ok: true, ...hasil });
    })
    .catch((galat) => {
      kirim(res, 400, { ok: false, error: String(galat?.message ?? galat) });
    });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`runner C++ mendengarkan di http://${HOST}:${PORT}\n`);
});

/** Galat saat start-up harus terlihat, bukan ditelan diam-diam. */
process.on("uncaughtException", (galat) => {
  process.stderr.write(`galat tak tertangani: ${String(galat)}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Jalankan runner**

```bash
export CAREEVO_RUNNER_SECRET="uji-lokal-uji-lokal"
node src/lib/exec/runner/server.mjs
```

- [ ] **Step 3: Buktikan kasus sukses**

Di terminal lain:

```bash
curl -sS http://127.0.0.1:8021/sehat
curl -sS -X POST http://127.0.0.1:8021/jalankan \
  -H "content-type: application/json" \
  -H "x-runner-secret: uji-lokal-uji-lokal" \
  -d '{"bahasa":"cpp","kode":"#include <iostream>\nint main(){std::string n;std::getline(std::cin,n);std::cout<<\"Halo, \"<<n<<\"!\\n\";}","stdin":"Budi"}'
```

Expected: `status` adalah `sukses` dan `stdout` adalah `Halo, Budi!`.

- [ ] **Step 4: Buktikan tiga penolakan**

```bash
# Tanpa rahasia. Expect 401.
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8021/jalankan \
  -H "content-type: application/json" -d '{"bahasa":"cpp","kode":"int main(){}"}'

# Loop tak berujung. Expect status waktu_habis, bukan 255 mentah.
curl -sS -X POST http://127.0.0.1:8021/jalankan \
  -H "content-type: application/json" -H "x-runner-secret: uji-lokal-uji-lokal" \
  -d '{"bahasa":"cpp","kode":"int main(){for(;;){}}"}'

# Fork bomb. Expect status proses_habis.
curl -sS -X POST http://127.0.0.1:8021/jalankan \
  -H "content-type: application/json" -H "x-runner-secret: uji-lokal-uji-lokal" \
  -d '{"bahasa":"cpp","kode":"#include <unistd.h>\nint main(){for(;;){if(fork()==0){for(;;){}}}}"}'
```

Kalau `waktu_habis` atau `proses_habis` tidak muncul, perbaiki `petakanExitCode` di `soal.mjs` memakai angka yang benar-benar kamu lihat di `exitCode`, lalu perbarui komentar di berkas itu supaya tidakRIAL menyimpang dari kode.

- [ ] **Step 5: Buktikan galat kompilasi informatif**

```bash
curl -sS -X POST http://127.0.0.1:8021/jalankan \
  -H "content-type: application/json" -H "x-runner-secret: uji-lokal-uji-lokal" \
  -d '{"bahasa":"cpp","kode":"int main(){ int x = \"bukan angka\"; }"}'
```

Expected: `status` adalah `gagal_kompilasi`, dan `stderr` memuat `error:` beserta nomor baris. Ini adalah sinyal mengajar, jadi tidak boleh diringkas.

- [ ] **Step 6: Buktikan tidak ada berkas tersisa**

```bash
ls -d /tmp/careevo-exec-* 2>/dev/null && echo "ADA SISA" || echo "bersih"
```

Expected: `bersih`. Sisa di sini berarti `finally` tidak berjalan, dan itu kebocoran disk.

- [ ] **Step 7: Commit**

```bash
npm run check
git add src/lib/exec/runner/server.mjs
git commit -m "feat(runner): server eksekusi dengan antrean dan pembersihan spool"
```

---

### Task 5: Route `/api/jalankan`

**Files:**
- Create: `src/lib/exec/proses-lokal.ts`, `src/lib/exec/proses-lokal.test.ts`, `src/lib/exec/index.ts`, `src/app/api/jalankan/route.ts`

**Interfaces:**
- Consumes: `MintaJalankan`, `HasilJalankan`, `PortJalankan`, `hasilGagal` dari `./port`; `originDiizinkan` dari `@/lib/http/origin`; `batasiRequestMasuk` dari `@/lib/rate-limit/next`; `getSession` dari `@/lib/auth/session`
- Produces:
  ```ts
  export class ProsesLokal implements PortJalankan {
    constructor(
      bawaan?: typeof fetch,
      host?: string,
      port?: string,
    );
    jalankan(minta: MintaJalankan): Promise<HasilJalankan>;
  }
  export const prosesLokal: ProsesLokal;
  ```

- [ ] **Step 1: Tulis implementasi port**

Buat `src/lib/exec/proses-lokal.ts`:

```ts
import "server-only";
import type { HasilJalankan, MintaJalankan, PortJalankan } from "./port";
import { hasilGagal } from "./port";

/**
 * Implementasi port yang memanggil runner terpisah.
 *
 * Server-only karena membaca `CAREEVO_RUNNER_SECRET`. Komponen klien tidak
 * boleh mengimpornya. Mereka memakai `./port` yang murni.
 *
 * `import "server-only"` aman terhadap test: vitest bisa me-resolve modul itu,
 * dan itu sudah diuji di mesin ini pada 2026-09-27.
 */

const HOST = process.env.CAREEVO_RUNNER_HOST ?? "127.0.0.1";
const PORT = process.env.CAREEVO_RUNNER_PORT ?? "8021";

/**
 * Panggil runner.
 *
 * `AbortController` dipakai supaya route tidak menggantung lebih lama daripada
 * batas waktu kontainer. Tanpa itu, peserta yang menunggu antrean bisa membuat
 * request Next menggantung lebih lama dari yang masuk akal.
 */
export class ProsesLokal implements PortJalankan {
  constructor(
    private readonly bawaan: typeof fetch = fetch,
    private readonly host: string = HOST,
    private readonly port: string = PORT,
  ) {}

  async jalankan(minta: MintaJalankan): Promise<HasilJalankan> {
    const rahasia = process.env.CAREEVO_RUNNER_SECRET;
    if (!rahasia) {
      // Fail-closed. Tanpa rahasia, lebih baik peserta melihat "layanan tidak
      // tersedia" daripada runner terbuka untuk proses lokal lain.
      return hasilGagal("galat_runner");
    }

    const batasMs = Number(process.env.CAREEVO_RUNNER_TIMEOUT_MS ?? 30_000);
    const kendali = new AbortController();
    const timer = setTimeout(() => kendali.abort(), batasMs);

    try {
      const balasan = await this.bawaan(`http://${this.host}:${this.port}/jalankan`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-runner-secret": rahasia },
        body: JSON.stringify(minta),
        signal: kendali.signal,
      });

      if (!balasan.ok) return hasilGagal("galat_runner");
      return (await balasan.json()) as HasilJalankan;
    } catch {
      return hasilGagal("galat_runner");
    } finally {
      clearTimeout(timer);
    }
  }
}

export const prosesLokal = new ProsesLokal();
```

- [ ] **Step 2: Tulis test dengan `fetch` tiruan**

Buat `src/lib/exec/proses-lokal.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { ProsesLokal } from "./proses-lokal";
import type { HasilJalankan } from "./port";

const LOKAL = "http://127.0.0.1:8021";

const hasil: HasilJalankan = {
  status: "sukses",
  stdout: "Halo, Budi!",
  stderr: "",
  exitCode: 0,
  durasiMs: 1500,
};

function balasan(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

function tiruan(fn: () => Promise<Response>) {
  return vi.fn(fn) as unknown as typeof fetch;
}

describe("ProsesLokal", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("mengirim ke loopback, bukan ke host bebas", async () => {
    const bawaan = tiruan(async () => balasan(hasil));
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");
    await new ProsesLokal(bawaan).jalankan({ bahasa: "cpp", kode: "int main(){}" });

    expect(bawaan).toHaveBeenCalledWith(`${LOKAL}/jalankan`, expect.anything());
  });

  it("mengirimkan rahasia pada header", async () => {
    const bawaan = tiruan(async () => balasan(hasil));
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");
    await new ProsesLokal(bawaan).jalankan({ bahasa: "cpp", kode: "int main(){}" });

    const opsi = (bawaan as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const header = opsi.headers as Record<string, string>;
    expect(header["x-runner-secret"]).toBe("rahasia-uji");
  });

  it("gagal tertutup tanpa rahasia, dan tidak pernah memanggil runner", async () => {
    const bawaan = tiruan(async () => balasan(hasil));
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "");
    const hasilMinta = await new ProsesLokal(bawaan).jalankan({
      bahasa: "cpp",
      kode: "int main(){}",
    });

    expect(hasilMinta.status).toBe("galat_runner");
    expect(bawaan).not.toHaveBeenCalled();
  });

  it("mengembalikan galat_runner saat runner tidak menjawab", async () => {
    const bawaan = tiruan(async () => {
      throw new Error("ECONNREFUSED");
    });
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");
    const hasilMinta = await new ProsesLokal(bawaan).jalankan({
      bahasa: "cpp",
      kode: "int main(){}",
    });

    expect(hasilMinta.status).toBe("galat_runner");
  });

  it("meneruskan hasil runner apa adanya", async () => {
    const bawaan = tiruan(async () => balasan(hasil));
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");
    const hasilMinta = await new ProsesLokal(bawaan).jalankan({
      bahasa: "cpp",
      kode: "int main(){}",
    });

    expect(hasilMinta).toEqual(hasil);
  });
});
```

- [ ] **Step 3: Jalankan test, pastikan hijau**

```bash
npx vitest run src/lib/exec/proses-lokal.test.ts
```

Expected: PASS, lima test.

- [ ] **Step 4: Tulis barrel**

Buat `src/lib/exec/index.ts`:

```ts
export type {
  HasilJalankan,
  MintaJalankan,
  NadaJalankan,
  PortJalankan,
  StatusJalankan,
} from "./port";
export { hasilGagal, petakanStatus } from "./port";
export { ProsesLokal, prosesLokal } from "./proses-lokal";
```

- [ ] **Step 5: Tulis route**

Buat `src/app/api/jalankan/route.ts`:

```ts
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { originDiizinkan } from "@/lib/http/origin";
import { batasiRequestMasuk } from "@/lib/rate-limit/next";
import { prosesLokal } from "@/lib/exec";

/**
 * Menjalankan kode C++ peserta.
 *
 * Route ini menyerahkan pekerjaan ke proses runner. Ia tidak pernah menjalankan
 * biner sendiri (P3 spec). Perannya hanya gerbang: asal Origin, sesi, rate
 * limit, dan validasi bentuk.
 *
 * Galat setelah gerbang tersebut mengembalikan 200 dengan amplop hasil. Peserta
 * yang programnya gagal kompilasi sedang tidak mengalami galat jaringan, dan
 * membedakannya penting untuk mencoba ulang.
 */

const skemaTubuh = z.object({
  bahasa: z.literal("cpp"),
  kode: z.string().min(1, "Kode tidak boleh kosong").max(200_000, "Kode terlalu panjang"),
  stdin: z.string().max(8_192, "Masukan terlalu panjang").optional(),
  /**
   * Peserta menyatakan blok ini memang boleh ia jalankan. `z.literal(true)`
   * membuat blok tanpa centang ditolak di lapisan validasi, bukan hanya
   * disembunyikan di UI.
   */
  dapatDijalankan: z.literal(true),
});

function galat(status: number, pesan: string): Response {
  return Response.json({ ok: false, error: pesan }, { status });
}

export async function POST(request: Request): Promise<Response> {
  // Route handler tidak mendapat perlindungan CSRF bawaan Next.js. Guard ini
  // wajib, dan ia fail-closed. Lihat `@/lib/http/origin`.
  if (!originDiizinkan(request)) {
    return galat(403, "Asal permintaan ditolak.");
  }

  // Peserta yang sedang belajar, bukan staf. Jadi `getSession`, bukan gate staf.
  const sesi = await getSession();
  if (!sesi) {
    return galat(401, "Sesi tidak ditemukan. Silakan masuk terlebih dahulu.");
  }

  // `sesi.email` adalah `string` wajib pada `SessionPrincipal`, jadi aman
  // dipakai sebagai pengenal bucket. Lihat `src/lib/auth/principal.ts:30`.
  const batas = await batasiRequestMasuk(request, "jalankanKode", {
    tambahan: sesi.email,
  });
  if (batas) return batas;

  let badan: unknown;
  try {
    badan = await request.json();
  } catch {
    return galat(400, "Badan permintaan bukan JSON yang sah.");
  }

  const parsed = skemaTubuh.safeParse(badan);
  if (!parsed.success) {
    return galat(400, parsed.error.issues[0]?.message ?? "Permintaan tidak sah.");
  }

  const hasil = await prosesLokal.jalankan({
    bahasa: parsed.data.bahasa,
    kode: parsed.data.kode,
    stdin: parsed.data.stdin,
  });

  return Response.json({ ok: true, ...hasil });
}
```

- [ ] **Step 6: `typecheck` dan `check`**

```bash
npm run typecheck && npm run check
```

Expected: hijau.

- [ ] **Step 7: Buktikan route menolak tanpa sesi**

Jalankan `npm run dev`, lalu:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3000/api/jalankan \
  -H "content-type: application/json" -d '{"bahasa":"cpp","kode":"int main(){}","dapatDijalankan":true}'
```

Expected: `401`. Kalau `403`, Origin menolak duluan, dan itu juga benar. Yang penting bukan `200`.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/jalankan/route.ts src/lib/exec/
git commit -m "feat(api): route jalankan kode dengan gerbang asal, sesi, dan rate limit"
```

---

### Task 6: Tombol Jalankan dan ruang latihan

**Files:**
- Modify: `src/components/features/learning/kode-view.tsx`, `src/lib/learning/kode-view.test.ts`, `src/components/features/learning/halaman-view.tsx`

**Interfaces:**
- Consumes: `petakanStatus`, `StatusJalankan` dari `@/lib/exec/port`; `usePersistentValue`, `setPersistentValue` dari `@/lib/hooks/use-persistent-state`
- Produces: `KodeView` dengan props tambahan `kunci: string`, `dapatJalankan?: boolean`, `stdin?: string`, `kodeAwal?: string`

- [ ] **Step 1: Tambahkan assertion statis**

Di `src/lib/learning/kode-view.test.ts`, tambahkan tiga test berikut ke `describe` yang sudah ada:

```ts
  it("hanya mengirim ke server, tidak pernah menjalankan biner sendiri", () => {
    // P3 spec. Klien tidak boleh menjalankan program.
    expect(sumber).toContain("/api/jalankan");
    expect(sumber).not.toContain("child_process");
    expect(sumber).not.toContain("podman");
  });

  it("menyimpan ruang latihan lewat helper persistent yang ada", () => {
    // P5 spec. Ruang latihan bukan bukti, dan repo sudah punya helper-nya.
    expect(sumber).toContain("usePersistentValue");
    expect(sumber).toContain("setPersistentValue");
  });

  it("menampilkan status lewat pemetaan, bukan exit code mentah", () => {
    // P4 spec. Kalau UI membandingkan exitCode sendiri, angka 255 dan 137
    // bocor ke peserta.
    expect(sumber).toContain("petakanStatus");
    expect(sumber).not.toMatch(/exitCode\s*===/);
  });
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
npx vitest run src/lib/learning/kode-view.test.ts
```

Expected: FAIL. `/api/jalankan` belum ada di berkas itu.

- [ ] **Step 3: Tambahkan props ke `KodeView`**

Di `src/components/features/learning/kode-view.tsx`, ganti blok tipe props dengan:

```tsx
  kode: string;
  bahasa: BahasaKode;
  /** Pengenal stabil untuk ruang latihan. Pakai `blok.id`. */
  kunci: string;
  /** Titik mulai peserta. Absen berarti sama dengan `kode`. */
  kodeAwal?: string;
  /** Masukan yang dikirim ke program. */
  stdin?: string;
  /**
   * Hanya `true` yang menampilkan tombol Jalankan.
   *
   * Absen berarti `false`, jadi blok yang tandanya tidak menyala tidak punya
   * tombol sama sekali, bukan punya tombol yang menolak.
   */
  dapatJalankan?: boolean;
  editable?: boolean;
  onChange?: (kode: string) => void;
  label?: string;
  className?: string;
```

Dan destructure di awal fungsi:

```tsx
  kode,
  kunci,
  kodeAwal,
  stdin,
  dapatJalankan = false,
  editable = false,
  onChange,
  label = "Kode",
  className,
```

- [ ] **Step 4: Tambahkan state dan pengirim**

Ganti import React di bagian atas:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
```

Tambahkan import berikut:

```tsx
import { setPersistentValue, usePersistentValue } from "@/lib/hooks/use-persistent-state";
import { petakanStatus, type StatusJalankan } from "@/lib/exec/port";
```

Tambahkan blok ini di dalam badan `KodeView`, setelah efek sinkronisasi dokumen:

```tsx
  // Ruang latihan peserta. `localStorage` hanya untuk mencoba, dan tidak pernah
  // menjadi bukti kelayakan apa pun (P5 spec).
  const kunciRuangLatihan = `careevo:kode:${kunci}`;
  const tersimpan = usePersistentValue(kunciRuangLatihan);
  const [menjalankan, setMenjalankan] = useState(false);
  const [hasil, setHasil] = useState<{
    status: StatusJalankan;
    stdout: string;
    stderr: string;
  } | null>(null);

  // Teks yang dijalankan adalah ruang latihan peserta. Bawaan `kodeAwal` adalah
  // `kode`, jadi peserta mulai dari contoh yang sama dengan yang ditulis ahli.
  const teks = tersimpan ?? kodeAwal ?? kode;

  const jalankan = useCallback(async () => {
    setMenjalankan(true);
    setHasil(null);
    try {
      const balasan = await fetch("/api/jalankan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bahasa, kode: teks, stdin, dapatDijalankan: true }),
      });
      const data = (await balasan.json()) as {
        status?: StatusJalankan;
        stdout?: string;
        stderr?: string;
      };
      setHasil({
        status: data.status ?? "galat_runner",
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
      });
      setPersistentValue(kunciRuangLatihan, teks);
    } catch {
      setHasil({ status: "galat_runner", stdout: "", stderr: "" });
    } finally {
      setMenjalankan(false);
    }
  }, [bahasa, teks, stdin, kunciRuangLatihan]);
```

- [ ] **Step 5: Tambahkan tombol dan pane keluaran**

Ganti baris `return` di `KodeView`:

```tsx
  const petakan = hasil ? petakanStatus(hasil.status) : null;

  return (
    <div className={cn("space-y-2", className)}>
      <div ref={wadah} className="kode-view" />

      {dapatJalankan ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={jalankan}
            disabled={menjalankan}
            className="rounded-lg bg-[#0056D2] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {menjalankan ? "Menjalankan…" : "Jalankan"}
          </button>
          <span className="text-[11px] text-gray-500">
            Kompilasi dan dijalankan di server, di kontainer terpisah.
          </span>
        </div>
      ) : null}

      {hasil ? (
        <div className="rounded-lg border border-gray-200 bg-white">
          <p
            className={cn(
              "border-b border-gray-100 px-3 py-1.5 text-xs font-medium",
              hasil.status === "sukses" ? "text-green-700" : "text-red-700",
            )}
          >
            {petakan?.judul}
          </p>
          {petakan?.detail ? (
            <p className="border-b border-gray-100 px-3 py-1.5 text-[11px] text-gray-500">
              {petakan.detail}
            </p>
          ) : null}
          {hasil.status === "gagal_kompilasi" ? (
            <pre className="overflow-x-auto p-3 font-mono text-[12px] whitespace-pre-wrap text-gray-800">
              {hasil.stderr}
            </pre>
          ) : null}
          {hasil.stdout ? (
            <pre className="overflow-x-auto p-3 font-mono text-[12px] whitespace-pre-wrap text-gray-800">
              {hasil.stdout}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
```

`wadah` adalah ref yang sudah ada. `KodeView` kini membungkus `div` itu bersama tombolnya, jadi `className` pindah ke pembungkus.

- [ ] **Step 6: Teruskan props dari `halaman-view.tsx`**

Ganti pemanggilan `KodeView` di `case "kode"` menjadi:

```tsx
          <KodeView
            kunci={blok.id}
            kode={blok.kode ?? ""}
            kodeAwal={blok.kodeAwal}
            stdin={blok.stdin}
            dapatJalankan={blok.dapatDijalankan === true}
            bahasa={blok.bahasa ?? "cpp"}
            label="Kode contoh"
          />
```

- [ ] **Step 7: Perbarui juga pemanggilan di editor admin**

`kunci` adalah prop wajib, jadi pemanggilan di `blok-editor.tsx` yang dibuat plan
blok kode harus ikut menyalakannya. Tanpa langkah ini, `npm run typecheck` merah
karena `blok-editor.tsx` tidak mengoper `kunci`.

Di `src/components/features/admin/courses/blok-editor.tsx`, pada `case "kode"`
di dalam `IsiBlok`, tambahkan satu baris:

```tsx
          <KodeView
            kunci={blok.id}
            kode={blok.kode ?? ""}
            bahasa={blok.bahasa ?? "cpp"}
            editable
            label={`Kode contoh ${blok.id}`}
            onChange={(berikut) => onChange({ ...blok, kode: berikut })}
          />
```

- [ ] **Step 8: Jalankan test, `typecheck`, dan `build`**

```bash
npx vitest run src/lib/learning/kode-view.test.ts && npm run typecheck && npm run build
```

Expected: semuanya hijau.

- [ ] **Step 9: Commit**

```bash
npm run check
git add src/components/features/learning/kode-view.tsx \
  src/components/features/learning/halaman-view.tsx \
  src/components/features/admin/courses/blok-editor.tsx \
  src/lib/learning/kode-view.test.ts
git commit -m "feat(learning): tombol Jalankan, pane keluaran, dan ruang latihan"
```

---

### Task 7: Verifikasi di peramban

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: seluruh Task 1 sampai Task 6
- Produces: bukti peramban, dan dokumentasi runner di `AGENTS.md`

- [ ] **Step 1: Nyalakan ketiga proses**

```bash
export CAREEVO_RUNNER_SECRET="uji-lokal-uji-lokal"
node src/lib/exec/runner/server.mjs &
npm run dev
```

- [ ] **Step 2: Buktikan tombol Jalankan**

Di peramban, buka halaman yang punya blok `kode` dengan `dapatDijalankan` menyala.

1. Tombol **Jalankan** tampil.
2. Klik sekali. Butuh sekitar 1,5 detik, lalu pane keluaran muncul dengan `Halo, Budi!`.
3. Klik lagi. Outlet harus terisi.
4. Muat ulang halaman. Kode di ruang latihan harus sama seperti sebelum muat ulang. Ini bukti `usePersistentValue` bekerja.

- [ ] **Step 3: B probativekan blok tanpa izin**

Buka blok yang `dapatDijalankan`-nya tidak menyala.

1. **Tidak ada tombol Jalankan.** Bukan tombol yang menolak saat diklik.
2. Pengejalan `POST /api/jalankan` langsung dari konsol browser harus ditolak `400`:

```js
await fetch("/api/jalankan", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ bahasa: "cpp", kode: "int main(){}", dapatDijalankan: false }),
}).then((r) => r.status);
```

Expected: `400`. Ini yang membuat sakelar ahli ditegakkan server, bukan hanya disembunyikan.

- [ ] **Step 4: Buktikan batas di UI**

Jalankan program yang melampaui batas, lalu periksa apa yang tertulis:

1. `for(;;){}` menampilkan "Program dihentikan karena berjalan terlalu lama." dan "Batas layanan adalah 10 detik per percobaan."
2. **Tidak ada angka 255 atau 137 di layar.** Ini bukti P4.
3. Fork bomb menampilkan "Program dihentikan karena membuat terlalu banyak proses."

- [ ] **Step 5: Buktikan galat kompilasi tetap terbaca**

Tempel kode yang salah sintaks, lalu klik Jalankan.

Expected: pane menampilkan pesan GCC dengan nomor baris dan penanda, persis seperti yang diukur di spec bagian "Bukti terukur".

- [ ] **Step 6: Ambil tangkapan layar dan commit bukti**

Simpan tangkapan layar ke `docs/kode-verify/`, lalu:

```bash
git add docs/kode-verify
git commit -m "docs(verify): bukti tombol Jalankan dan pane keluaran"
```

- [ ] **Step 7: Catat runner di `AGENTS.md`**

Tambahkan runner ke tabel port di bagian "Leave the whole stack running" pada `AGENTS.md`, lalu tambahkan satu paragraf yang menyatakan tiga hal. Runner adalah proses ketiga yang harus hidup, di samping Next dan AI Mastery. Ia hanya mendengarkan di loopback, jadi browser tidak dapat menjangkauanya. Dan ia tidak ada di produksi M0, karena ADR 0001 menyatakan API VPS belum dapat dijangkau browser.

- [ ] **Step 8: `check` terakhir dan commit**

```bash
npm run check
git add AGENTS.md
git commit -m "docs: catat runner C++ sebagai proses yang harus hidup"
```

---

## Hasil akhir

Setelah plan ini, di mesin lokal:

- Peserta menekan Jalankan, dan programnya dikompilasi serta dijalankan di kontainer terisolasi.
- Galat kompilasi tampil utuh dengan nomor baris, bukan ringkasan.
- Batas layanan tampil sebagai kalimat, dan angka exit mentah tidak pernah terlihat.
- Blok tanpa izin ahli tidak punya tombol, dan permintaannya ditolak di server.
- `npm run check`, `npm run build`, dan `npm test` hijau. `npm test` hijau tanpa podman.

Yang tetap belum ada, dan memang non-tujuan: penilaian kode otomatis, proyek multi-berkas, bahasa selain C++, dan rumah produksi untuk runner.

## Mutasi yang harus merah

Tiga mutasi sudah tertutup di plan blok kode. Yang berikut ditutup di plan ini.

| # | Mutasi | Ditutup di |
|---|---|---|
| 1 | Hapus `--network=none` | Task 3, `sandbox.test.ts` |
| 2 | Hapus `--pids-limit=` | Task 3, `sandbox.test.ts` |
| 3 | Hapus `--memory=` | Task 3, `sandbox.test.ts` |
| 4 | Hapus `--read-only` | Task 3, `sandbox.test.ts` |
| 5 | Ubah `--user=65534:65534` menjadi root | Task 3, `sandbox.test.ts` |
| 6 | Ubah bind runner ke `0.0.0.0` | Task 4, langkah manual. Belum ada test otomatis |
| 7 | Hapus perbandingan `CAREEVO_RUNNER_SECRET` | Task 4, langkah manual dan Task 5, test ketiga |
| 8 | Hapus `originDiizinkan` dari route | Task 5, langkah manual |
| 9 | Hapus `getSession` dari route | Task 5, langkah 7 |
| 10 | Hapus gerbang `dapatDijalankan` | Task 6, langkah 3 |
| 13 | Hilangkan pemetaan status sehingga exit mentah bocor | Task 1, test kedua |
| 15 | Ubah bawaan `kodeAwal` dari `kode` jadi string kosong | Task 6, langkah 4 |

Mutasi nomor 6, 8, dan 9 hanya dijaga langkah manual, bukan test otomatis. Itu
batas yang jujur dari plan ini. `server.mjs` berada di luar `tsconfig.json` dan
di luar `vitest`, jadi tidak ada tempat alami untuk mengujinya. Menutupnya secara
otomatis berarti menulis test statis atas `server.mjs`, dan test statis seperti
itu tidak bisa membuktikan port mana yang benar-benar terikat.
