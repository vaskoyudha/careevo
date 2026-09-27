# Blok Kode C++ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambah tipe blok `kode` ke halaman berformat, beserta satu komponen CodeMirror yang dipakai bersama untuk membaca (peserta) dan menyunting (ahli).

**Architecture:** `kode` adalah tipe blok ke-enam, dan ia tidak butuh infrastruktur apa pun. Penyimpanan ikut `data/courses.json` lewat store halaman yang sudah ada, tanpa tabel baru dan tanpa migrasi. Satu komponen `KodeView` punya dua mode lewat sifat `editable`, jadi hanya ada satu highlighter dan kode yang dilihat peserta identik dengan yang akan dikompilasi (P1 spec). Plan ini sengaja berhenti sebelum eksekusi.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (`strict: true`), Tailwind v4 CSS-first, CodeMirror 6, Vitest 5 (env `node`, tanpa jsdom).

**Spec:** `docs/superpowers/specs/2026-09-27-editor-kode-cpp-design.md`

> **Plan kembar:** eksekusi kode ada di `docs/superpowers/plans/2026-09-27-runner-kode-cpp.md`. Plan itu bergantung pada `KodeView` dari plan ini. Plan ini tidak memerlukan podman maupun g++.

## Global Constraints

- **Copy berbahasa Indonesia.** Aturan biznis berbahasa Indonesia, infra dan UI berbahasa Inggris.
- **`npm test` harus tetap hijau tanpa podman dan tanpa g++.** Tidak ada integrasi kontainer di `vitest.config.mts`.
- **`vitest.integration.config.mts` tidak boleh dilebarkan.** Glob `src/**/*.integration.test.ts` adalah kontrak yang didokumentasikan.
- **Env `node` tanpa jsdom.** Tidak ada berkas `.test.tsx` dan tidak ada `document` atau `window` di jalur test. Komponen React diuji dengan **assertion statis atas berkas sumber**, memakai pola yang sama dengan `src/lib/learning/security.test.ts`.
- **Tidak ada `dangerouslySetInnerHTML` di mana pun.** Repo tidak punya sanitizer, dan kode adalah teks polos (P6 spec).
- **`npm run build` adalah gerbang** untuk pelanggaran impor server-only. `npm run check` bukan.
- **Modul klien harus tetap murni.** `src/lib/courses/{kurikulum,blok,halaman,kuis}.ts` ikut bundel klien. Satu impor `node:fs` menjatuhkan build Turbopack produksi.
- **Test tidak boleh menulis ke `data/` atau `.data/`** milik repo.
- **Jangan push** ke remote tanpa izin eksplisit pengguna.
- **Bawaan `dapatDijalankan` yang `undefined` berarti `false`** (fail-closed).
- **Jalankan `npm run check` sebelum setiap commit** yang menutup satu task, dan `npm run build` setelah task yang menambah dependensi.

## Peta File

**Create:**
- `src/components/features/learning/kode-view.tsx` — satu komponen CodeMirror dengan sifat `editable` yang bisa diubah. Dipakai renderer peserta dan editor admin.
- `src/lib/learning/kode-view.test.ts` — assertion statis atas `kode-view.tsx`.
- `src/lib/validation/blok.test.ts` — skema zod blok termasuk varian `kode`. Modul ini belum punya test sama sekali.

**Modify:**
- `package.json` — empat dependensi CodeMirror.
- `src/types/course.ts` — `TipeBlok` plus `kode`, tipe `BahasaKode`, dan enam field opsional di `BlokHalaman`.
- `src/lib/validation/blok.ts` — `TIPE_BLOK` plus `kode`, varian zod `kode`, batas panjang.
- `src/lib/courses/blok.ts` — `blokBerisi`, `ringkasBlok`, dan `blokKosong` menangani `kode`.
- `src/lib/courses/halaman.ts` — `jumlahKata` melewati `kode` secara eksplisit.
- `src/components/features/learning/halaman-view.tsx` — `case "kode"` dan tombol Salin.
- `src/components/features/admin/courses/blok-editor.tsx` — `LABEL_TIPE`, `TIPE_BISA_DITAMBAH`, dan `case "kode"`.
- `src/app/globals.css` — blok tema `.kode-view`.
- `src/lib/courses/blok.test.ts` — perluasan tiga describe yang sudah ada.
- `src/lib/courses/halaman.test.ts` — `jumlahKata` melewati `kode`.

> **Gotcha dependensi, sudah diverifikasi.** Meta-paket `codemirror` **tidak** mengekspor `Compartment`, `EditorState`, atau `autocompletion`. Yang diekspor hanya `EditorView`, `basicSetup`, dan `minimalSetup`. Karena itu plan ini memasang paket secara eksplisit dan mengimpor dari masing-masing. Jangan "menyederhanakan" ini ke meta-paket, karena `Compartment` dan `EditorState` akan hilang dan `typecheck` merah.

---

### Task 1: Tipe, validasi, dan helper murni

Tanpa UI. Setelah task ini, `kode` bisa disimpan dan dibaca, tapi belum ada yang merendernya.

**Files:**
- Modify: `src/types/course.ts`, `src/lib/validation/blok.ts`, `src/lib/courses/blok.ts`, `src/lib/courses/halaman.ts`
- Test: `src/lib/validation/blok.test.ts` (create), `src/lib/courses/blok.test.ts`, `src/lib/courses/halaman.test.ts`

**Interfaces:**
- Consumes: tidak ada.
- Produces:
  - `type BahasaKode = "cpp"` dari `@/types/course`
  - `TipeBlok` berisi enam nilai
  - `BlokHalaman` punya opsional `kode`, `bahasa`, `kodeAwal`, `stdin`, `outputHarapan`, `dapatDijalankan`
  - `blokSchema` menerima `tipe: "kode"`
  - `MAKS_KODE_KARAKTER`, `MAKS_STDIN_KARAKTER`, `MAKS_OUTPUT_HARAPAN_KARAKTER` dari `@/lib/validation/blok`

- [ ] **Step 1: Tulis test yang gagal untuk skema zod**

Buat `src/lib/validation/blok.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  blokSchema,
  TIPE_BLOK,
  MAKS_KODE_KARAKTER,
  MAKS_STDIN_KARAKTER,
  MAKS_OUTPUT_HARAPAN_KARAKTER,
} from "./blok";

/** Blok kode valid tanpa field opsional lain. */
function kode(atas: Record<string, unknown> = {}) {
  return { id: "blk-1", tipe: "kode", bahasa: "cpp", kode: "int main(){}", ...atas };
}

describe("TIPE_BLOK", () => {
  it("memuat kode sebagai tipe keenam", () => {
    expect(TIPE_BLOK).toContain("kode");
    expect(TIPE_BLOK).toHaveLength(6);
  });
});

describe("blokSchema varian kode", () => {
  it("menerima blok kode dengan bahasa cpp", () => {
    expect(blokSchema.safeParse(kode()).success).toBe(true);
  });

  it("memberi id kosong saat tidak dikirim, supaya store yang mengisinya", () => {
    const hasil = blokSchema.parse({ tipe: "kode", bahasa: "cpp", kode: "int main(){}" });
    expect(hasil.id).toBe("");
  });

  it("menolak bahasa di luar union tertutup", () => {
    // `bahasa` masuk ke pemilihan image kontainer. String bebas membuat
    // image bisa dipilih dari mana saja.
    expect(blokSchema.safeParse(kode({ bahasa: "python" })).success).toBe(false);
  });

  it("menolak bahasa yang hilang", () => {
    expect(
      blokSchema.safeParse({ id: "blk-1", tipe: "kode", kode: "int main(){}" }).success,
    ).toBe(false);
  });

  it("membuang field tak dikenal, jadi kiriman tidak bisa menyelip", () => {
    const hasil = blokSchema.parse(kode({ nyusup: "hai" }));
    expect("nyusup" in hasil).toBe(false);
  });

  it("membuang segmen, supaya renderer tidak bisa menampilkan prosa di blok kode", () => {
    // `segmen` milik paragraf. Kalau tidak dibuang, ia tersimpan dan
    // `jumlahKata` bisa menghitungnya sebagai kata baca.
    const hasil = blokSchema.parse(kode({ segmen: [{ teks: "halo" }] }));
    expect("segmen" in hasil).toBe(false);
  });

  it("membatasi panjang kode", () => {
    expect(blokSchema.safeParse(kode({ kode: "a".repeat(MAKS_KODE_KARAKTER + 1) })).success).toBe(
      false,
    );
  });

  it("membatasi panjang stdin", () => {
    expect(
      blokSchema.safeParse(kode({ stdin: "a".repeat(MAKS_STDIN_KARAKTER + 1) })).success,
    ).toBe(false);
  });

  it("membatasi panjang keluaran yang diharapkan", () => {
    expect(
      blokSchema.safeParse(
        kode({ outputHarapan: "a".repeat(MAKS_OUTPUT_HARAPAN_KARAKTER + 1) }),
      ).success,
    ).toBe(false);
  });

  it("menerima stdin, keluaran harapan, dan sakelar boleh jalan", () => {
    expect(
      blokSchema.safeParse(
        kode({ stdin: "Budi", outputHarapan: "Halo, Budi!", dapatDijalankan: true }),
      ).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
npx vitest run src/lib/validation/blok.test.ts
```

Expected: FAIL. `MAKS_KODE_KARAKTER` belum diekspor, jadi ini gagal di import.

- [ ] **Step 3: Tambahkan tipe ke `src/types/course.ts`**

Ganti baris 54:

```ts
export type TipeBlok =
  | "paragraf"
  | "heading"
  | "daftar"
  | "kutipan"
  | "gambar"
  | "kode";
```

Tambahkan tipe ini tepat setelah `TipeBlok`:

```ts
/**
 * Bahasa yang bisa dikompilasi runner.
 *
 * Union tertutup, bukan string bebas. `bahasa` memilih image kontainer, dan
 * string bebas berarti image bisa dipilih dari mana saja. Menambah bahasa
 * berarti mengganti image dan menguji ulang seluruh batas sandbox.
 */
export type BahasaKode = "cpp";
```

Lalu tambahkan enam field berikut ke dalam `interface BlokHalaman`, setelah `alt?: string;`:

```ts
  /** Isi kode polos, yaitu sumber yang akan dikompilasi. */
  kode?: string;
  /** Bahasa kode. */
  bahasa?: BahasaKode;
  /** Titik mulai peserta di ruang latihan. Absen berarti sama dengan `kode`. */
  kodeAwal?: string;
  /** Masukan latihan yang dikirim ke program. */
  stdin?: string;
  /** Keluaran yang diharapkan, ditampilkan sebagai pane terpisah. */
  outputHarapan?: string;
  /**
   * Sakelar mati milik ahli: blok ini tampil tapi tanpa tombol Jalankan.
   *
   * `undefined` berarti tidak boleh dijalankan (fail-closed), sehingga blok
   * yang tidak pernah disentuh ahli tidak diam-diam dapat dieksekusi.
   */
  dapatDijalankan?: boolean;
```

- [ ] **Step 4: Tambahkan validasi ke `src/lib/validation/blok.ts`**

Setelah `const MAKS_SEGMEN_PER_BARIS = 50;` tambahkan:

```ts
/**
 * Batas panjang di lapisan transport (zod).
 *
 * Batas jumlah baris dan batas waktu ditegakkan runner, karena hanya runner
 * yang tahu apa yang sudah dijalankan. Angka di sini hanya menahan kiriman
 * besar sebelum mencapai proses. Pembagian ini disengaja: satu lapisan
 * tidak menghitung ulang apa yang sudah ditegakkan lapisan lain.
 */
export const MAKS_KODE_KARAKTER = 200_000;
export const MAKS_STDIN_KARAKTER = 8_192;
export const MAKS_OUTPUT_HARAPAN_KARAKTER = 8_192;
```

Ganti baris 57:

```ts
export const TIPE_BLOK = ["paragraf", "heading", "daftar", "kutipan", "gambar", "kode"] as const;
```

Tambahkan varian ini ke ujung `z.discriminatedUnion`, setelah objek `gambar`:

```ts
  z.object({
    id: idSchema,
    tipe: z.literal("kode"),
    bahasa: z.enum(["cpp"]),
    kode: z
      .string()
      .max(MAKS_KODE_KARAKTER, `Kode maksimal ${MAKS_KODE_KARAKTER} karakter`),
    kodeAwal: z
      .string()
      .max(MAKS_KODE_KARAKTER, `Kode awal maksimal ${MAKS_KODE_KARAKTER} karakter`)
      .optional(),
    stdin: z
      .string()
      .max(MAKS_STDIN_KARAKTER, `Masukan maksimal ${MAKS_STDIN_KARAKTER} karakter`)
      .optional(),
    outputHarapan: z
      .string()
      .max(
        MAKS_OUTPUT_HARAPAN_KARAKTER,
        `Keluaran yang diharapkan maksimal ${MAKS_OUTPUT_HARAPAN_KARAKTER} karakter`,
      )
      .optional(),
    dapatDijalankan: z.boolean().optional(),
  }),
```

Objek `kode` sengaja tidak mendeklarasikan `segmen`, `butir`, `src`, atau `alt`. `z.object` membuang kunci tak dikenal, jadi `segmen` yang diselundupkan tidak pernah sampai ke renderer.

- [ ] **Step 5: Perbarui helper murni di `src/lib/courses/blok.ts`**

Di `blokBerisi`, tambahkan cabang sebelum `case "daftar"`:

```ts
    case "kode":
      return (blok.kode ?? "").trim().length > 0;
```

Di `ringkasBlok`, tambahkan cabang `else if` setelah cabang `gambar`:

```ts
  } else if (blok.tipe === "kode") {
    teks = (blok.kode ?? "").split("\n")[0] ?? "";
  }
```

Di `blokKosong`, tambahkan case sebelum `case "gambar"`:

```ts
    case "kode":
      // `dapatDijalankan` sengaja false: blok baru tidak dapat dieksekusi
      // sampai ahli menyalakannya secara eksplisit.
      return { id, tipe, bahasa: "cpp", kode: "", dapatDijalankan: false };
```

`rangkumBacklink` tidak perlu diubah. Untuk `kode` ia sudah menghitung satu baris kosong, jadi tidak ada tautan yang dipindai.

- [ ] **Step 6: Perbarui `jumlahKata` di `src/lib/courses/halaman.ts`**

Ganti cabang `else if` yang ada:

```ts
      } else if (blok.tipe !== "gambar" && blok.tipe !== "kode") {
```

Perilaku ini sebenarnya sudah benar sebelumnya, karena `segmenKeTeks(undefined)` mengembalikan string kosong. Sekarang dinyatakan eksplisit supaya niatnya terlihat dan terkunci test.

- [ ] **Step 7: Tambahkan test helper di `src/lib/courses/blok.test.ts`**

Tambahkan helper ini di bawah helper `paragraf` yang sudah ada:

```ts
function kode(id: string, isi: string): BlokHalaman {
  return { id, tipe: "kode", bahasa: "cpp", kode: isi };
}
```

Tambahkan test di dalam `describe("blokBerisi")`:

```ts
  it("blok kode kosong tidak berisi, yang berkode isi berisi", () => {
    expect(blokBerisi(kode("b1", "   "))).toBe(false);
    expect(blokBerisi(kode("b2", "int main(){}"))).toBe(true);
  });
```

Tambahkan test di dalam `describe("ringkasBlok")`:

```ts
  it("blok kode diringkas ke baris pertamanya", () => {
    expect(ringkasBlok(kode("b1", "#include <iostream>\nint main(){}"))).toBe(
      "#include <iostream>",
    );
  });
```

Tambahkan test di dalam `describe("blokKosong")`:

```ts
  it("blok kode baru tidak dapat dijalankan sampai ahli menyalakannya", () => {
    // Fail-closed: bawaan harus menolak eksekusi, bukan mengizinkan.
    expect(blokKosong("kode")).toEqual({
      id: "",
      tipe: "kode",
      bahasa: "cpp",
      kode: "",
      dapatDijalankan: false,
    });
  });
```

- [ ] **Step 8: Tambahkan test `jumlahKata` di `src/lib/courses/halaman.test.ts`**

Tambahkan di dalam `describe("jumlahKata")`:

```ts
  it("tidak menghitung isi kode sebagai kata baca", () => {
    const h: Halaman = {
      id: "hal-1",
      modul_id: "m1",
      course_id: "c1",
      judul: "Kode",
      urutan: 1,
      blok: [{ id: "blk-1", tipe: "kode", bahasa: "cpp", kode: "int main(){ return 0; }" }],
      created_at: "2026-09-27T00:00:00.000Z",
      updated_at: "2026-09-27T00:00:00.000Z",
    };
    expect(jumlahKata({ halaman: [h] })).toBe(0);
  });
```

Kalau `Halaman` belum diimpor di berkas itu, tambahkan ke baris import dari `@/types/course`.

- [ ] **Step 9: Jalankan test, pastikan hijau**

```bash
npx vitest run src/lib/validation/blok.test.ts src/lib/courses/blok.test.ts src/lib/courses/halaman.test.ts
```

Expected: PASS.

- [ ] **Step 10: Jalankan `typecheck` dan baca hasilnya**

```bash
npm run typecheck
```

Expected: **MERAH** pada `halaman-view.tsx` dan `blok-editor.tsx`. Ini yang diharapkan, karena `switch (blok.tipe)` tanpa `default` wajib exhaustif.

Baca output dan pastikan tidak ada error di luar dua berkas itu. Kalau ada, perbaiki dan sebut di commit.

- [ ] **Step 11: Commit**

```bash
git add src/types/course.ts src/lib/validation/blok.ts src/lib/validation/blok.test.ts \
  src/lib/courses/blok.ts src/lib/courses/blok.test.ts \
  src/lib/courses/halaman.ts src/lib/courses/halaman.test.ts
git commit -m "feat(courses): tipe blok kode beserta validasi dan helper murni"
```

---

### Task 2: Komponen `KodeView`

Ini inti P1: satu komponen, satu highlighter, dua mode.

**Files:**
- Create: `src/components/features/learning/kode-view.tsx`, `src/lib/learning/kode-view.test.ts`
- Modify: `package.json`, `src/app/globals.css`

**Interfaces:**
- Consumes: `BahasaKode` dari `@/types/course`
- Produces:
  ```ts
  export function KodeView(props: {
    kode: string;
    bahasa: BahasaKode;
    editable?: boolean;
    onChange?: (kode: string) => void;
    label?: string;
    className?: string;
  }): JSX.Element
  ```
  Komponen klien. `EditorView` hanya dibangun di dalam `useEffect`, jadi tidak pernah menyentuh DOM saat server merender.

- [ ] **Step 1: Pasang dependensi**

```bash
npm install @codemirror/state@^6.7.6 @codemirror/view@^6.43.13 \
  @codemirror/commands @codemirror/lang-cpp@^6.0.3
```

- [ ] **Step 2: Tulis assertion statis yang gagal**

Buat `src/lib/learning/kode-view.test.ts`. Env test adalah `node` tanpa jsdom, jadi komponen tidak bisa dirender. Yang diuji adalah kontrak yang harus dipatuhi berkas sumber, memakai pola yang sama dengan `src/lib/learning/security.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sumber = readFileSync(
  fileURLToPath(new URL("../../components/features/learning/kode-view.tsx", import.meta.url)),
  "utf8",
);

describe("KodeView sebagai berkas sumber", () => {
  it("memakai CodeMirror dengan tata bahasa C++, bukan textarea", () => {
    // P1 spec: satu highlighter untuk baca dan tulis. Kalau jalur baca memakai
    // highlighter lain, peserta belajar dari kode yang tidak sama dengan yang
    // dia jalankan.
    expect(sumber).toContain('from "@codemirror/view"');
    expect(sumber).toContain('from "@codemirror/lang-cpp"');
    expect(sumber).not.toContain("<textarea");
  });

  it("tidak memakai dangerouslySetInnerHTML", () => {
    expect(sumber).not.toContain("dangerouslySetInnerHTML");
  });

  it("membangun EditorView di dalam useEffect, bukan saat render", () => {
    // CodeMirror mengukur DOM saat dibangun. Membangunnya saat render berarti
    // menjalankannya saat server merender, dan itu menjatuhkan build.
    expect(sumber.indexOf("new EditorView(")).toBeGreaterThan(sumber.indexOf("useEffect"));
  });

  it("menghancurkan tampilan saat unmount", () => {
    // Tanpa destroy, setiap buka halaman menambah satu EditorView yang terus
    // memegang listener.
    expect(sumber).toContain("view.destroy()");
  });

  it("menyertakan label aksesibel pada area edit", () => {
    expect(sumber).toContain("contentAttributes");
    expect(sumber).toContain("aria-label");
  });

  it("tidak memakai pelengkapan otomatis", () => {
    // Autocomplete adalah non-tujuan spec. Memakainya menambah bobot bundel
    // tanpa diminta, jadi absennya harus terkunci test.
    expect(sumber).not.toContain("@codemirror/autocomplete");
    expect(sumber).not.toContain("autocompletion");
  });
});
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

```bash
npx vitest run src/lib/learning/kode-view.test.ts
```

Expected: FAIL. `kode-view.tsx` belum ada, jadi `ENOENT`.

- [ ] **Step 4: Tulis `kode-view.tsx`**

Buat `src/components/features/learning/kode-view.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { cpp } from "@codemirror/lang-cpp";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { cn } from "@/lib/utils";
import type { BahasaKode } from "@/types/course";

/**
 * Satu komponen editor kode untuk baca dan tulis.
 *
 * **Kenapa satu komponen, bukan dua** (P1 spec). Kalau jalur baca memakai satu
 * highlighter dan jalur tulis memakai yang lain, keduanya pasti menyimpang, dan
 * peserta belajar dari kode yang tidak sama dengan yang dia jalankan. Sifat
 * `editable` hanya mengubah hak akses; gramatarnya sama.
 *
 * **Kenapa dibangun di dalam `useEffect`.** CodeMirror mengukur DOM saat
 * `EditorView` dibuat. Membangunnya saat render berarti menjalankannya saat
 * server merender, dan itu menjatuhkan build.
 *
 * Berkas ini tidak boleh mengimpor modul server. Ia dipanggil dari
 * `halaman-view.tsx` dan `blok-editor.tsx`, keduanya klien.
 */

/**
 * Tema gelap memakai palet ocean yang sudah ada di repo, bukan paket tema
 * tambahan.
 *
 * Permukaan kode sengaja gelap di dalam halaman yang terang. Kontras itu
 * adalah pemisahan visual antara "ini yang saya baca" dan "ini yang saya
 * jalankan". Warnanya diambil dari `.code-editor` di `globals.css` supaya tidak
 * lahir warna keempat untuk kode.
 */
const TEMA = EditorView.theme(
  {
    "&": { backgroundColor: "#06202f", color: "#d7eef7", fontSize: "13px" },
    ".cm-content": {
      fontFamily: "var(--font-mono)",
      caretColor: "#d7eef7",
      padding: "12px 0",
    },
    ".cm-gutters": { backgroundColor: "#06202f", color: "#5b7f92", border: "none" },
    ".cm-activeLine": { backgroundColor: "#0a2a3a" },
    ".cm-activeLineGutter": { backgroundColor: "#0a2a3a", color: "#d7eef7" },
    ".cm-cursor": { borderLeftColor: "#d7eef7" },
    "&.cm-focused": { outline: "none" },
  },
  { dark: true },
);

export function KodeView({
  kode,
  editable = false,
  onChange,
  label = "Kode",
  className,
}: {
  kode: string;
  bahasa: BahasaKode;
  editable?: boolean;
  onChange?: (kode: string) => void;
  label?: string;
  className?: string;
}) {
  const wadah = useRef<HTMLDivElement>(null);
  const tampilan = useRef<EditorView | null>(null);
  const sifatRef = useRef(new Compartment());

  // `onChange` lahir ulang setiap render. Menyimpannya di ref membuat efek
  // pembuatan tampilan tidak bergantung padanya, sehingga editor tidak dibangun
  // ulang setiap kali peserta mengetik.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Efek pembuatan. Deklarasikan lebih dulu supaya `tampilan.current` sudah
  // terisi ketika efek `editable` di bawah berjalan pada render yang sama.
  useEffect(() => {
    const elemen = wadah.current;
    if (!elemen) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: kode,
        extensions: [
          cpp(),
          TEMA,
          lineNumbers(),
          EditorView.lineWrapping,
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          history(),
          sifatRef.current.of(sifat(editable)),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((perubahan) => {
            if (!perubahan.docChanged) return;
            onChangeRef.current?.(perubahan.state.doc.toString());
          }),
        ],
      }),
      parent: elemen,
    });
    tampilan.current = view;

    return () => {
      view.destroy();
      tampilan.current = null;
    };
    // Sekali saja. `editable` dan `kode` disinkronkan lewat efek terpisah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sifat baca dan tulis bisa berubah tanpa membangun ulang tampilan.
  useEffect(() => {
    const view = tampilan.current;
    if (!view) return;
    view.dispatch({ effects: sifatRef.current.reconfigure(sifat(editable)) });
  }, [editable]);

  // Dokumen bisa diubah dari luar, misalnya saat kode awal baru dimuat.
  // Perbandingan mencegah efek ini melawan pengetikan peserta.
  useEffect(() => {
    const view = tampilan.current;
    if (!view) return;
    const sekarang = view.state.doc.toString();
    if (sekarang === kode) return;
    view.dispatch({ changes: { from: 0, to: sekarang.length, insert: kode } });
  }, [kode]);

  return <div ref={wadah} className={cn("kode-view", className)} />;
}

/** Ekstensi yang berubah antara mode baca dan mode tulis. */
function sifat(editable: boolean) {
  return [EditorState.readOnly.of(!editable), EditorView.editable.of(editable)];
}
```

> Properti `bahasa` ada di tipe props agar pemanggil jelas, tetapi tidak dipakai di dalam komponen. Tata bahasa C++ sudah tetap di `cpp()`. Kalau nanti ada bahasa lain, barulah `bahasa` dipakai untuk memilih gramatika.

- [ ] **Step 5: Tambahkan CSS `.kode-view`**

Buka `src/app/globals.css` dan tambahkan setelah blok `.code-editor`:

```css
/* Permukaan kode pada blok halaman. Tinggi minimum pendek supaya satu blok
   kode tidak mengambil seluruh layar; tinggi sebenarnya mengikuti isi.
   Warna disamakan dengan `.code-editor` di atas supaya tidak lahir warna
   keempat untuk kode. */
.kode-view {
  min-height: 120px;
  max-height: 60vh;
  overflow: auto;
  background: #06202f;
  color: #d7eef7;
}
```

- [ ] **Step 6: Jalankan test, pastikan hijau**

```bash
npx vitest run src/lib/learning/kode-view.test.ts
```

Expected: PASS, enam test.

- [ ] **Step 7: Jalankan `typecheck` dan `build`**

```bash
npm run typecheck
npm run build
```

`build` wajib hijau di sini. Inilah gerbang yang menangkap impor server-only yang salah, dan `KodeView` adalah komponen klien baru yang menyentuh DOM.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/app/globals.css \
  src/components/features/learning/kode-view.tsx \
  src/lib/learning/kode-view.test.ts
git commit -m "feat(learning): KodeView CodeMirror satu komponen dua mode"
```

---

### Task 3: Render `kode` untuk peserta

**Files:**
- Modify: `src/components/features/learning/halaman-view.tsx`

**Interfaces:**
- Consumes: `KodeView` dari Task 2
- Produces: `case "kode"` di `BlokView`. Tidak ada ekspor baru.

- [ ] **Step 1: Catat baseline**

```bash
npm run typecheck 2>&1 | grep -c "halaman-view"
```

Expected: minimal 1. Ini switch exhaustif yang masih menolak `kode`. Kalau hasilnya 0, Task 1 belum tuntas.

- [ ] **Step 2: Tambahkan import**

Di `halaman-view.tsx`, tambahkan ke blok import yang sudah ada:

```tsx
import { KodeView } from "./kode-view";
```

- [ ] **Step 3: Tambahkan komponen salin**

Tambahkan komponen ini di bawah `BlokView`:

```tsx
/**
 * Salin kode ke papan klip.
 *
 * Kegagalan papan klip diabaikan dengan sengaja. Menyalin adalah kenyamanan,
 * dan kegagalan tidak boleh membuat halaman gagal gara-gara izin atau konteks
 * yang tidak aman. Karena itu tombolnya kembali ke keadaan semula sendiri
 * setelah dua detik, dengan atau tanpa pesan.
 */
function TombolSalin({ teks }: { teks: string }) {
  const [salin, setSalin] = useState<"idle" | "ok" | "gagal">("idle");

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(teks);
          setSalin("ok");
        } catch {
          setSalin("gagal");
        }
        setTimeout(() => setSalin("idle"), 2000);
      }}
      className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-gray-500 hover:text-[#0056D2]"
    >
      {salin === "ok" ? "Tersalin" : salin === "gagal" ? "Gagal" : "Salin"}
    </button>
  );
}
```

`useState` sudah diimpor di berkas ini, jadi tidak ada import tambahan.

- [ ] **Step 4: Tambahkan `case "kode"`**

Di dalam `switch (blok.tipe)` pada `BlokView`, tambahkan sebelum `case "gambar"`:

```tsx
    case "kode":
      return (
        <figure className="overflow-hidden rounded-xl border border-gray-200">
          <figcaption className="flex items-center justify-between gap-2 border-b border-gray-200 bg-[#f5f7fa] px-3 py-1.5">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              {blok.bahasa === "cpp" ? "C++" : blok.bahasa}
            </span>
            <TombolSalin teks={blok.kode ?? ""} />
          </figcaption>
          <KodeView kode={blok.kode ?? ""} bahasa={blok.bahasa ?? "cpp"} label="Kode contoh" />
          {blok.outputHarapan ? (
            <div className="border-t border-gray-200 bg-white px-3 py-2">
              <p className="mb-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Keluaran yang diharapkan
              </p>
              <pre className="overflow-x-auto font-mono text-[13px] whitespace-pre-wrap text-gray-700">
                {blok.outputHarapan}
              </pre>
            </div>
          ) : null}
        </figure>
      );
```

`KodeView` tidak diberi `editable`, jadi mode baca. Tombol Jalankan belum ada; itu Task 6 di plan runner.

- [ ] **Step 5: Catat apa yang masih merah**

```bash
npm run typecheck 2>&1 | grep -E "halaman-view|blok-editor"
```

Expected: `halaman-view.tsx` sudah bersih, `blok-editor.tsx` masih merah karena Task 4 belum selesai. Jangan commit sebelum Task 4, karena `npm run check` menjalankan `typecheck`.

- [ ] **Step 6: Commit setelah Task 4 hijau**

Lakukan commit ini bersama Task 4:

```bash
git add src/components/features/learning/halaman-view.tsx
```

---

### Task 4: Blok `kode` di editor admin

Ahli harus bisa menulis contoh. Tanpa task ini, plan ini tidak menghasilkan produk yang bisa dipakai.

**Files:**
- Modify: `src/components/features/admin/courses/blok-editor.tsx`

**Interfaces:**
- Consumes: `KodeView` dari Task 2
- Produces: `kode` bisa dipilih dari menu tambah blok dan disunting penuh, termasuk sakelar boleh jalan.

- [ ] **Step 1: Tambahkan label dan keikutsertaan tipe**

Pada `LABEL_TIPE` di `blok-editor.tsx`, tambahkan entri:

```ts
  kode: "Kode",
```

Ganti `TIPE_BISA_DITAMBAH` dengan:

```ts
const TIPE_BISA_DITAMBAH: TipeBlok[] = [
  "paragraf",
  "heading",
  "daftar",
  "kutipan",
  "gambar",
  "kode",
];
```

`LABEL_TIPE` bertipe `Record<TipeBlok, string>`, jadi `typecheck` memaksa entri ini ada.

- [ ] **Step 2: Tambahkan import**

```tsx
import { KodeView } from "@/components/features/learning/kode-view";
```

- [ ] **Step 3: Tambahkan `case "kode"`**

Di dalam `switch (blok.tipe)` pada `IsiBlok`, tambahkan sebelum `case "gambar"`:

```tsx
    case "kode":
      return (
        <div className="space-y-3">
          <KodeView
            kode={blok.kode ?? ""}
            bahasa={blok.bahasa ?? "cpp"}
            editable
            label={`Kode contoh ${blok.id}`}
            onChange={(berikut) => onChange({ ...blok, kode: berikut })}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor={`${blok.id}-stdin`}
                className="block text-xs font-medium text-gray-600"
              >
                Masukan (stdin)
              </label>
              <textarea
                id={`${blok.id}-stdin`}
                value={blok.stdin ?? ""}
                onChange={(event) => onChange({ ...blok, stdin: event.target.value })}
                rows={2}
                placeholder="Budi"
                className="w-full rounded-lg border border-input bg-transparent px-2 py-1 font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`${blok.id}-harapan`}
                className="block text-xs font-medium text-gray-600"
              >
                Keluaran yang diharapkan
              </label>
              <textarea
                id={`${blok.id}-harapan`}
                value={blok.outputHarapan ?? ""}
                onChange={(event) => onChange({ ...blok, outputHarapan: event.target.value })}
                rows={2}
                placeholder="Halo, Budi!"
                className="w-full rounded-lg border border-input bg-transparent px-2 py-1 font-mono text-xs"
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={blok.dapatDijalankan === true}
              onChange={(event) => onChange({ ...blok, dapatDijalankan: event.target.checked })}
              className="mt-0.5"
            />
            <span>
              Boleh dijalankan peserta.
              <span className="block text-[11px] text-gray-500">
                Biarkan tidak centang untuk kode contoh, pseudokode, atau cuplikan
                yang belum selesai. Blok tanpa centang ini tampil tanpa tombol
                Jalankan.
              </span>
            </span>
          </label>
        </div>
      );
```

`checked={blok.dapatDijalankan === true}` disengaja. Nilai `undefined` tampil tidak centang, sesuai fail-closed.

- [ ] **Step 4: Jalankan `typecheck` dan `check`**

```bash
npm run typecheck && npm run check
```

Expected: hijau sepenuhnya. `typecheck` harus kembali bersih tanpa sisa merah dari Task 1.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/admin/courses/blok-editor.tsx
git commit -m "feat(admin): blok kode bisa ditulis dan disunting ahli"
```

---

### Task 5: Verifikasi di peramban

`npm run check` tidak pernah membuktikan UI benar. Langkah verifikasi terakhir adalah `careevo-browser-verify`. Pakai skill itu, jangan hanya membaca kode.

**Files:** tidak ada perubahan kode yang diharapkan. Kalau verifikasi menemukan cacat, perbaiki di task asal dan commit ulang di sana.

**Interfaces:**
- Consumes: seluruh Task 1 sampai Task 4
- Produces: bukti yang bisa ditampilkan, bukan klaim.

- [ ] **Step 1: Nyalakan server pengembangan**

```bash
npm run dev
```

- [ ] **Step 2: Buktikan jalur admin**

Di peramban, buka `/admin/courses`, pilih sebuah kursus, lalu buka editor halaman.

1. Tambahkan blok bertipe **Kode**.
2. Tempel contoh berikut:

```cpp
#include <iostream>
#include <string>
int main() {
  std::string nama;
  std::getline(std::cin, nama);
  std::cout << "Halo, " << nama << "! Angka 6*7 = " << 6 * 7 << "\n";
}
```

3. Isi **Masukan** dengan `Budi`.
4. Isi **Keluaran yang diharapkan** dengan `Halo, Budi! Angka 6*7 = 42`.
5. Centang **Boleh dijalankan peserta**.
6. Simpan, muat ulang, dan pastikan blok tetap ada. Ini menguji `store-halaman.ts` yang sudah ada, bukan kode baru.
7. Buka **Pratinjau** dan pastikan blok berubah menjadi mode baca.

- [ ] **Step 3: Buktikan jalur peserta**

Buka halaman yang memuat blok itu.

1. Kode tampil dengan syntax highlighting C++. Kata kunci, preprocessor, dan string harus berwarna.
2. Nomor baris tampil.
3. Kode yang tampil identik dengan yang diketik ahli, termasuk indentasi. Ini bukti visual untuk P1.
4. Klik **Salin**, lalu tempel di terminal. Teks harus sama persis tanpa karakter tambahan.
5. Pane "Keluaran yang diharapkan" tampil.
6. Tidak ada tombol Jalankan. Absence ini benar di tahap ini, bukan cacat.

- [ ] **Step 4: Buktikan bawaan fail-closed**

Periksa `data/courses.json` secara langsung:

```bash
python3 -c "
import json
d = json.load(open('data/courses.json'))
kursus = d if isinstance(d, list) else d.get('courses', [])
for c in kursus:
    for m in c.get('modul') or []:
        for h in m.get('halaman') or []:
            for b in h.get('blok') or []:
                if b.get('tipe') == 'kode':
                    print(b.get('id'), 'dapatDijalankan=', repr(b.get('dapatDijalankan')), 'bahasa=', repr(b.get('bahasa')))
"
```

Blok yang dicentang harus bernilai `True`. Blok yang tidak dicentang boleh `False` atau `None`, dan **tidak boleh** `True`.

- [ ] **Step 5: Bukti ketahanan editor**

Tambahkan blok Kode pada 30 blok berbeda dalam satu sesi edit, lalu periksa:

1. Tidak ada perlambatan yang terasa.
2. Console peramban bersih. Peringatan `useEffect must not return anything besides a function` adalah kegagalan nyata, karena `KodeView` harus mengembalikan fungsi pembersih. Kalau muncul, perbaiki Task 2.
3. Setiap blok punya label aksesibel yang berbeda pada area editnya.

- [ ] **Step 6: Simpan bukti dan commit**

Buat folder `docs/kode-verify/`, lalu simpan tangkapan layar untuk dua keadaan: editor admin, dan halaman peserta lengkap dengan nomor baris serta pane keluaran.

```bash
git add docs/kode-verify
git commit -m "docs(verify): bukti blok kode di editor admin dan halaman peserta"
```

---

## Hasil akhir

Setelah plan ini, tanpa podman dan tanpa g++:

- Ahli bisa menulis contoh C++ pada halaman modul, lengkap dengan sintaks, masukan, keluaran harapan, dan sakelar boleh jalan.
- Peserta bisa membaca, menyalin, dan melihat keluaran yang diharapkan.
- `npm run check` dan `npm run build` hijau. `npm test` hijau tanpa infrastruktur.
- Tidak ada tombol Jalankan, tidak ada route API, tidak ada tabel baru, tidak ada migrasi.

Lanjut ke `docs/superpowers/plans/2026-09-27-runner-kode-cpp.md` untuk eksekusi.

## Mutasi yang harus merah

Tiga mutasi sudah tertutup Task 1. Sisanya ada di plan runner.

| # | Mutasi | Ditutup di |
|---|---|---|
| 11 | Hapus `case "kode"` dari `blokBerisi` | Task 1, Step 7 |
| 12 | Hapus `kode` dari `blokSchema` | Task 1, Step 1 |
| 14 | Hapus cabang `kode` dari `jumlahKata` | Task 1, Step 8 |
| 1 sampai 10, 13, 15 | Sandbox, route, dan status | plan runner |
